import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { compareVersions } from 'compare-versions';
import { api } from '@/lib/api/client';
import { dbGetAll } from '@/lib/db/db';
import { preloadStates } from '@/lib/db/preload';
import { padDigits } from '@/lib/format';
import { notice } from '@/lib/message';
import { useStore } from '@/lib/store';
import { getCurrentUser } from '@/lib/user';
import { assetsHost, enableImages } from '@/lib/utils';
import {
  ChuniV2SymbolChatDialog,
  ChuniV2UserBoxItemDialog,
} from './ChuniV2UserBoxDialogs';
import type {
  ChuniV2MasterItem,
  ChuniV2MasterSymbolChat,
  ChuniV2UserBoxCatalogs,
  ChuniV2UserBoxProfile,
  ChuniV2UserBoxSelection,
  ChuniV2UserSymbolChat,
} from './userbox-models';
import './ChuniV2UserBoxPage.css';

const FAVORITE_KINDS = [
  { kind: 1, name: 'Nameplate' },
  { kind: 3, name: 'Trophy' },
  { kind: 8, name: 'MapIcon' },
  { kind: 9, name: 'SystemVoice' },
  { kind: 13, name: 'Stage' },
] as const;

const SCENES = ['Matching', 'OverviewSelf', 'OverviewRival', 'Result', 'BattleResult'] as const;
const SYSTEM_VOICE_IDS = [34, 0, 1, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 49, 50, 51];

function mergeSymbolChats(input: ChuniV2UserSymbolChat[]): ChuniV2UserSymbolChat[] {
  const result = Array.from({ length: 20 }, (_, index) => ({
    sceneId: Math.floor(index / 4) + 1,
    orderId: index % 4,
    symbolChatId: 1,
  }));
  for (const item of input) {
    const current = result.find(
      (entry) => entry.sceneId === item.sceneId && entry.orderId === item.orderId,
    );
    if (current) current.symbolChatId = item.symbolChatId;
  }
  return result;
}

function favoriteImage(kind: number, itemId: number): string | null {
  if (kind === 1) return `${assetsHost}assets/chuni/namePlate/CHU_UI_NamePlate_${padDigits(itemId, 8)}.webp`;
  if (kind === 8) return `${assetsHost}assets/chuni/mapIcon/CHU_UI_MapIcon_${padDigits(itemId, 8)}.webp`;
  if (kind === 9) return `${assetsHost}assets/chuni/systemVoice/CHU_UI_SystemVoice_${padDigits(itemId, 8)}.webp`;
  if (kind === 13) return `${assetsHost}assets/chuni/stage/CHU_UI_Stage_${padDigits(itemId, 5)}.webp`;
  return null;
}

function equipmentImage(name: string, profile: ChuniV2UserBoxProfile): string | null {
  if (name === 'Nameplate') return `${assetsHost}assets/chuni/namePlate/CHU_UI_NamePlate_${padDigits(profile.nameplateId, 8)}.webp`;
  if (name === 'MapIcon') return `${assetsHost}assets/chuni/mapIcon/CHU_UI_MapIcon_${padDigits(profile.mapIconId, 8)}.webp`;
  if (name === 'SystemVoice') return `${assetsHost}assets/chuni/systemVoice/CHU_UI_SystemVoice_${padDigits(profile.voiceId, 8)}.webp`;
  if (name === 'Stage') return `${assetsHost}assets/chuni/stage/CHU_UI_Stage_${padDigits(profile.stageId ?? 99_999, 5)}.webp`;
  const avatarIds: Record<string, number> = {
    AvatarWear: profile.avatarWear,
    AvatarHead: profile.avatarHead,
    AvatarFace: profile.avatarFace,
    AvatarItem: profile.avatarItem,
    AvatarBack: profile.avatarBack,
  };
  if (name in avatarIds) {
    return `${assetsHost}assets/chuni/avatar/CHU_UI_Avatar_Icon_${padDigits(avatarIds[name], 8)}.webp`;
  }
  return null;
}

/** Equivalent to the legacy Chunithm v2 user-box/equipment page. */
export function ChuniV2UserBoxPage() {
  const { t } = useTranslation();
  const catalogStates = useStore(preloadStates);
  const [profile, setProfile] = useState<ChuniV2UserBoxProfile | null>(null);
  const [catalogs, setCatalogs] = useState<ChuniV2UserBoxCatalogs>({});
  const [allSymbolChats, setAllSymbolChats] = useState<ChuniV2MasterSymbolChat[]>([]);
  const [symbolChatInfo, setSymbolChatInfo] = useState<ChuniV2UserSymbolChat[]>([]);
  const [selectedScene, setSelectedScene] = useState(1);
  const [showAllItems, setShowAllItems] = useState(false);
  const [tab, setTab] = useState<'equip' | 'favorite'>('equip');
  const [favorites, setFavorites] = useState<Record<number, number[]>>({});
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [selection, setSelection] = useState<ChuniV2UserBoxSelection | null>(null);
  const [symbolSelection, setSymbolSelection] = useState<ChuniV2UserSymbolChat | null>(null);

  const aimeId = String(getCurrentUser()?.defaultCard?.extId ?? '');

  const loadProfile = useCallback(async () => {
    try {
      const data = (await api.get('api/game/chuni/v2/profile', { aimeId })) as ChuniV2UserBoxProfile;
      setProfile(data);
    } catch (error) {
      notice(String(error));
    }
  }, [aimeId]);

  useEffect(() => {
    void loadProfile();
    void api
      .get('api/game/chuni/v2/profile/symbolChatInfo', { aimeId })
      .then((data) => setSymbolChatInfo(mergeSymbolChats((data ?? []) as ChuniV2UserSymbolChat[])))
      .catch((error) => notice(String(error)));
  }, [aimeId, loadProfile]);

  const catalogsReady = [
    'chusanNamePlate',
    'chusanTrophy',
    'chusanMapIcon',
    'chusanSystemVoice',
    'chusanStage',
    'chusanAvatarAcc',
    'chusanSymbolChat',
  ].every((store) => catalogStates[store] === 'OK');

  useEffect(() => {
    if (!catalogsReady) return;
    let active = true;
    void Promise.all([
      dbGetAll<ChuniV2MasterItem>('chusanNamePlate'),
      dbGetAll<ChuniV2MasterItem>('chusanTrophy'),
      dbGetAll<ChuniV2MasterItem>('chusanMapIcon'),
      dbGetAll<ChuniV2MasterItem>('chusanSystemVoice'),
      dbGetAll<ChuniV2MasterItem>('chusanStage'),
      dbGetAll<ChuniV2MasterItem>('chusanAvatarAcc'),
      dbGetAll<ChuniV2MasterSymbolChat>('chusanSymbolChat'),
    ])
      .then(([nameplates, trophies, mapIcons, voices, stages, avatar, chats]) => {
        if (!active) return;
        setCatalogs({
          1: nameplates,
          3: trophies,
          8: mapIcons,
          9: voices,
          11: avatar,
          13: stages,
        });
        setAllSymbolChats(chats);
      })
      .catch((error) => active && notice(String(error)));
    return () => {
      active = false;
    };
  }, [catalogsReady]);

  const supportsMate = Boolean(profile?.lastRomVersion && compareVersions(profile.lastRomVersion, '2.50.00') >= 0);

  const customItems = useMemo(() => {
    if (!profile) return [];
    const name = (kind: number, id: number) =>
      catalogs[kind]?.find((item) => item.id === id)?.name ?? 'Unknown';
    const items: Array<{
      name: string;
      value: string;
      selection: ChuniV2UserBoxSelection;
    }> = [
      { name: 'Nameplate', value: name(1, profile.nameplateId), selection: { itemKind: 1, itemId: profile.nameplateId, showAllItems, mode: 'equip' } },
      { name: 'Trophy', value: name(3, profile.trophyId), selection: { itemKind: 3, itemId: profile.trophyId, showAllItems, mode: 'equip', trophySlot: 0 } },
    ];
    if (compareVersions(profile.lastRomVersion, '2.30.00') >= 0) {
      items.push(
        { name: 'TrophySub1', value: name(3, profile.trophyIdSub1), selection: { itemKind: 3, itemId: profile.trophyIdSub1, showAllItems, mode: 'equip', trophySlot: 1 } },
        { name: 'TrophySub2', value: name(3, profile.trophyIdSub2), selection: { itemKind: 3, itemId: profile.trophyIdSub2, showAllItems, mode: 'equip', trophySlot: 2 } },
      );
    }
    items.push(
      { name: 'MapIcon', value: name(8, profile.mapIconId), selection: { itemKind: 8, itemId: profile.mapIconId, showAllItems, mode: 'equip' } },
      { name: 'SystemVoice', value: name(9, profile.voiceId), selection: { itemKind: 9, itemId: profile.voiceId, showAllItems, mode: 'equip' } },
    );
    if (supportsMate) {
      const stageId = profile.stageId ?? 99_999;
      items.push({ name: 'Stage', value: name(13, stageId), selection: { itemKind: 13, itemId: stageId, showAllItems, mode: 'equip' } });
    }
    for (const [itemName, itemId, category] of [
      ['AvatarWear', profile.avatarWear, 1],
      ['AvatarHead', profile.avatarHead, 2],
      ['AvatarFace', profile.avatarFace, 3],
      ['AvatarItem', profile.avatarItem, 5],
      ['AvatarBack', profile.avatarBack, 7],
    ] as const) {
      items.push({
        name: itemName,
        value: name(11, itemId),
        selection: { itemKind: 11, itemId, category, showAllItems, mode: 'equip' },
      });
    }
    return items;
  }, [catalogs, profile, showAllItems, supportsMate]);

  async function selectTab(nextTab: 'equip' | 'favorite') {
    setTab(nextTab);
    if (nextTab !== 'favorite' || favoritesLoaded) return;
    setFavoritesLoaded(true);
    const entries = await Promise.all(
      FAVORITE_KINDS.map(async ({ kind }) => {
        const data = (await api.get(`api/game/chuni/v2/favorite-collection/${kind}`, {
          aimeId,
        })) as Array<{ itemId: number }>;
        return [kind, (data ?? []).map((item) => item.itemId)] as const;
      }),
    ).catch((error) => {
      notice(String(error));
      return [] as Array<readonly [number, number[]]>;
    });
    setFavorites(Object.fromEntries(entries));
  }

  async function applyEquipment(current: ChuniV2UserBoxSelection, itemId: number) {
    let endpoint = '';
    let body: Record<string, string | number> = { aimeId };
    if (current.itemKind === 11) {
      endpoint = 'api/game/chuni/v2/profile/avatar';
      body = { aimeId, category: current.category ?? 0, accId: itemId };
    } else if (current.itemKind === 1) {
      endpoint = 'api/game/chuni/v2/profile/plate';
      body = { aimeId, nameplateId: itemId };
    } else if (current.itemKind === 3) {
      endpoint = 'api/game/chuni/v2/profile/trophy';
      const key = current.trophySlot === 1 ? 'trophyIdSub1' : current.trophySlot === 2 ? 'trophyIdSub2' : 'trophyId';
      body = { aimeId, [key]: itemId };
    } else if (current.itemKind === 8) {
      endpoint = 'api/game/chuni/v2/profile/mapicon';
      body = { aimeId, mapiconId: itemId };
    } else if (current.itemKind === 9) {
      endpoint = 'api/game/chuni/v2/profile/sysvoice';
      body = { aimeId, voiceId: itemId };
    } else if (current.itemKind === 13) {
      endpoint = 'api/game/chuni/v2/profile/stageId';
      body = { aimeId, stageId: itemId };
    }
    if (!endpoint) return;
    await api.put(endpoint, body);
    notice(t('ChuniV2.UserBoxPage.MessageSuccess'));
    await loadProfile();
  }

  function previewVoice() {
    if (!profile) return;
    const id = SYSTEM_VOICE_IDS[Math.floor(Math.random() * SYSTEM_VOICE_IDS.length)];
    const audio = new Audio(
      `${assetsHost}assets/chuni/systemVoice/systemvoice${padDigits(profile.voiceId, 4)}/000${padDigits(id, 2)}.wav`,
    );
    audio.volume = 0.2;
    void audio.play().catch(() => undefined);
  }

  function symbolChat(sceneId: number, orderId: number) {
    const equipped = symbolChatInfo.find(
      (item) => item.sceneId === sceneId && item.orderId === orderId,
    );
    return allSymbolChats.find((item) => item.id === equipped?.symbolChatId);
  }

  return (
    <div className="content chuni-v2-userbox-page">
      <h1 className="page-heading">{t('ChuniV2.UserBoxPage.Title')}</h1>

      {supportsMate && (
        <div className="row justify-content-start align-items-center g-1 mb-3">
          <div className="col-auto">
            <button className={`tab-selector${tab === 'equip' ? ' tab-selector-active' : ''}`} onClick={() => void selectTab('equip')}>
              {t('ChuniV2.UserBoxPage.TabEquip')}
            </button>
          </div>
          <div className="col-auto">
            <button className={`tab-selector${tab === 'favorite' ? ' tab-selector-active' : ''}`} onClick={() => void selectTab('favorite')}>
              {t('ChuniV2.UserBoxPage.TabFavorite')}
            </button>
          </div>
        </div>
      )}

      {tab === 'favorite' && (
        <div className="chuni-v2-userbox-favorites">
          <p className="small text-secondary">{t('ChuniV2.UserBoxPage.FavoriteTip')}</p>
          <div className="row g-2 mb-3 row-cols-1 row-cols-md-2">
            {FAVORITE_KINDS.map((entry) => (
              <div className="col" key={entry.kind}>
                <div className="card p-0 h-100 favorite-card">
                  <div className="card-header item-title text-light d-flex justify-content-center align-items-center py-1">
                    <span className="m-0">{t(`ChuniV2.UserBoxPage.${entry.name}`)}</span>
                  </div>
                  <div className="card-body">
                    <p className="small text-secondary mb-2">
                      {t('ChuniV2.UserBoxPage.FavoriteCount', { count: favorites[entry.kind]?.length ?? 0 })}
                    </p>
                    {favoriteImage(entry.kind, 0) !== null && (
                      <div className="row g-1 mb-2">
                        {(favorites[entry.kind] ?? []).map((itemId) => (
                          <div className="col-4" key={itemId}>
                            {enableImages && <img className="w-100" src={favoriteImage(entry.kind, itemId) ?? ''} alt="" />}
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      className="btn btn-primary btn-sm text-light"
                      onClick={() => setSelection({
                        itemKind: entry.kind,
                        itemId: 0,
                        showAllItems,
                        mode: 'favorite',
                        favoriteIds: favorites[entry.kind] ?? [],
                      })}
                    >
                      {t('ChuniV2.UserBoxPage.FavoriteManage')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div hidden={tab !== 'equip'}>
        <div className="mb-2">
          <div className="card p-0 overflow-hidden">
            <div className="card-header item-title text-light d-flex justify-content-center align-items-center py-1">
              <span className="m-0">{t('ChuniV2.UserBoxPage.Avatar')}</span>
            </div>
            <div className="card-body">
              <div className="avatarPreview">
                {profile && (
                  <div className="avatarContainer">
                    {enableImages && (
                      <>
                        <img id="avatarFeet" src={`${assetsHost}assets/chuni/avatar/CHU_UI_Avatar_Tex_${padDigits(profile.avatarSkin, 8)}.webp`} alt="" />
                        <img id="avatarBody" src={`${assetsHost}assets/chuni/avatar/CHU_UI_Avatar_Tex_${padDigits(profile.avatarSkin, 8)}.webp`} alt="" />
                        <img id="avatarFace" src={`${assetsHost}assets/chuni/avatar/CHU_UI_Avatar_Tex_Face.webp`} alt="" />
                        <img id="avatarLeftHand" src={`${assetsHost}assets/chuni/avatar/CHU_UI_Avatar_Tex_LeftHand.webp`} alt="" />
                        <img id="avatarRightHand" src={`${assetsHost}assets/chuni/avatar/CHU_UI_Avatar_Tex_RightHand.webp`} alt="" />
                        <img id="avatarWear" src={`${assetsHost}assets/chuni/avatar/CHU_UI_Avatar_Tex_${padDigits(profile.avatarWear, 8)}.webp`} alt="" />
                        <img id="avatarHead" src={`${assetsHost}assets/chuni/avatar/CHU_UI_Avatar_Tex_${padDigits(profile.avatarHead, 8)}.webp`} alt="" />
                        <img id="avatarFaceWear" src={`${assetsHost}assets/chuni/avatar/CHU_UI_Avatar_Tex_${padDigits(profile.avatarFace, 8)}.webp`} alt="" />
                        <img id="avatarItemLeft" src={`${assetsHost}assets/chuni/avatar/CHU_UI_Avatar_Tex_${padDigits(profile.avatarItem, 8)}.webp`} alt="" />
                        <img id="avatarItemRight" src={`${assetsHost}assets/chuni/avatar/CHU_UI_Avatar_Tex_${padDigits(profile.avatarItem, 8)}.webp`} alt="" />
                        <img id="avatarBack" src={`${assetsHost}assets/chuni/avatar/CHU_UI_Avatar_Tex_${padDigits(profile.avatarBack, 8)}.webp`} alt="" />
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-2">
          <div className="form-check form-check-inline form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="showAllItemsSwitch"
              checked={showAllItems}
              onChange={(event) => setShowAllItems(event.target.checked)}
            />
            <label className="form-check-label user-select-none" htmlFor="showAllItemsSwitch">
              {t('ChuniV2.UserBoxPage.ShowAllItems')}
            </label>
          </div>
        </div>

        <div className="row g-2 mb-3 row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-xl-4 userbox-custom-grid">
          {profile && customItems.map((item) => (
            <div className="col" key={item.name}>
              <div className="card p-0">
                <div className="card-header item-title text-light d-flex justify-content-center align-items-center py-1">
                  <span className="m-0">{t(`ChuniV2.UserBoxPage.${item.name}`)}</span>
                </div>
                <div className="card-body text-center">
                  <div><p className="text-truncate">{item.value}</p></div>
                  <div className="item-body">
                    {enableImages && equipmentImage(item.name, profile) && (
                      <img src={equipmentImage(item.name, profile) ?? ''} alt="" />
                    )}
                  </div>
                  <div className="hstack gap-2 mt-2">
                    <button className="btn btn-primary btn-sm text-light" onClick={() => setSelection(item.selection)}>
                      {t('ChuniV2.UserBoxPage.Change')}
                    </button>
                    {item.name === 'SystemVoice' && (
                      <button className="btn btn-primary btn-sm text-light" onClick={previewVoice}>
                        {t('ChuniV2.UserBoxPage.Preview')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <h2 className="mb-3">{t('ChuniV2.UserBoxPage.SymbolChat')}</h2>
        <ul className="nav nav-tabs mb-3" id="myTab" role="tablist">
          {SCENES.map((scene, index) => (
            <li className="nav-item" role="presentation" key={scene}>
              <button
                className={`nav-link${selectedScene === index + 1 ? ' active' : ''}`}
                id={`scene-${index + 1}-tab`}
                type="button"
                role="tab"
                aria-selected={selectedScene === index + 1}
                onClick={() => setSelectedScene(index + 1)}
              >
                {t(`ChuniV2.UserBoxPage.${scene}`)}
              </button>
            </li>
          ))}
        </ul>

        {symbolChatInfo.length > 0 && (
          <div className="tab-content mb-3" id="myTabContent">
            {SCENES.map((scene, sceneIndex) => (
              <div
                className={`tab-pane${selectedScene === sceneIndex + 1 ? ' show active' : ''}`}
                id={`scene-${sceneIndex + 1}-tab-pane`}
                role="tabpanel"
                tabIndex={sceneIndex}
                key={scene}
              >
                <div className="row g-2 row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-xl-4">
                  {Array.from({ length: 4 }, (_, orderId) => {
                    const master = symbolChat(sceneIndex + 1, orderId);
                    const equipped = symbolChatInfo.find(
                      (item) => item.sceneId === sceneIndex + 1 && item.orderId === orderId,
                    );
                    return (
                      <div className="col" key={orderId}>
                        <div className="card p-0">
                          <div className="card-header item-title text-light d-flex justify-content-center align-items-center py-1">
                            <span className="m-0">{t('ChuniV2.UserBoxPage.Chat')} {orderId + 1}</span>
                          </div>
                          <div className="card-body text-center">
                            <div className="symbol-chat-container">
                              <div className="symbol-chat-body">
                                {enableImages && (
                                  <img src={`${assetsHost}assets/chuni/symbolChat/${master?.balloonId ?? 0}.webp`} alt="" />
                                )}
                                <div className="symbol-chat-text">{master?.text ?? 'なし'}</div>
                              </div>
                            </div>
                            <div className="hstack gap-2 mt-2">
                              <button
                                className="btn btn-primary btn-sm text-light"
                                onClick={() => equipped && setSymbolSelection(equipped)}
                              >
                                {t('ChuniV2.UserBoxPage.Change')}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ChuniV2UserBoxItemDialog
        aimeId={aimeId}
        catalogs={catalogs}
        selection={selection}
        onClose={() => setSelection(null)}
        onEquip={applyEquipment}
        onFavoriteSave={(kind, itemIds) => {
          setFavorites((current) => ({ ...current, [kind]: itemIds }));
          notice(t('ChuniV2.UserBoxPage.MessageSuccess'));
        }}
      />
      <ChuniV2SymbolChatDialog
        aimeId={aimeId}
        allSymbolChats={allSymbolChats}
        selection={symbolSelection}
        onClose={() => setSymbolSelection(null)}
        onSaved={(saved) =>
          setSymbolChatInfo((current) =>
            current.map((item) =>
              item.sceneId === saved.sceneId && item.orderId === saved.orderId ? saved : item,
            ),
          )
        }
      />
    </div>
  );
}
