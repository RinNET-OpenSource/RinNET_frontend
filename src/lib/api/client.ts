import { createStore } from '@/lib/store';
import { navigate } from '@/lib/nav';
import { StatusCode } from '@/lib/models';
import { getAccount, setAccount, clearAccount, accountStore, type Account } from '@/lib/auth/account';

/**
 * 等价旧版 ApiService + TokenInterceptor + ErrorInterceptor + LoadingInterceptor 的合并实现。
 * - 请求带 Authorization；401 时单飞刷新并重试一次
 * - 错误码映射：EULA_REQUIRED → /eula、ACCOUNT_BANNED → /banned（并广播 rinnet-account-access-error）
 * - ref-count 的全局 loading（驱动顶部进度条）
 * - 访问令牌 exp 前 30s 主动刷新
 */

const API_SERVER = '/';
const REFRESH_LEAD_TIME_MS = 30_000;

export type QueryParams = Record<string, string | number | boolean | undefined>;

const loadingStore = createStore(false);
let loadingCount = 0;

/** 有请求进行中（等价旧版 api.loadingState） */
export { loadingStore };

function beginLoading() {
  loadingCount++;
  loadingStore.set(true);
}
function endLoading() {
  loadingCount = Math.max(0, loadingCount - 1);
  if (loadingCount === 0) loadingStore.set(false);
}

function buildUrl(path: string, params?: QueryParams): string {
  const url = API_SERVER + path;
  if (!params) return url;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) search.append(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

function authHeaders(): Record<string, string> {
  const account = getAccount();
  if (account?.tokenType && account?.accessToken) {
    return { Authorization: `${account.tokenType} ${account.accessToken}` };
  }
  return {};
}

async function parseBody(resp: Response): Promise<any> {
  const text = await resp.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** 原始 fetch（无拦截逻辑），刷新接口与 blob 下载使用 */
export async function rawFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, headers: { ...authHeaders(), ...(init.headers as object) } });
}

// ---- 401 单飞刷新（等价 TokenInterceptor.refreshAndRetry） ----

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(captured: Account): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const resp = await fetch(API_SERVER + 'api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: captured.refreshToken }),
      });
      const body = await parseBody(resp);
      const current = getAccount();
      // 登出/令牌轮换竞态守卫：与旧版一致，只写回仍然匹配的会话
      if (!current || current.refreshToken !== captured.refreshToken) {
        throw new Error('session replaced');
      }
      if (resp.ok && body?.status?.code === StatusCode.OK && body.data?.accessToken) {
        setAccount({ ...current, accessToken: body.data.accessToken });
        return body.data.accessToken as string;
      }
      throw new Error('refresh failed');
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ---- 错误映射（等价 ErrorInterceptor） ----

function handleErrorResponse(httpStatus: number, body: any, statusText: string): never {
  const statusCode = body?.status?.code;
  if (statusCode === StatusCode.EULA_REQUIRED) {
    window.dispatchEvent(new CustomEvent('rinnet-account-access-error', { detail: 'EULA_REQUIRED' }));
    navigate('/eula');
  } else if (statusCode === StatusCode.ACCOUNT_BANNED) {
    window.dispatchEvent(new CustomEvent('rinnet-account-access-error', { detail: 'ACCOUNT_BANNED' }));
    navigate('/banned');
  }
  const error = body?.status?.message ?? body?.message ?? `${httpStatus} ${statusText}`;
  if (httpStatus === 401 && getAccount()) {
    clearAccount();
    location.reload();
  }
  throw error;
}

// ---- 主入口 ----

async function perform(method: string, path: string, params?: QueryParams, body?: unknown): Promise<any> {
  const url = buildUrl(path, params);
  const isRefreshCall = path === 'api/auth/refresh';
  beginLoading();
  try {
    let resp = await fetch(url, {
      method,
      headers: { ...authHeaders(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (resp.status === 401 && !isRefreshCall) {
      const account = getAccount();
      if (account?.refreshToken) {
        try {
          await refreshAccessToken(account);
          resp = await fetch(url, {
            method,
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: body !== undefined ? JSON.stringify(body) : undefined,
          });
        } catch {
          // 刷新失败：以 401 响应走统一错误处理（等价旧版重抛原始错误）
        }
      }
    }

    const parsed = await parseBody(resp);
    if (!resp.ok) {
      handleErrorResponse(resp.status, parsed, resp.statusText);
    }
    return parsed;
  } finally {
    endLoading();
  }
}

export const api = {
  get: (path: string, params?: QueryParams) => perform('GET', path, params),
  post: (path: string, data?: object, params?: QueryParams) => perform('POST', path, params, data),
  put: (path: string, data?: object, params?: QueryParams) => perform('PUT', path, params, data),
  delete: (path: string, params?: QueryParams, body?: unknown) => perform('DELETE', path, params, body),
  /** blob 下载（profile 导出等，手动带 Bearer，等价旧版 responseType:'blob' 调用） */
  blob: async (path: string, params?: QueryParams): Promise<Blob> => {
    const resp = await rawFetch(buildUrl(path, params));
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    return resp.blob();
  },
  getHost: () => API_SERVER,
};

// ---- 主动刷新调度（等价 TokenInterceptor.rescheduleRefresh） ----

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function decodeExpMs(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function proactiveRefresh() {
  const account = getAccount();
  if (!account?.refreshToken) return;
  try {
    const resp = await fetch(API_SERVER + 'api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: account.refreshToken }),
    });
    const body = await parseBody(resp);
    const current = getAccount();
    if (!current || current.refreshToken !== account.refreshToken) return;
    if (resp.ok && body?.status?.code === StatusCode.OK && body.data?.accessToken) {
      setAccount({ ...current, accessToken: body.data.accessToken });
    }
  } catch {
    // 静默：后续请求会走 401 反应式刷新
  }
}

function rescheduleRefresh(account: Account | null) {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  if (!account?.accessToken) return;
  const expMs = decodeExpMs(account.accessToken);
  if (!expMs) return;
  const delay = expMs - Date.now() - REFRESH_LEAD_TIME_MS;
  if (delay <= 0) return;
  refreshTimer = setTimeout(() => void proactiveRefresh(), delay);
}

accountStore.subscribe(() => rescheduleRefresh(getAccount()));
rescheduleRefresh(getAccount());
