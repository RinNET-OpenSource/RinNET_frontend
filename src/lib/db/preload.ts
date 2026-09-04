import { api } from '@/lib/api/client';
import { createStore } from '@/lib/store';
import { notice } from '@/lib/message';
import { dbBulkAdd, dbClear, dbCount, STORE_NAMES, type StoreName } from '@/lib/db/db';

/** 等价旧版 preload.service.ts：16 个游戏静态数据目录的 IndexedDB 预载与版本管理 */

export type PreloadState = 'OK' | 'Downloading' | 'Error';

const LOADERS: Array<{ store: StoreName; url: string }> = [
  { store: 'ongekiCard', url: 'api/game/ongeki/data/cardList' },
  { store: 'ongekiCharacter', url: 'api/game/ongeki/data/charaList' },
  { store: 'ongekiMusic', url: 'api/game/ongeki/data/musicList' },
  { store: 'ongekiSkill', url: 'api/game/ongeki/data/skillList' },
  { store: 'ongekiTrophy', url: 'api/game/ongeki/data/trophyList' },
  { store: 'chusanMusic', url: 'api/game/chuni/v2/data/music' },
  { store: 'chusanCharacter', url: 'api/game/chuni/v2/data/character' },
  { store: 'chusanTrophy', url: 'api/game/chuni/v2/data/trophy' },
  { store: 'chusanNamePlate', url: 'api/game/chuni/v2/data/nameplate' },
  { store: 'chusanSystemVoice', url: 'api/game/chuni/v2/data/sysvoice' },
  { store: 'chusanMapIcon', url: 'api/game/chuni/v2/data/mapicon' },
  { store: 'chusanFrame', url: 'api/game/chuni/v2/data/frame' },
  { store: 'chusanAvatarAcc', url: 'api/game/chuni/v2/data/avatar' },
  { store: 'chusanSymbolChat', url: 'api/game/chuni/v2/data/symbolChatInfo' },
  { store: 'chusanStage', url: 'api/game/chuni/v2/data/stage' },
  { store: 'maimai2Music', url: 'api/game/maimai2/data/musicList' },
];

export const preloadStates = createStore<Record<string, PreloadState>>({});
export const dbVersionStore = createStore<number>(+(localStorage.getItem('dbVersion') ?? 0) || 0);
export const checkingUpdate = createStore<'checking' | 'completed' | 'error' | null>(null);

export function loadAll() {
  for (const { store, url } of LOADERS) {
    void loader(store, url);
  }
}

async function loader(store: StoreName, url: string) {
  try {
    const count = await dbCount(store);
    if (count > 0) {
      // 已有数据
      preloadStates.set({ ...preloadStates.get(), [store]: 'OK' });
      return;
    }
    preloadStates.set({ ...preloadStates.get(), [store]: 'Downloading' });
    const response = await api.get(url);
    // API endpoints are inconsistent across deployments: static catalogs may
    // be returned directly or wrapped in a `{ data: [...] }` envelope.
    const data = Array.isArray(response) ? response : response?.data;
    if (!Array.isArray(data)) throw new Error(`Invalid ${store} catalog response`);
    await dbBulkAdd(store, data);
    preloadStates.set({ ...preloadStates.get(), [store]: 'OK' });
  } catch (error) {
    console.error(error);
    preloadStates.set({ ...preloadStates.get(), [store]: 'Error' });
  }
}

export async function clearDb() {
  for (const store of STORE_NAMES) {
    await dbClear(store);
  }
}

export async function reload() {
  await clearDb();
  localStorage.setItem('dbVersion', '0');
  window.location.reload();
}

export async function checkDbUpdate() {
  checkingUpdate.set('checking');
  try {
    const resp = await api.get('api/static/dbVersion');
    if (resp?.state?.toLowerCase().includes('success') && resp.version?.major != null) {
      const latestVersion: number = resp.version.major;
      const localVersion = dbVersionStore.get();
      if (latestVersion > localVersion) {
        await clearDb();
        localStorage.setItem('dbVersion', latestVersion.toString());
        window.location.reload();
      } else {
        loadAll();
        checkingUpdate.set('completed');
      }
    }
  } catch (error) {
    loadAll();
    checkingUpdate.set('error');
    notice(String(error));
  }
}
