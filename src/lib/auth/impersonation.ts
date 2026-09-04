import { inIframe } from '@/lib/utils';
import type { Account } from '@/lib/auth/account';

export const IMPERSONATION_KEY = 'impersonatedAccount';
export const IMPERSONATED_USER_KEY = 'impersonatedUser';
export const IMPERSONATE_REQUEST = 'rinnet-impersonate-request';
export const IMPERSONATE_GRANT = 'rinnet-impersonate-grant';

const MAX_GRANT_ATTEMPTS = 8;
const GRANT_RETRY_DELAY_MS = 250;

export type ImpersonationBootstrapResult = 'ready' | 'redirecting' | 'failed';

/** True only for a newly opened same-origin impersonation iframe. */
export function isImpersonationBootstrapFrame(): boolean {
  return inIframe() && Boolean(new URLSearchParams(window.location.search).get('imp'));
}

export function isTrustedImpersonationGrant(
  event: MessageEvent,
  parentWindow: Window,
  nonce: string,
): boolean {
  return event.origin === window.location.origin
    && event.source === parentWindow
    && event.data?.type === IMPERSONATE_GRANT
    && event.data?.nonce === nonce
    && Boolean(event.data?.account);
}

let bootstrapPromise: Promise<ImpersonationBootstrapResult> | null = null;

function isAccountPayload(value: unknown): value is Account {
  if (!value || typeof value !== 'object') return false;
  const account = value as Partial<Account>;
  return typeof account.accessToken === 'string'
    && account.accessToken.length > 0
    && typeof account.refreshToken === 'string'
    && account.refreshToken.length > 0
    && typeof account.tokenType === 'string'
    && account.tokenType.length > 0;
}

function clearImpersonationStorage() {
  try {
    sessionStorage.removeItem(IMPERSONATION_KEY);
    sessionStorage.removeItem(IMPERSONATED_USER_KEY);
  } catch {
    // A sandboxed iframe may deny storage access; the grant still remains
    // protected by the nonce and source checks below.
  }
}

/**
 * Receives a temporary account from the parent Admin page when this application
 * is running inside the same-origin impersonation iframe.
 */
export function bootstrapImpersonation(): Promise<ImpersonationBootstrapResult> {
  if (!isImpersonationBootstrapFrame()) return Promise.resolve('ready');
  if (bootstrapPromise) return bootstrapPromise;

  const nonce = new URLSearchParams(window.location.search).get('imp');
  if (!nonce) return Promise.resolve('ready');

  clearImpersonationStorage();
  bootstrapPromise = new Promise<ImpersonationBootstrapResult>((resolve) => {
    let attempts = 0;
    let finished = false;
    let retryTimer: number | null = null;

    const finish = (result: ImpersonationBootstrapResult) => {
      if (finished) return;
      finished = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      window.removeEventListener('message', onMessage);
      if (result === 'failed') clearImpersonationStorage();
      resolve(result);
    };

    const onMessage = (event: MessageEvent) => {
      if (!isTrustedImpersonationGrant(event, window.parent, nonce)
        || !isAccountPayload(event.data?.account)) return;
      try {
        sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(event.data.account));
        sessionStorage.removeItem(IMPERSONATED_USER_KEY);
      } catch {
        finish('failed');
        return;
      }
      finish('redirecting');
      window.location.replace(`${window.location.origin}/`);
    };

    const requestGrant = () => {
      if (finished) return;
      if (attempts >= MAX_GRANT_ATTEMPTS) {
        finish('failed');
        return;
      }
      attempts += 1;
      window.parent.postMessage({ type: IMPERSONATE_REQUEST, nonce }, window.location.origin);
      retryTimer = window.setTimeout(requestGrant, GRANT_RETRY_DELAY_MS);
    };

    window.addEventListener('message', onMessage);
    requestGrant();
  });
  return bootstrapPromise;
}
