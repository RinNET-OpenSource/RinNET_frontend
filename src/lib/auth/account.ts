import { createStore } from '@/lib/store';
import { inIframe } from '@/lib/utils';

/** 等价旧版 account.service.ts：token 存储（iframe 夺舍场景使用 sessionStorage） */

export const IMPERSONATION_KEY = 'impersonatedAccount';

export interface Account {
  tokenType: string;
  accessToken: string;
  refreshToken: string;
}

const storage: Storage = inIframe() ? sessionStorage : localStorage;
const storageKey: string = inIframe() ? IMPERSONATION_KEY : 'currentAccount';

function readStored(): Account | null {
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
