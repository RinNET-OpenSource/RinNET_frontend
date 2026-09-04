import { createStore } from '@/lib/store';
import { inIframe } from '@/lib/utils';
import {
  IMPERSONATED_USER_KEY,
  IMPERSONATION_KEY,
  isImpersonationBootstrapFrame,
} from '@/lib/auth/impersonation';

export { IMPERSONATED_USER_KEY, IMPERSONATION_KEY } from '@/lib/auth/impersonation';

/** 等价旧版 account.service.ts：token 存储（iframe 夺舍场景使用 sessionStorage） */

export interface Account {
  tokenType: string;
  accessToken: string;
  refreshToken: string;
}

const iframe = inIframe();
const bootstrapFrame = iframe && isImpersonationBootstrapFrame();
const storage: Storage = iframe ? sessionStorage : localStorage;
const storageKey: string = iframe ? IMPERSONATION_KEY : 'currentAccount';

if (bootstrapFrame) {
  try {
    // Clear stale state before the account store is hydrated. This module can be
    // evaluated before the main entry point starts the postMessage handshake.
    storage.removeItem(IMPERSONATION_KEY);
    storage.removeItem(IMPERSONATED_USER_KEY);
  } catch {
    // bootstrapImpersonation() will report failure if storage remains unavailable.
  }
}

function readStored(): Account | null {
  if (bootstrapFrame) return null;
  try {
    return JSON.parse(storage.getItem(storageKey) ?? 'null');
  } catch {
    return null;
  }
}

export const accountStore = createStore<Account | null>(readStored());

export function getAccount(): Account | null {
  return accountStore.get();
}

export function setAccount(account: Account | null) {
  if (account) {
    storage.setItem(storageKey, JSON.stringify(account));
  } else {
    storage.removeItem(storageKey);
  }
  accountStore.set(account);
}

export function clearAccount() {
  storage.removeItem(storageKey);
  accountStore.set(null);
}
