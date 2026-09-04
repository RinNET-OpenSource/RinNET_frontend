export interface ChuniV2UserBoxProfile {
  lastRomVersion: string;
  nameplateId: number;
  frameId: number;
  trophyId: number;
  trophyIdSub1: number;
  trophyIdSub2: number;
  mapIconId: number;
  voiceId: number;
  stageId?: number;
  avatarWear: number;
  avatarHead: number;
  avatarFace: number;
  avatarSkin: number;
  avatarItem: number;
  avatarFront: number;
  avatarBack: number;
}

export interface ChuniV2MasterItem {
  id: number;
  name: string;
  category?: number;
}

export interface ChuniV2UserItem {
  itemKind: number;
  itemId: number;
  stock: number;
  name: string;
}

export interface ChuniV2UserSymbolChat {
  sceneId: number;
  orderId: number;
  symbolChatId: number;
}

export interface ChuniV2MasterSymbolChat extends ChuniV2MasterItem {
  sortName: string;
  text: string;
  balloonId: number;
  sceneIds: number[];
}

export interface ChuniV2UserBoxSelection {
  itemKind: number;
  itemId: number;
  category?: number;
  showAllItems: boolean;
  mode: 'equip' | 'favorite';
  favoriteIds?: number[];
  trophySlot?: 0 | 1 | 2;
}

export type ChuniV2UserBoxCatalogs = Record<number, ChuniV2MasterItem[]>;
