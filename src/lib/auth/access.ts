import { api } from '@/lib/api/client';
import { StatusCode } from '@/lib/models';
import { createStore } from '@/lib/store';
import { getAccount } from '@/lib/auth/account';

/** 等价旧版 account-access.service.ts */

export interface AccountAccessStatus {
  banned: boolean;
  eulaRequired: boolean;
  currentEulaVersion?: number;
  acceptedEulaVersion: number | null;
  appeal: string;
}

export interface EulaDocument {
  id: number;
  version: number;
  title: string;
  content: string;
  publishedAt: string;
  draft?: boolean;
}

export const accessStatusStore = createStore<AccountAccessStatus | null>(null);
let loadPromise: Promise<AccountAccessStatus | null> | null = null;

export function getAccessStatus(): AccountAccessStatus | null {
  return accessStatusStore.get();
}

window.addEventListener('rinnet-account-access-error', ((event: CustomEvent<string>) => {
  if (event.detail === 'EULA_REQUIRED') requireEula();
  if (event.detail === 'ACCOUNT_BANNED') markBanned();
}) as EventListener);

export async function restoreAccess(force = false): Promise<AccountAccessStatus | null> {
  if (!getAccount()) {
    clearAccess();
    return null;
  }
  if (getAccessStatus() && !force) return getAccessStatus();
  if (!loadPromise) {
    loadPromise = api
      .get('api/account/status')
      .then((resp) => {
        accessStatusStore.set(resp.data as AccountAccessStatus);
        return getAccessStatus();
      })
      .finally(() => {
        loadPromise = null;
      });
  }
  return loadPromise;
}

export function currentEula(): Promise<EulaDocument> {
  return api.get('api/eula/current').then((resp) => resp.data);
}

export async function acceptEula(version: number): Promise<boolean> {
  const resp = await api.post('api/account/eula/accept', { version });
  if (resp?.status?.code === StatusCode.OK) await restoreAccess(true);
  return !getAccessStatus()?.eulaRequired;
}

export function requireEula() {
  const previous = getAccessStatus();
  accessStatusStore.set({
    banned: false,
    eulaRequired: true,
    currentEulaVersion: previous?.currentEulaVersion,
    acceptedEulaVersion: previous?.acceptedEulaVersion ?? null,
    appeal: previous?.appeal ?? 'QQ群 295954906',
  });
}

export function markBanned() {
  const previous = getAccessStatus();
  accessStatusStore.set({
    banned: true,
    eulaRequired: false,
    currentEulaVersion: previous?.currentEulaVersion,
    acceptedEulaVersion: previous?.acceptedEulaVersion ?? null,
    appeal: previous?.appeal ?? 'QQ群 295954906',
  });
}

export function clearAccess() {
  accessStatusStore.set(null);
}
