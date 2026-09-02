import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * 等价旧版 database.module.ts：同名库 `Aqua` v6，16 个 object store，
 * 索引与旧版完全一致（含 chusanMusic 'sortName' 索引指向 'sotrName' 字段的历史笔误，
 * 保留以避免升级差异）。与旧版共享同一份数据，已登录用户无需重新下载。
 */

interface AquaDB extends DBSchema {
  ongekiCard: { key: string; value: any };
  ongekiCharacter: { key: string; value: any };
  ongekiMusic: { key: string; value: any };
  ongekiSkill: { key: string; value: any };
  ongekiTrophy: { key: string; value: any };
  chusanMusic: { key: string; value: any };
  chusanCharacter: { key: string; value: any };
  chusanTrophy: { key: string; value: any };
  chusanNamePlate: { key: string; value: any };
  chusanSystemVoice: { key: string; value: any };
  chusanStage: { key: string; value: any };
  chusanMapIcon: { key: string; value: any };
  chusanFrame: { key: string; value: any };
  chusanAvatarAcc: { key: string; value: any };
  chusanSymbolChat: { key: string; value: any };
  maimai2Music: { key: string; value: any };
}

export const DB_NAME = 'Aqua';
export const DB_VERSION = 6;

export const STORE_NAMES = [
  'ongekiCard',
  'ongekiCharacter',
  'ongekiMusic',
  'ongekiSkill',
  'ongekiTrophy',
  'chusanMusic',
  'chusanCharacter',
  'chusanTrophy',
  'chusanNamePlate',
  'chusanSystemVoice',
  'chusanMapIcon',
  'chusanFrame',
  'chusanAvatarAcc',
  'chusanSymbolChat',
  'chusanStage',
  'maimai2Music',
] as const;

export type StoreName = (typeof STORE_NAMES)[number];

interface IndexDef {
  name: string;
  keypath: string;
}

const STORE_SCHEMAS: Record<StoreName, { keyPath: string; indexes: IndexDef[] }> = {
  ongekiCard: {
    keyPath: 'id',
    indexes: [
      { name: 'name', keypath: 'name' },
      { name: 'nickName', keypath: 'nickName' },
      { name: 'attribute', keypath: 'attribute' },
      { name: 'charaId', keypath: 'charaId' },
      { name: 'school', keypath: 'school' },
      { name: 'gakuen', keypath: 'gakuen' },
      { name: 'rarity', keypath: 'rarity' },
      { name: 'levelParam', keypath: 'levelParam' },
      { name: 'skillId', keypath: 'skillId' },
      { name: 'chouKaikaSkillId', keypath: 'chouKaikaSkillId' },
      { name: 'cardNumber', keypath: 'cardNumber' },
      { name: 'version', keypath: 'version' },
    ],
  },
  ongekiCharacter: {
    keyPath: 'id',
    indexes: [
      { name: 'name', keypath: 'name' },
      { name: 'cv', keypath: 'cv' },
      { name: 'modelId', keypath: 'modelId' },
    ],
  },
  ongekiMusic: {
    keyPath: 'id',
    indexes: [
      { name: 'name', keypath: 'name' },
      { name: 'sortName', keypath: 'sortName' },
      { name: 'artistName', keypath: 'artistName' },
      { name: 'genre', keypath: 'genre' },
      { name: 'bossCardId', keypath: 'bossCardId' },
      { name: 'bossLevel', keypath: 'bossLevel' },
      { name: 'level0', keypath: 'level0' },
      { name: 'level1', keypath: 'level1' },
      { name: 'level2', keypath: 'level2' },
      { name: 'level3', keypath: 'level3' },
      { name: 'level4', keypath: 'level4' },
    ],
  },
  ongekiSkill: {
    keyPath: 'id',
    indexes: [
      { name: 'name', keypath: 'name' },
      { name: 'sortName', keypath: 'sortName' },
      { name: 'category', keypath: 'category' },
      { name: 'info', keypath: 'info' },
    ],
  },
  ongekiTrophy: {
    keyPath: 'id',
    indexes: [
      { name: 'name', keypath: 'name' },
      { name: 'rarityType', keypath: 'rarityType' },
    ],
  },
  chusanMusic: {
    keyPath: 'musicId',
    indexes: [
      { name: 'name', keypath: 'name' },
      // 历史笔误照搬：索引名 sortName，keypath 为 sotrName
      { name: 'sortName', keypath: 'sotrName' },
      { name: 'artistName', keypath: 'artistName' },
      { name: 'genre', keypath: 'genre' },
      { name: 'releaseVersion', keypath: 'releaseVersion' },
    ],
  },
  chusanCharacter: {
    keyPath: 'id',
    indexes: [
      { name: 'name', keypath: 'name' },
      { name: 'releaseTag', keypath: 'releaseTag' },
      { name: 'worksName', keypath: 'worksName' },
      { name: 'illustratorName', keypath: 'illustratorName' },
      { name: 'addImages', keypath: 'addImages' },
    ],
  },
  chusanTrophy: { keyPath: 'id', indexes: [{ name: 'name', keypath: 'name' }] },
  chusanNamePlate: { keyPath: 'id', indexes: [{ name: 'name', keypath: 'name' }] },
  chusanSystemVoice: { keyPath: 'id', indexes: [{ name: 'name', keypath: 'name' }] },
  chusanStage: { keyPath: 'id', indexes: [{ name: 'name', keypath: 'name' }] },
  chusanMapIcon: { keyPath: 'id', indexes: [{ name: 'name', keypath: 'name' }] },
  chusanFrame: { keyPath: 'id', indexes: [{ name: 'name', keypath: 'name' }] },
  chusanAvatarAcc: {
    keyPath: 'id',
    indexes: [
      { name: 'name', keypath: 'name' },
      { name: 'category', keypath: 'category' },
    ],
  },
  chusanSymbolChat: {
    keyPath: 'id',
    indexes: [
      { name: 'name', keypath: 'name' },
      { name: 'sortName', keypath: 'sortName' },
      { name: 'text', keypath: 'text' },
      { name: 'balloonId', keypath: 'balloonId' },
      { name: 'sceneIds', keypath: 'sceneIds' },
    ],
  },
  maimai2Music: {
    keyPath: 'musicId',
    indexes: [
      { name: 'musicId', keypath: 'musicId' },
      { name: 'name', keypath: 'name' },
      { name: 'sortName', keypath: 'sortName' },
      { name: 'artistName', keypath: 'artistName' },
      { name: 'genreId', keypath: 'genreId' },
      { name: 'romVersion', keypath: 'romVersion' },
      { name: 'addVersion', keypath: 'addVersion' },
    ],
  },
};

let dbPromise: Promise<IDBPDatabase<AquaDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<AquaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AquaDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // 旧版 v3 迁移：删除 legacy store（fresh 创建场景下 contains 检查会跳过）
        if (oldVersion < 3) {
          for (const legacy of ['divaPv', 'divaModule', 'divaCustomize', 'chuniMusic', 'chuniCharacter', 'chuniSkill']) {
            if (db.objectStoreNames.contains(legacy as any)) {
              db.deleteObjectStore(legacy as any);
            }
          }
        }
        for (const name of STORE_NAMES) {
          if (!Array.from(db.objectStoreNames as unknown as Iterable<string>).includes(name)) {
            const store = db.createObjectStore(name as any, {
              keyPath: STORE_SCHEMAS[name].keyPath,
            }) as unknown as IDBObjectStore;
            for (const idx of STORE_SCHEMAS[name].indexes) {
              store.createIndex(idx.name, idx.keypath, { unique: false });
            }
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function dbCount(store: StoreName): Promise<number> {
  const db = await getDb();
  return db.count(store as any);
}

export async function dbBulkAdd(store: StoreName, items: any[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(store as any, 'readwrite');
  const os = tx.objectStore(store as any);
  for (const item of items) {
    void os.add(item);
  }
  await tx.done;
}

export async function dbClear(store: StoreName): Promise<void> {
  const db = await getDb();
  await db.clear(store as any);
}

export async function dbGetAll<T = any>(store: StoreName): Promise<T[]> {
  const db = await getDb();
  return db.getAll(store as any) as Promise<T[]>;
}

export async function dbGetByKey<T = any>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await getDb();
  return (db as any).get(store, key) as Promise<T | undefined>;
}

export async function dbGetByIndex<T = any>(store: StoreName, index: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await getDb();
  return (db as any).getFromIndex(store, index, key) as Promise<T | undefined>;
}
