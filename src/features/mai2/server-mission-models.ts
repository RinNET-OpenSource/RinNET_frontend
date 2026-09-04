export interface ApiResponse<T> {
  data: T;
  status?: {
    code: number;
    message?: string;
  };
}

export interface Maimai2ServerMissionPointData {
  totalPoints: number;
  availablePoints: number;
}

export interface Maimai2ServerMissionPointChangelog {
  reason: string;
  changedAmount: number;
  recordDate: string;
}

export interface Maimai2ServerMissionPointInfo {
  userPointData: Maimai2ServerMissionPointData;
  filterPointChangelogs: Maimai2ServerMissionPointChangelog[];
  changelogTotalCount: number;
}

export type Maimai2ServerMissionRefreshCycle =
  | 'None'
  | 'EveryDay'
  | 'EveryWeek'
  | 'EveryMonth';

export interface Maimai2ServerMissionCondition {
  current: number;
  total: number;
  isDone: boolean;
  description: string;
}

export interface Maimai2ServerMission {
  rewardType: number;
  rewardTypeRelatedId: number;
  missionTitle: string;
  missionDescription: string;
  rewardDescription: string;
  refreshCycle: Maimai2ServerMissionRefreshCycle;
  conditionProgresses: Maimai2ServerMissionCondition[];
}

export interface Maimai2ServerMissionInfo {
  serverMissionUserInfos: Maimai2ServerMission[];
}

export type Maimai2ExchangeItemTypeName =
  | 'Plate'
  | 'Title'
  | 'Icon'
  | 'Present'
  | 'Character'
  | 'Partner'
  | 'Frame'
  | 'Ticket'
  | 'Mile'
  | 'KaleidxScopeKey'
  | 'DXPass';

export type Maimai2ExchangeItemType =
  | 1
  | 2
  | 3
  | 4
  | 9
  | 10
  | 11
  | 12
  | 13
  | 15
  | 901
  | Maimai2ExchangeItemTypeName;

export interface Maimai2ExchangeItem {
  id: number;
  itemType: Maimai2ExchangeItemType;
  itemId: number;
  name: string;
  description: string;
  itemCount: number;
  exchangedCount: number;
  stockCount: number;
  costPoints: number;
  limitCount: number;
  enable: boolean;
}

export interface Maimai2ExchangeItemList {
  filterExchangeItemDataList: Maimai2ExchangeItem[];
  filterListTotalCount: number;
}

export interface Maimai2UserExchangeItem {
  id: number;
  exchangedTotalCount: number;
  exchangedItemDataId: number;
}

export interface Maimai2UserExchangeItemChangelog {
  id: number;
  exchangeCount: number;
  recordDate: string;
  exchangedItemDataId: number;
}

export interface Maimai2UserExchangeInfo {
  exchangeItemDataList: Maimai2UserExchangeItem[];
  filterExchangeItemChangelogList: Maimai2UserExchangeItemChangelog[];
  changelogTotalCount: number;
}

export const MAIMAI2_EXCHANGE_TYPES: ReadonlyArray<{
  value: number;
  key: Maimai2ExchangeItemTypeName;
  label: string;
}> = [
  { value: 1, key: 'Plate', label: '姓名框' },
  { value: 2, key: 'Title', label: '称号' },
  { value: 3, key: 'Icon', label: '头像' },
  { value: 4, key: 'Present', label: '礼物' },
  { value: 9, key: 'Character', label: '角色' },
  { value: 10, key: 'Partner', label: '伙伴' },
  { value: 11, key: 'Frame', label: '背景图' },
  { value: 12, key: 'Ticket', label: '功能卷' },
  { value: 13, key: 'Mile', label: 'Mile' },
  { value: 15, key: 'KaleidxScopeKey', label: '门钥匙' },
  { value: 901, key: 'DXPass', label: 'DXPass' },
];

export function exchangeTypeKey(type: Maimai2ExchangeItemType): Maimai2ExchangeItemTypeName | null {
  if (typeof type === 'string') {
    return MAIMAI2_EXCHANGE_TYPES.some((entry) => entry.key === type) ? type : null;
  }
  return MAIMAI2_EXCHANGE_TYPES.find((entry) => entry.value === type)?.key ?? null;
}

export function exchangeTypeLabel(type: Maimai2ExchangeItemType): string {
  const key = exchangeTypeKey(type);
  return MAIMAI2_EXCHANGE_TYPES.find((entry) => entry.key === key)?.label ?? '未知';
}
