import { api } from '@/lib/api/client';
import { createStore } from '@/lib/store';
import { getAccount } from '@/lib/auth/account';
import type { User } from '@/lib/models';
import { notice } from '@/lib/message';

/** 等价旧版 user.service.ts */

export const userStore = createStore<User | null>(readCached());

function readCached(): User | null {
  try {
    return JSON.parse(localStorage.getItem('currentUser') ?? 'null');
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
          localStorage.setItem('currentUser', JSON.stringify(user));
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
  localStorage.removeItem('currentUser');
  userStore.set(null);
}

export function isAdmin(): boolean {
  return getCurrentUser()?.roles?.some((r) => r.name === 'ROLE_ADMIN') ?? false;
}
