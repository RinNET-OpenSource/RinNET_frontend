import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { StatusCode, type Card, type User } from '@/lib/models';
import { getAccount, IMPERSONATED_USER_KEY, IMPERSONATION_KEY, type Account } from '@/lib/auth/account';
import { IMPERSONATE_GRANT, IMPERSONATE_REQUEST } from '@/lib/auth/impersonation';
import './AdminPage.css';

const PAGE_SIZE = 12;

type AdminTab = 'users' | 'keychips' | 'eula';
type GameKey = 'CHUSAN' | 'MAIMAI2' | 'ONGEKI';

interface ApiEnvelope<T> {
  data?: T;
  status?: { code?: number; message?: string };
}

interface PageData<T> {
  content?: T[];
  totalElements?: number;
}

interface AdminGameData {
  banState?: number;
  banStatus?: number;
  playerRating?: number;
  userName?: string;
}

interface AdminGameProfile {
  card: Card;
  chusan?: AdminGameData | null;
  ongeki?: AdminGameData | null;
  maimai2?: AdminGameData | null;
}

export interface AdvancedUser {
  user: User;
  gameProfiles: AdminGameProfile[];
}

interface SupportCard {
  extId: number;
  defaultCard?: boolean;
  externalLuids?: string[];
}

interface SupportProfile {
  cards?: SupportCard[];
  eulaStatus?: {
    acceptedVersion?: number | null;
    currentVersion?: number;
    required?: boolean;
  };
  joinedAt?: string;
  oauthIdentities?: Array<{ email: string; id: number; provider: string }>;
  passkeys?: Array<{ id: number; nick: string }>;
  totpEnabled?: boolean;
  username?: string;
}

interface SupportResponse {
  account: SupportProfile;
  eulaStatus?: SupportProfile['eulaStatus'];
  oauthIdentities?: SupportProfile['oauthIdentities'];
  passkeys?: SupportProfile['passkeys'];
  totpEnabled?: boolean;
}

interface AdminKeychip {
  id: number;
  keychipId: string;
  placeName?: string;
  user?: { name?: string } | null;
  whiteListed?: boolean;
}

interface EulaDocument {
  content: string;
  title: string;
  version: number;
}

interface ImpersonationState {
  account: Account;
  nonce: string;
  url: string;
  username: string;
}

function isAccount(value: unknown): value is Account {
  if (!value || typeof value !== 'object') return false;
  const account = value as Partial<Account>;
  return typeof account.accessToken === 'string'
    && account.accessToken.length > 0
    && typeof account.refreshToken === 'string'
    && account.refreshToken.length > 0
    && typeof account.tokenType === 'string'
    && account.tokenType.length > 0;
}

/** Revokes a captured target session without running the admin API interceptor. */
async function revokeRefreshToken(refreshToken: string, keepalive = false): Promise<void> {
  const owner = getAccount();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (owner?.tokenType && owner.accessToken) {
    headers.Authorization = `${owner.tokenType} ${owner.accessToken}`;
  }
  await fetch('/api/auth/signout', {
    method: 'POST',
    headers,
    body: JSON.stringify({ refreshToken }),
    keepalive,
  });
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

function isOk(response: ApiEnvelope<unknown>): boolean {
  return response?.status?.code === StatusCode.OK;
}

function isBanned(item: AdvancedUser): boolean {
  return !(item.user.roles ?? []).some((role) => role.name === 'ROLE_USER');
}

function isAdminTarget(item: AdvancedUser): boolean {
  return (item.user.roles ?? []).some((role) => role.name === 'ROLE_ADMIN');
}

function formatJoinedAt(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
}

function formatRating(value?: number): string {
  return ((value ?? 0) / 100).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function highlightJson(value: unknown): string {
  const json = (JSON.stringify(value, null, 2) ?? 'null')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return json.replace(
    /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'json-number';
      if (match.startsWith('"')) {
        cls = match.trimEnd().endsWith(':') ? 'json-key' : 'json-string';
      } else if (match === 'true' || match === 'false') {
        cls = 'json-boolean';
      } else if (match === 'null') {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    },
  );
}

function Pagination({
  currentPage,
  onChange,
  totalElements,
}: {
  currentPage: number;
  onChange: (page: number) => void;
  totalElements: number;
}) {
  const totalPages = Math.max(1, Math.ceil(totalElements / PAGE_SIZE));
  const pages = useMemo(() => {
    const visible = Math.min(7, totalPages);
    const half = Math.floor(visible / 2);
    let start = Math.max(1, currentPage - half);
    start = Math.min(start, Math.max(1, totalPages - visible + 1));
    return Array.from({ length: visible }, (_, index) => start + index);
  }, [currentPage, totalPages]);

  return (
    <div className="admin-pagination-host user-select-none">
      <ul className="pagination pagination-sm justify-content-center my-2 admin-pagination">
        <li className={`page-item${currentPage === 1 ? ' disabled' : ''}`}>
          <a className="page-link" onClick={() => currentPage > 1 && onChange(currentPage - 1)}>&nbsp;&lt;&nbsp;</a>
        </li>
        {pages.map((page) => (
          <li className={`page-item${currentPage === page ? ' active' : ''}`} key={page}>
            <a className="page-link" onClick={() => currentPage !== page && onChange(page)}>{page}</a>
          </li>
        ))}
        <li className={`page-item${currentPage === totalPages ? ' disabled' : ''}`}>
          <a className="page-link" onClick={() => currentPage < totalPages && onChange(currentPage + 1)}>&nbsp;&gt;&nbsp;</a>
        </li>
      </ul>
    </div>
  );
}

function AdminDialog({
  bodyClassName = '',
  children,
  fullscreen = false,
  headerAction,
  headerClassName = '',
  initialFocusRef,
  nested = false,
  onClose,
  open,
  scrollable = false,
  size,
  staticBackdrop = false,
  title,
  titleClassName = '',
}: {
  bodyClassName?: string;
  children: ReactNode;
  fullscreen?: boolean;
  headerAction?: ReactNode;
  headerClassName?: string;
  initialFocusRef?: { current: HTMLElement | null };
  nested?: boolean;
  onClose: () => void;
  open: boolean;
  scrollable?: boolean;
  size?: 'lg';
  staticBackdrop?: boolean;
  title: string;
  titleClassName?: string;
}) {
  const contentClass = [
    'admin-dialog-content',
    'compat-modal',
    'fixed',
    'grid',
    'w-full',
    'bg-popover',
    'text-sm',
    'text-popover-foreground',
    'shadow-md',
    'outline-none',
    ...(
      fullscreen
        ? []
        : [
            'left-1/2',
            'top-1/2',
            '-translate-1/2',
            'max-w-[calc(100%-2rem)]',
            'rounded-[0.5rem]',
            'border',
            'border-border',
            'sm:max-w-[500px]',
          ]
    ),
    scrollable ? 'compat-scrollable' : '',
    size === 'lg' ? 'compat-lg' : '',
    nested ? 'admin-dialog-content-nested' : '',
    fullscreen ? 'admin-impersonation-dialog' : '',
  ].filter(Boolean).join(' ');

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(value) => {
        if (!value && !staticBackdrop) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={`admin-dialog-overlay modal-backdrop fade show${nested ? ' admin-dialog-overlay-nested' : ''}`}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={contentClass}
          onEscapeKeyDown={(event) => staticBackdrop && event.preventDefault()}
          onInteractOutside={(event) => staticBackdrop && event.preventDefault()}
          onOpenAutoFocus={(event) => {
            if (initialFocusRef?.current) {
              event.preventDefault();
              initialFocusRef.current.focus();
            } else {
              event.preventDefault();
            }
          }}
          style={{ gap: 0, padding: 0 }}
        >
          <main
            className={`flex flex-col${fullscreen ? '' : ' space-y-4'}`}
            style={scrollable ? { display: 'block', overflow: 'auto' } : undefined}
          >
            <div className={`modal-header${headerClassName ? ` ${headerClassName}` : ''}`}>
              <DialogPrimitive.Title asChild>
                <h5 className={`modal-title${titleClassName ? ` ${titleClassName}` : ''}`}>{title}</h5>
              </DialogPrimitive.Title>
              {headerAction ?? (
                <button type="button" className="btn-close shadow-none" aria-label="Close" onClick={onClose} />
              )}
            </div>
            <div className={`modal-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>{children}</div>
          </main>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function GameBanRow({
  data,
  extId,
  game,
  label,
  onDelete,
  onSave,
}: {
  data: AdminGameData;
  extId: number;
  game: GameKey;
  label: string;
  onDelete: (game: GameKey, extId: number) => void;
  onSave: (game: GameKey, extId: number, status: string) => void;
}) {
  const [status, setStatus] = useState(String(game === 'ONGEKI' ? data.banStatus ?? 0 : data.banState ?? 0));
  return (
    <div className={`input-group input-group-sm${game === 'ONGEKI' ? '' : ' mb-1'}`}>
      <span className="input-group-text">{label}</span>
      <select className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="0">0</option>
        <option value="1">1</option>
        <option value="2">2</option>
      </select>
      <button type="button" className="btn btn-outline-primary" onClick={() => onSave(game, extId, status)}>保存</button>
      <button type="button" className="btn btn-outline-danger" onClick={() => onDelete(game, extId)}>删除存档</button>
    </div>
  );
}

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('users');
  const [field, setField] = useState('all');
  const [pattern, setPattern] = useState('');
  const [users, setUsers] = useState<AdvancedUser[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);

  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');

  const [selectedItem, setSelectedItem] = useState<AdvancedUser | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<SupportProfile | null>(null);
  const [rawJson, setRawJson] = useState<string | null>(null);
  const [rawJsonUsername, setRawJsonUsername] = useState('');
  const [cardAccessCode, setCardAccessCode] = useState('');
  const [cardExtId, setCardExtId] = useState('');
  const [oldAccessCode, setOldAccessCode] = useState('');
  const [newAccessCode, setNewAccessCode] = useState('');
  const supportRequestId = useRef(0);

  const [keychips, setKeychips] = useState<AdminKeychip[] | null>(null);
  const [keychipPattern, setKeychipPattern] = useState('');
  const [keychipPage, setKeychipPage] = useState(1);
  const [keychipTotal, setKeychipTotal] = useState(0);
  const [newKeychipId, setNewKeychipId] = useState('');
  const [newKeychipPlace, setNewKeychipPlace] = useState('');

  const [eulaCurrent, setEulaCurrent] = useState<EulaDocument | null>(null);
  const [eulaDraftTitle, setEulaDraftTitle] = useState('');
  const [eulaDraftContent, setEulaDraftContent] = useState('');
  const [eulaPreview, setEulaPreview] = useState('');

  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(null);
  const [loginAsPending, setLoginAsPending] = useState(false);
  const impersonationFrame = useRef<HTMLIFrameElement>(null);
  const impersonationRef = useRef<ImpersonationState | null>(null);
  const impersonationListenerRef = useRef<((event: MessageEvent) => void) | null>(null);
  const loginAsFlightRef = useRef<Promise<void> | null>(null);
  const impersonationGenerationRef = useRef(0);
  const capturedRefreshTokensRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  const unloadingRef = useRef(false);
  const impersonationCloseButtonRef = useRef<HTMLButtonElement>(null);
  const initialized = useRef(false);

  async function loadUsers(page: number, searchPattern: string, searchField: string) {
    setCurrentPage(page + 1);
    const params: Record<string, string | number> = { page, size: PAGE_SIZE, field: searchField || 'all' };
    if (searchPattern !== '') params.pattern = searchPattern;
    try {
      const response = await api.get('api/admin/advancedUserSearch', params) as ApiEnvelope<PageData<AdvancedUser>>;
      if (isOk(response) && response.data) {
        setUsers(response.data.content ?? []);
        setTotalElements(response.data.totalElements ?? 0);
      } else {
        notice(response?.status?.message ?? '加载用户失败', 'warning');
      }
    } catch (error) {
      notice(errorText(error), 'warning');
    } finally {
      setLoading(false);
    }
  }

  async function loadKeychips(page: number, searchPattern: string) {
    setKeychipPage(page + 1);
    const params: Record<string, string | number> = { page, size: PAGE_SIZE };
    if (searchPattern) params.pattern = searchPattern;
    try {
      const response = await api.get('api/admin/keychip', params) as ApiEnvelope<PageData<AdminKeychip>>;
      if (isOk(response) && response.data) {
        setKeychips(response.data.content ?? []);
        setKeychipTotal(response.data.totalElements ?? 0);
      }
    } catch (error) {
      notice(errorText(error), 'warning');
    }
  }

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void loadUsers(0, '', 'all');
    void loadKeychips(0, '');
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const onPageHide = () => {
      unloadingRef.current = true;
      teardownImpersonation(true);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('pagehide', onPageHide);
      teardownImpersonation(unloadingRef.current);
    };
  }, []);

  async function loadSupport(username: string) {
    const requestId = ++supportRequestId.current;
    try {
      const response = await api.get(`api/admin/accounts/${username}`) as ApiEnvelope<SupportResponse>;
      if (
        requestId === supportRequestId.current
        && (response?.status?.code === StatusCode.USER_FETCH_SUCCESS || isOk(response))
        && response.data
      ) {
        setSelectedProfile({
          ...response.data.account,
          eulaStatus: response.data.eulaStatus,
          oauthIdentities: response.data.oauthIdentities,
          passkeys: response.data.passkeys,
          totpEnabled: response.data.totpEnabled,
        });
      }
    } catch {
      // Legacy detail modal silently keeps the support-only fields empty.
    }
  }

  function openUser(item: AdvancedUser) {
    setSelectedItem(item);
    setSelectedProfile(null);
    setRawJson(null);
    setRawJsonUsername('');
    setCardAccessCode('');
    setCardExtId('');
    setOldAccessCode('');
    setNewAccessCode('');
    void loadSupport(item.user.username);
  }

  function closeUser() {
    supportRequestId.current += 1;
    setSelectedItem(null);
    setSelectedProfile(null);
    setRawJson(null);
    setRawJsonUsername('');
  }

  function openRawJson(item: AdvancedUser) {
    setRawJson(highlightJson(item));
    setRawJsonUsername(item.user.username);
  }

  async function refreshUsers() {
    await loadUsers(currentPage - 1, pattern, field);
  }

  async function createUser() {
    if (!createUsername || !createName || !createEmail || !createPassword) {
      notice('请填写完整的用户信息', 'warning');
      return;
    }
    setCreatingUser(true);
    try {
      const response = await api.post('api/admin/createUser', {
        userName: createUsername,
        name: createName,
        email: createEmail,
        password: createPassword,
      }) as ApiEnvelope<unknown>;
      notice(response?.status?.message ?? '');
      if (isOk(response)) await refreshUsers();
    } catch (error) {
      notice(errorText(error), 'warning');
    } finally {
      setCreatingUser(false);
    }
  }

  function installImpersonationListener(session: ImpersonationState) {
    const listener = (event: MessageEvent) => {
      const current = impersonationRef.current;
      const frame = impersonationFrame.current;
      if (
        current !== session
        || event.origin !== window.location.origin
        || event.source !== frame?.contentWindow
        || event.data?.nonce !== session.nonce
        || event.data?.type !== IMPERSONATE_REQUEST
      ) return;
      (event.source as Window).postMessage({
        type: IMPERSONATE_GRANT,
        nonce: session.nonce,
        account: session.account,
      }, window.location.origin);
    };
    impersonationListenerRef.current = listener;
    window.addEventListener('message', listener);
  }

  async function performLoginAs(username: string, generation: number): Promise<void> {
    try {
      const response = await api.post(`api/admin/users/loginas/${username}`, {}) as ApiEnvelope<unknown>;
      const account = response?.data;
      if (!isOk(response) || !isAccount(account)) {
        if (mountedRef.current && generation === impersonationGenerationRef.current) {
          notice(response?.status?.message ?? '夺舍失败');
        }
        return;
      }

      // Capture every issued refresh token, including a response that arrives
      // after the page was closed or another impersonation superseded it.
      const refreshToken = account.refreshToken;
      if (
        !mountedRef.current
        || generation !== impersonationGenerationRef.current
        || impersonationRef.current
      ) {
        void revokeRefreshToken(refreshToken, unloadingRef.current).catch((error) => {
          console.warn('could not revoke late impersonated session', error);
        });
        return;
      }

      const nonce = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const session: ImpersonationState = {
        username,
        account,
        nonce,
        url: new URL(`/?imp=${encodeURIComponent(nonce)}`, window.location.origin).toString(),
      };
      capturedRefreshTokensRef.current.add(refreshToken);
      impersonationRef.current = session;
      // Install before mounting the iframe. The child also retries its request,
      // covering the brief interval before React assigns the iframe ref.
      installImpersonationListener(session);
      setImpersonation(session);
    } catch (error) {
      if (mountedRef.current && generation === impersonationGenerationRef.current) {
        notice(errorText(error), 'warning');
        console.warn('login as fail', error);
      }
    }
  }

  function loginAs(username: string) {
    // This ref guard is synchronous, so a double click/Enter key before React
    // re-renders still produces only one loginas request.
    if (loginAsFlightRef.current || impersonationRef.current) return;
    unloadingRef.current = false;
    const generation = impersonationGenerationRef.current;
    setLoginAsPending(true);
    const flight = performLoginAs(username, generation);
    loginAsFlightRef.current = flight;
    void flight.then(
      () => {
        if (loginAsFlightRef.current === flight) loginAsFlightRef.current = null;
        if (mountedRef.current) setLoginAsPending(false);
      },
      () => {
        if (loginAsFlightRef.current === flight) loginAsFlightRef.current = null;
        if (mountedRef.current) setLoginAsPending(false);
      },
    );
  }

  function teardownImpersonation(keepalive = false) {
    const session = impersonationRef.current;
    const listener = impersonationListenerRef.current;
    const tokens = new Set(capturedRefreshTokensRef.current);
    if (session?.account.refreshToken) tokens.add(session.account.refreshToken);

    // Invalidate the identity and remove the listener first. Any queued
    // postMessage or late loginas response now fails the identity check.
    impersonationRef.current = null;
    impersonationGenerationRef.current += 1;
    impersonationListenerRef.current = null;
    if (listener) window.removeEventListener('message', listener);

    try {
      impersonationFrame.current?.contentWindow?.sessionStorage?.removeItem(IMPERSONATION_KEY);
      impersonationFrame.current?.contentWindow?.sessionStorage?.removeItem(IMPERSONATED_USER_KEY);
    } catch (error) {
      console.warn('could not clear impersonated frame session', error);
    }
    try {
      // Also clear any stale values in the parent browsing context. These keys
      // are never used for the administrator's normal account/user cache.
      sessionStorage.removeItem(IMPERSONATION_KEY);
      sessionStorage.removeItem(IMPERSONATED_USER_KEY);
    } catch (error) {
      console.warn('could not clear impersonated session', error);
    }

    capturedRefreshTokensRef.current.clear();
    if (mountedRef.current) {
      setImpersonation(null);
      setLoginAsPending(false);
    }
    for (const token of tokens) {
      void revokeRefreshToken(token, keepalive).catch((error) => {
        console.warn('could not revoke impersonated session', error);
      });
    }
  }

  function closeImpersonation() {
    teardownImpersonation(false);
  }

  async function setAccountBan(item: AdvancedUser, banned: boolean) {
    const warning = banned
      ? `封禁 ${item.user.username}？其现有 Chusan、Maimai2、Ongeki 档案会设为 2，所有 refresh 会话会撤销。`
      : `解除 ${item.user.username} 的面板封禁？游戏封禁值不会自动恢复。`;
    if (!window.confirm(warning)) return;
    try {
      const response = await api.post(`api/admin/accounts/${item.user.username}/${banned ? 'ban' : 'unban'}`, {}) as ApiEnvelope<unknown>;
      notice(response?.status?.message ?? '');
      await refreshUsers();
    } catch (error) {
      notice(errorText(error), 'warning');
    }
  }

  async function setGameBan(username: string, game: GameKey, extId: number, status: string) {
    try {
      const response = await api.put(`api/admin/accounts/${username}/games/${game}/${extId}/ban-state`, {
        status: Number(status),
      }) as ApiEnvelope<unknown>;
      notice(response?.status?.message ?? '');
      await refreshUsers();
      if (isOk(response) && selectedProfile?.username === username) await loadSupport(username);
    } catch (error) {
      notice(errorText(error), 'warning');
    }
  }

  async function deleteGameSave(username: string, game: GameKey, extId: number) {
    const confirmation = window.prompt(
      `不可恢复：删除 ${username} / ${extId} / ${game} 的完整游戏存档。下次游玩会创建全新档案。\n请输入完整 ExtId 确认：`,
    );
    if (confirmation !== String(extId)) return;
    try {
      const response = await api.delete(
        `api/admin/accounts/${username}/games/${game}/${extId}`,
        { confirmExtId: String(extId) },
      ) as ApiEnvelope<unknown>;
      notice(response?.status?.message ?? '');
      await refreshUsers();
      if (isOk(response) && selectedProfile?.username === username) await loadSupport(username);
    } catch (error) {
      notice(errorText(error), 'warning');
    }
  }

  async function revokeSessions(username: string) {
    if (!window.confirm(`撤销 ${username} 的全部 refresh 会话？现有 access token 最多约 5 分钟后失效。`)) return;
    try {
      const response = await api.post(`api/admin/accounts/${username}/sessions/revoke`, {}) as ApiEnvelope<unknown>;
      notice(response?.status?.message ?? '');
    } catch (error) {
      notice(errorText(error), 'warning');
    }
  }

  async function deletePasskey(username: string, id: number) {
    if (!window.confirm('删除此 Passkey 并撤销该用户全部 refresh 会话？')) return;
    try {
      await api.delete(`api/admin/accounts/${username}/passkeys/${id}`);
      await loadSupport(username);
    } catch (error) {
      notice(errorText(error), 'warning');
    }
  }

  async function deleteOauth(username: string, id: number) {
    if (!window.confirm('解绑此 OAuth identity 并撤销该用户全部 refresh 会话？')) return;
    try {
      await api.delete(`api/admin/accounts/${username}/oauth/${id}`);
      await loadSupport(username);
    } catch (error) {
      notice(errorText(error), 'warning');
    }
  }

  async function setDefaultCard(username: string, extId: number) {
    if (!window.confirm(`将 ExtId ${extId} 设为 ${username} 的默认卡？`)) return;
    try {
      await api.put(`api/admin/accounts/${username}/cards/${extId}/default`, {});
      await loadSupport(username);
    } catch (error) {
      notice(errorText(error), 'warning');
    }
  }

  async function unbindCardByExtId(username: string, extId: number) {
    if (!window.confirm(`解绑 ${username} 的 ExtId ${extId}？关联 Access Code 会一并移除。`)) return;
    try {
      await api.delete(`api/admin/accounts/${username}/cards/${extId}`);
      await Promise.all([loadSupport(username), refreshUsers()]);
    } catch (error) {
      notice(errorText(error), 'warning');
    }
  }

  async function removeExternal(username: string, extId: number, luid: string) {
    if (!window.confirm(`从 ExtId ${extId} 删除外部 Access Code ${luid}？`)) return;
    try {
      await api.delete(`api/admin/accounts/${username}/cards/${extId}/external/${luid}`);
      await loadSupport(username);
    } catch (error) {
      notice(errorText(error), 'warning');
    }
  }

  async function resetTotp(username: string) {
    if (!window.confirm(`确定要重置 ${username} 的两步验证吗？该用户的所有会话会被登出。`)) return;
    try {
      const response = await api.delete(`api/admin/users/${username}/totp`) as ApiEnvelope<unknown>;
      notice(response?.status?.message ?? '');
      setSelectedProfile((profile) => profile ? { ...profile, totpEnabled: false } : profile);
    } catch (error) {
      notice(errorText(error), 'warning');
    }
  }

  async function cardOperation(path: string, body: Record<string, unknown>) {
    try {
      const response = await api.post(path, body) as ApiEnvelope<unknown>;
      notice(response?.status?.message ?? '');
      await refreshUsers();
    } catch (error) {
      notice(errorText(error), 'warning');
    }
  }

  async function bindCardViaExtId(username: string) {
    const parsed = Number(cardExtId);
    if (!cardExtId || Number.isNaN(parsed)) {
      notice('请输入正确的 ExtId', 'warning');
      return;
    }
    await cardOperation('api/admin/bindCardViaExtId', { userName: username, extId: parsed });
  }

  async function loadEula() {
    setTab('eula');
    try {
      const response = await api.get('api/admin/eula') as ApiEnvelope<{
        current: EulaDocument;
        draft?: EulaDocument | null;
      }>;
      if (!response.data?.current) return;
      const current = response.data.current;
      const title = response.data.draft?.title ?? `${current.title}`;
      const content = response.data.draft?.content ?? current.content;
      setEulaCurrent(current);
      setEulaDraftTitle(title);
      setEulaDraftContent(content);
      setEulaPreview(DOMPurify.sanitize(marked.parse(content || '') as string));
    } catch (error) {
      notice(errorText(error), 'warning');
    }
  }

  function updateEulaContent(content: string) {
    setEulaDraftContent(content);
    setEulaPreview(DOMPurify.sanitize(marked.parse(content || '') as string));
  }

  async function saveEulaDraft() {
    try {
      const response = await api.put('api/admin/eula/draft', {
        title: eulaDraftTitle,
        content: eulaDraftContent,
      }) as ApiEnvelope<unknown>;
      notice(response?.status?.message ?? '');
    } catch (error) {
      notice(errorText(error), 'warning');
    }
  }

  async function publishEula() {
    if (!window.confirm('发布新版本后，全部用户（包括管理员）都必须重新同意。继续发布？')) return;
    try {
      await api.post('api/admin/eula/publish', {});
      window.location.assign('/eula');
    } catch (error) {
      notice(errorText(error), 'warning');
    }
  }

  async function addKeychip() {
    if (!newKeychipId) {
      notice('请输入 Keychip ID', 'warning');
      return;
    }
    const body: Record<string, string> = { keychipId: newKeychipId };
    if (newKeychipPlace) body.placeName = newKeychipPlace;
    setNewKeychipId('');
    setNewKeychipPlace('');
    try {
      const response = await api.post('api/admin/keychip', body) as ApiEnvelope<unknown>;
      notice(response?.status?.message ?? '');
      await loadKeychips(keychipPage - 1, keychipPattern);
    } catch (error) {
      notice(errorText(error), 'warning');
    }
  }

  async function deleteKeychip(id: number) {
    if (!window.confirm('确定要删除这个 Keychip 吗？')) return;
    try {
      await api.delete(`api/admin/keychip/${id}`);
      await loadKeychips(keychipPage - 1, keychipPattern);
    } catch (error) {
      notice(errorText(error), 'warning');
    }
  }

  async function toggleWhiteList(keychipId: string) {
    try {
      await api.post('api/admin/keychip/toggleWhiteList', { keychipId });
      await loadKeychips(keychipPage - 1, keychipPattern);
    } catch (error) {
      notice(errorText(error), 'warning');
    }
  }

  const selectedUsername = selectedItem?.user.username ?? '';

  return (
    <div className="admin-page">
      <h1 className="page-heading">管理员</h1>

      <div className="row justify-content-start align-items-center g-1 mb-2">
        <div className="col-auto">
          <button type="button" className={`tab-selector${tab === 'users' ? ' tab-selector-active' : ''}`} onClick={() => setTab('users')}>用户</button>
        </div>
        <div className="col-auto">
          <button type="button" className={`tab-selector${tab === 'keychips' ? ' tab-selector-active' : ''}`} onClick={() => setTab('keychips')}>Keychip</button>
        </div>
        <div className="col-auto">
          <button type="button" className={`tab-selector${tab === 'eula' ? ' tab-selector-active' : ''}`} onClick={() => void loadEula()}>EULA</button>
        </div>
      </div>

      {tab === 'users' && (
        <div>
          <div className="row mb-2 g-1">
            <div className="col-12 p-0">
              <div className="input-group input-group-sm">
                <select className="form-select flex-grow-0 w-auto" value={field} onChange={(event) => setField(event.target.value)}>
                  <option value="all">全部</option>
                  <option value="username">登录名</option>
                  <option value="name">昵称</option>
                  <option value="email">邮箱</option>
                  <option value="game">游戏昵称</option>
                  <option value="card">卡号</option>
                  <option value="extId">ExtId</option>
                </select>
                <input
                  type="text"
                  className="form-control"
                  placeholder="搜索内容"
                  value={pattern}
                  onChange={(event) => setPattern(event.target.value)}
                  onKeyUp={(event) => event.key === 'Enter' && void loadUsers(0, pattern, field)}
                />
              </div>
            </div>
          </div>
          <div className="row mb-2 g-1">
            <div className="col-12 p-0">
              <button type="button" className="btn btn-primary btn-sm w-100" onClick={() => void loadUsers(0, pattern, field)}>搜索</button>
            </div>
          </div>
          <div className="row mb-2 g-1">
            <div className="col-12 p-0">
              <button type="button" className="btn btn-outline-primary btn-sm w-100" onClick={() => setCreateUserOpen(true)}>创建用户</button>
            </div>
          </div>
          {!loading && <Pagination currentPage={currentPage} totalElements={totalElements} onChange={(page) => void loadUsers(page - 1, pattern, field)} />}
          {users && (
            <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-2">
              {users.map((item) => (
                <div className="col" key={item.user.id}>
                  <div className="card h-100 card-btn user-select-none" onClick={() => openUser(item)}>
                    <div className="card-header fw-bold">{item.user.id}.{item.user.username}</div>
                    <div className="card-body small">
                      <span className={`badge mb-1 ${isBanned(item) ? 'bg-danger' : 'bg-success'}`}>
                        {isBanned(item) ? '已封禁' : '正常'}
                      </span>
                      <div>{item.user.name}</div>
                      <div>{item.user.email}</div>
                      {(item.user.oauth2s ?? []).map((oauth) => <div key={oauth.id}>{oauth.email}</div>)}
                      {(item.gameProfiles ?? []).map((profile, index) => (
                        <div key={`${profile.card?.extId ?? 'card'}-${index}`}>
                          {profile.ongeki && <div>{profile.ongeki.userName}</div>}
                          {profile.chusan && <div>{profile.chusan.userName}</div>}
                          {profile.maimai2 && <div>{profile.maimai2.userName}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && <Pagination currentPage={currentPage} totalElements={totalElements} onChange={(page) => void loadUsers(page - 1, pattern, field)} />}
        </div>
      )}

      {tab === 'eula' && (
        <div className="row g-3">
          <div className="col-12 col-lg-6">
            <div className="card"><div className="card-body">
              <h5>当前已发布版本 {eulaCurrent?.version}</h5>
              <p className="text-secondary">{eulaCurrent?.title}</p>
              <label className="form-label">草稿标题</label>
              <input className="form-control mb-2" value={eulaDraftTitle} onChange={(event) => setEulaDraftTitle(event.target.value)} />
              <label className="form-label">Markdown 正文</label>
              <textarea className="form-control font-monospace" rows={20} value={eulaDraftContent} onChange={(event) => updateEulaContent(event.target.value)} />
              <div className="d-flex gap-2 mt-2">
                <button type="button" className="btn btn-outline-primary" onClick={() => void saveEulaDraft()}>保存草稿</button>
                <button type="button" className="btn btn-danger" onClick={() => void publishEula()}>发布新版本</button>
              </div>
            </div></div>
          </div>
          <div className="col-12 col-lg-6">
            <div className="card"><div className="card-body">
              <h5>安全预览</h5>
              <article dangerouslySetInnerHTML={{ __html: eulaPreview }} />
            </div></div>
          </div>
        </div>
      )}

      {tab === 'keychips' && (
        <div>
          <div className="input-group input-group-sm mb-2">
            <input
              type="text"
              className="form-control"
              placeholder="按 Keychip ID 搜索"
              value={keychipPattern}
              onChange={(event) => setKeychipPattern(event.target.value)}
              onKeyUp={(event) => event.key === 'Enter' && void loadKeychips(0, keychipPattern)}
            />
            <button type="button" className="btn btn-primary" onClick={() => void loadKeychips(0, keychipPattern)}>搜索</button>
          </div>
          <div className="input-group input-group-sm mb-2">
            <input type="text" className="form-control" placeholder="Keychip ID" value={newKeychipId} onChange={(event) => setNewKeychipId(event.target.value)} />
            <input type="text" className="form-control" placeholder="店铺名 (可选)" value={newKeychipPlace} onChange={(event) => setNewKeychipPlace(event.target.value)} />
            <button type="button" className="btn btn-primary" onClick={() => void addKeychip()}>添加</button>
          </div>
          {keychips && (
            <div className="card mb-4">
              <div className="table-responsive">
                <table className="table table-sm table-hover small mb-0 align-middle">
                  <thead><tr><th>ID</th><th>Keychip</th><th>用户</th><th>店铺名</th><th>白名单</th><th /></tr></thead>
                  <tbody>
                    {keychips.map((keychip) => (
                      <tr key={keychip.id}>
                        <td>{keychip.id}</td>
                        <td>{keychip.keychipId}</td>
                        <td>{keychip.user?.name ?? '-'}</td>
                        <td>{keychip.placeName}</td>
                        <td>
                          <span className={`badge rounded-pill ${keychip.whiteListed ? 'bg-success' : 'bg-secondary'}`}>
                            {keychip.whiteListed ? '已加白' : '未加白'}
                          </span>
                        </td>
                        <td className="text-end">
                          <button type="button" className="btn btn-outline-primary btn-sm me-1" onClick={() => void toggleWhiteList(keychip.keychipId)}>切换白名单</button>
                          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void deleteKeychip(keychip.id)}>删除</button>
                        </td>
                      </tr>
                    ))}
                    {keychips.length === 0 && <tr><td colSpan={6} className="text-center text-secondary">暂无数据</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {keychips && <Pagination currentPage={keychipPage} totalElements={keychipTotal} onChange={(page) => void loadKeychips(page - 1, keychipPattern)} />}
        </div>
      )}

      <AdminDialog open={createUserOpen} onClose={() => setCreateUserOpen(false)} title="创建用户">
        <div className="d-grid gap-2">
          <input type="text" className="form-control form-control-sm" placeholder="登录名" value={createUsername} onChange={(event) => setCreateUsername(event.target.value)} />
          <input type="text" className="form-control form-control-sm" placeholder="昵称" value={createName} onChange={(event) => setCreateName(event.target.value)} />
          <input type="email" className="form-control form-control-sm" placeholder="电子邮箱" value={createEmail} onChange={(event) => setCreateEmail(event.target.value)} />
          <input type="password" className="form-control form-control-sm" placeholder="密码" value={createPassword} onChange={(event) => setCreatePassword(event.target.value)} />
          <button
            type="button"
            className={`btn btn-primary btn-sm${creatingUser ? ' disabled' : ''}`}
            onClick={() => {
              void createUser();
              setCreateUserOpen(false);
            }}
          >创建</button>
        </div>
      </AdminDialog>

      <AdminDialog open={selectedItem !== null} onClose={closeUser} title={selectedUsername} scrollable>
        {selectedItem && (
          <>
            <div className="table-responsive mb-3">
              <table className="table table-sm small mb-0 align-middle"><tbody>
                <tr>
                  <th className="text-nowrap text-secondary fw-normal">ID</th><td>{selectedItem.user.id}</td>
                  <th className="text-nowrap text-secondary fw-normal">登录名</th><td>{selectedItem.user.username}</td>
                </tr>
                <tr>
                  <th className="text-nowrap text-secondary fw-normal">昵称</th><td>{selectedItem.user.name}</td>
                  <th className="text-nowrap text-secondary fw-normal">邮箱</th><td className="text-break">{selectedItem.user.email}</td>
                </tr>
                <tr>
                  <th className="text-nowrap text-secondary fw-normal">注册时间</th><td>{formatJoinedAt(selectedProfile?.joinedAt)}</td>
                  <th className="text-nowrap text-secondary fw-normal">两步验证</th>
                  <td><span className={`badge rounded-pill ${selectedProfile?.totpEnabled ? 'bg-success' : 'bg-secondary'}`}>{selectedProfile?.totpEnabled ? '已启用' : '未启用'}</span></td>
                </tr>
                <tr>
                  <th className="text-nowrap text-secondary fw-normal">角色</th>
                  <td>{selectedItem.user.roles?.length ? selectedItem.user.roles.map((role) => role.name).join('、') : '—'}</td>
                  <th className="text-nowrap text-secondary fw-normal">关联账户</th>
                  <td>
                    {selectedItem.user.oauth2s?.length
                      ? selectedItem.user.oauth2s.map((oauth) => <div className="text-break" key={oauth.id}>{oauth.provider}：{oauth.email}</div>)
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <th className="text-nowrap text-secondary fw-normal">EULA 当前版本</th><td>{selectedProfile?.eulaStatus?.currentVersion ?? '—'}</td>
                  <th className="text-nowrap text-secondary fw-normal">用户同意版本</th>
                  <td>
                    {selectedProfile?.eulaStatus?.acceptedVersion ?? '未同意'}
                    {selectedProfile?.eulaStatus?.required && <span className="badge bg-warning text-dark ms-1">需要重新同意</span>}
                  </td>
                </tr>
              </tbody></table>
            </div>
            <div className="fw-bold small mb-1">卡片与游戏档案</div>
            <div className="table-responsive mb-3">
              <table className="table table-sm small mb-0 align-middle">
                <thead><tr><th className="text-nowrap">ExtId</th><th className="text-nowrap">Access Code</th><th className="text-nowrap">关联 Access Code</th><th className="text-nowrap">默认</th><th className="text-nowrap">CHUNITHM</th><th className="text-nowrap">O.N.G.E.K.I.</th><th className="text-nowrap">maimai DX</th></tr></thead>
                <tbody>
                  {selectedItem.gameProfiles.map((profile, index) => (
                    <tr key={`${profile.card?.extId ?? 'card'}-${index}`}>
                      <td className="text-nowrap">{profile.card?.extId}</td>
                      <td className="text-nowrap font-monospace">{profile.card?.luid}</td>
                      <td className="font-monospace">
                        {profile.card?.cardExternalList?.length
                          ? profile.card.cardExternalList.map((external) => <div className="text-nowrap" key={external.id}>{external.luid}</div>)
                          : <span className="text-secondary">—</span>}
                      </td>
                      <td>{profile.card?.default ? '✓' : ''}</td>
                      <td>{profile.chusan ? <>{profile.chusan.userName} <span className="text-secondary">({formatRating(profile.chusan.playerRating)})</span></> : <span className="text-secondary">—</span>}</td>
                      <td>{profile.ongeki ? <>{profile.ongeki.userName} <span className="text-secondary">({formatRating(profile.ongeki.playerRating)})</span></> : <span className="text-secondary">—</span>}</td>
                      <td>{profile.maimai2 ? <>{profile.maimai2.userName} <span className="text-secondary">({profile.maimai2.playerRating})</span></> : <span className="text-secondary">—</span>}</td>
                    </tr>
                  ))}
                  {!selectedItem.gameProfiles.length && <tr><td colSpan={7} className="text-center text-secondary">未绑定卡片</td></tr>}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm mb-2 me-1"
              disabled={loginAsPending || impersonation !== null}
              aria-busy={loginAsPending}
              onClick={() => loginAs(selectedUsername)}
            >夺舍</button>
            {!isAdminTarget(selectedItem) && (
              <button type="button" className={`btn btn-sm mb-2 me-1 ${isBanned(selectedItem) ? 'btn-success' : 'btn-danger'}`} onClick={() => void setAccountBan(selectedItem, !isBanned(selectedItem))}>
                {isBanned(selectedItem) ? '解除封禁' : '封禁账户'}
              </button>
            )}
            <button type="button" className="btn btn-outline-warning btn-sm mb-2 me-1" onClick={() => void revokeSessions(selectedUsername)}>撤销全部会话</button>
            {selectedProfile?.totpEnabled && <button type="button" className="btn btn-outline-danger btn-sm mb-2 me-1" onClick={() => void resetTotp(selectedUsername)}>重置两步验证</button>}
            <button type="button" className="btn btn-outline-secondary btn-sm mb-2" onClick={() => openRawJson(selectedItem)}>原始 JSON</button>
            <hr className="my-2" />
            <div className="fw-bold small mb-1">游戏封禁与删档</div>
            {selectedItem.gameProfiles.map((profile, index) => (
              <div className="border rounded p-2 mb-2" key={`ops-${profile.card.extId}-${index}`}>
                <div className="small fw-bold mb-1">ExtId {profile.card.extId}</div>
                {profile.chusan && <GameBanRow data={profile.chusan} extId={profile.card.extId} game="CHUSAN" label="Chusan" onSave={(game, extId, status) => void setGameBan(selectedUsername, game, extId, status)} onDelete={(game, extId) => void deleteGameSave(selectedUsername, game, extId)} />}
                {profile.maimai2 && <GameBanRow data={profile.maimai2} extId={profile.card.extId} game="MAIMAI2" label="Maimai2" onSave={(game, extId, status) => void setGameBan(selectedUsername, game, extId, status)} onDelete={(game, extId) => void deleteGameSave(selectedUsername, game, extId)} />}
                {profile.ongeki && <GameBanRow data={profile.ongeki} extId={profile.card.extId} game="ONGEKI" label="Ongeki" onSave={(game, extId, status) => void setGameBan(selectedUsername, game, extId, status)} onDelete={(game, extId) => void deleteGameSave(selectedUsername, game, extId)} />}
              </div>
            ))}
            {Boolean(selectedProfile?.passkeys?.length || selectedProfile?.oauthIdentities?.length) && (
              <>
                <div className="fw-bold small mb-1">凭据恢复</div>
                {selectedProfile?.passkeys?.map((passkey) => <button type="button" className="btn btn-outline-danger btn-sm me-1 mb-1" key={passkey.id} onClick={() => void deletePasskey(selectedUsername, passkey.id)}>删除 Passkey：{passkey.nick}</button>)}
                {selectedProfile?.oauthIdentities?.map((oauth) => <button type="button" className="btn btn-outline-danger btn-sm me-1 mb-1" key={oauth.id} onClick={() => void deleteOauth(selectedUsername, oauth.id)}>解绑 {oauth.provider}：{oauth.email}</button>)}
              </>
            )}
            <hr className="my-2" />
            <div className="fw-bold small mb-1">卡片操作</div>
            <div className="input-group input-group-sm mb-2">
              <input type="text" className="form-control" placeholder="卡号 (Access Code)" value={cardAccessCode} onChange={(event) => setCardAccessCode(event.target.value)} />
              <button type="button" className="btn btn-outline-primary" onClick={() => void cardOperation('api/admin/bindCard', { userName: selectedUsername, accessCode: cardAccessCode })}>绑定</button>
              <button type="button" className="btn btn-outline-danger" onClick={() => void cardOperation('api/admin/unbindCard', { userName: selectedUsername, accessCode: cardAccessCode })}>解绑</button>
            </div>
            <div className="input-group input-group-sm mb-2">
              <input type="text" className="form-control" placeholder="ExtId" value={cardExtId} onChange={(event) => setCardExtId(event.target.value)} />
              <button type="button" className="btn btn-outline-primary" onClick={() => void bindCardViaExtId(selectedUsername)}>通过ExtId绑定</button>
            </div>
            <div className="input-group input-group-sm mb-2">
              <input type="text" className="form-control" placeholder="旧卡号" value={oldAccessCode} onChange={(event) => setOldAccessCode(event.target.value)} />
              <input type="text" className="form-control" placeholder="新卡号" value={newAccessCode} onChange={(event) => setNewAccessCode(event.target.value)} />
              <button type="button" className="btn btn-outline-primary" onClick={() => void cardOperation('api/admin/changeAccessCode', { userName: selectedUsername, accessCode: oldAccessCode, newAccessCode })}>变更卡号</button>
            </div>
            {(selectedProfile?.cards ?? []).map((card) => (
              <div className="border rounded p-2 mb-2 small" key={card.extId}>
                <div className="fw-bold">ExtId {card.extId} {card.defaultCard ? '（默认）' : ''}</div>
                <button type="button" className="btn btn-outline-primary btn-sm me-1" onClick={() => void setDefaultCard(selectedUsername, card.extId)}>设为默认</button>
                <button type="button" className="btn btn-outline-danger btn-sm me-1" onClick={() => void unbindCardByExtId(selectedUsername, card.extId)}>按 ExtId 解绑</button>
                {(card.externalLuids ?? []).map((luid) => <button type="button" className="btn btn-outline-danger btn-sm me-1" key={luid} onClick={() => void removeExternal(selectedUsername, card.extId, luid)}>删除 {luid}</button>)}
              </div>
            ))}
          </>
        )}
      </AdminDialog>

      <AdminDialog
        open={rawJson !== null}
        onClose={() => {
          setRawJson(null);
          setRawJsonUsername('');
        }}
        title={`原始 JSON — ${rawJsonUsername}`}
        scrollable
        size="lg"
        nested
      >
        <pre className="json-view small mb-0" dangerouslySetInnerHTML={{ __html: rawJson ?? '' }} />
      </AdminDialog>

      <AdminDialog
        bodyClassName="p-0"
        fullscreen
        headerAction={(
          <button
            ref={impersonationCloseButtonRef}
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={closeImpersonation}
          >返回管理员账户</button>
        )}
        headerClassName="py-2 d-flex align-items-center"
        initialFocusRef={impersonationCloseButtonRef}
        onClose={closeImpersonation}
        open={impersonation !== null}
        staticBackdrop
        title={`正在以 ${impersonation?.username ?? ''} 的身份操作`}
        titleClassName="me-auto"
      >
        {impersonation && <iframe ref={impersonationFrame} className="impersonation-frame" src={impersonation.url} title={`Impersonating ${impersonation.username}`} />}
      </AdminDialog>
    </div>
  );
}
