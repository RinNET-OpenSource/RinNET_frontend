import { api } from '@/lib/api/client';
import { createStore } from '@/lib/store';
import { getAccount } from '@/lib/auth/account';
import { IMPERSONATED_USER_KEY } from '@/lib/auth/account';
import { inIframe } from '@/lib/utils';
import { isImpersonationBootstrapFrame } from '@/lib/auth/impersonation';
import type { User } from '@/lib/models';
import { notice } from '@/lib/message';

/** 等价旧版 user.service.ts */

const iframe = inIframe();
const bootstrapFrame = iframe && isImpersonationBootstrapFrame();
const storage: Storage = iframe ? sessionStorage : localStorage;
const storageKey = iframe ? IMPERSONATED_USER_KEY : 'currentUser';

export const userStore = createStore<User | null>(readCached());

function readCached(): User | null {
  if (bootstrapFrame) {
    try {
      storage.removeItem(storageKey);
    } catch {
      // The bootstrap handshake will surface storage failures to the entry point.
    }
    return null;
  }
  try {
    return JSON.parse(storage.getItem(storageKey) ?? 'null');
  } catch {
    return null;
  }
}

let loadPromise: Promise<any | null> | null = null;

export function getCurrentUser(): User | null {
  return userStore.get();
}

if (!getAccount()) {
  clearUser();
}

export function loadUser(forceReload = false): Promise<any | null> {
  if (loadPromise && !forceReload) {
    return loadPromise;
  }
  if (forceReload) {
    clearUser();
  }
  loadPromise = api
    .get('api/user/me')
    .then((resp) => {
      if (resp?.status) {
        if (resp.status.code === 92001 && resp.data) {
          const user = resp.data as User;
          user.cards?.forEach((card) => {
            if (card.default) {
              user.defaultCard = card;
            }
          });
          userStore.set(user);
          storage.setItem(storageKey, JSON.stringify(user));
        } else {
          notice(resp.status.message);
        }
      }
      return resp;
    })
    .catch((error) => {
      notice(error?.toString?.() ?? String(error));
      throw error;
    })
    .finally(() => {
      loadPromise = null;
    });
  return loadPromise;
}

export function clearUser() {
  storage.removeItem(storageKey);
  userStore.set(null);
}

export function isAdmin(): boolean {
  return getCurrentUser()?.roles?.some((r) => r.name === 'ROLE_ADMIN') ?? false;
}
