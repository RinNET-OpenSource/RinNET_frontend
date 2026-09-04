import type { Maimai2Music } from './models';

export interface ApiResponse<T> {
  data: T;
  status?: {
    code?: number;
    message?: string;
  };
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages?: number;
  page?: number;
}

export interface Maimai2Circle {
  circleId: number;
  circleClass: number;
  circleName: string;
  isPlace: boolean;
  placeId: number;
  isPublic: boolean;
  aggrDate: string;
  circleCode: string;
  comment: string;
  isAllowAnyoneJoin: boolean;
}

export interface Maimai2CircleChallenge {
  circleId: number;
  musicId: number;
  updateDate: string;
  rewardStatus: boolean;
  achievement: number;
}

export interface Maimai2UserCircleChallenge {
  circleId: number;
  updateDate: string;
  achievement: number;
  musicId: number;
  rewardGet: boolean;
}

export interface Maimai2UserCircleData {
  id: number;
  circleId: number;
  lastLoginDate: string;
}

export interface Maimai2UserCirclePointData {
  id: number;
  circleId: number;
  userName: string;
  aggrDate: string;
  point: number;
  recordDate: string;
  rewardGet: boolean;
}

export interface Maimai2UserCirclePointRankingResult {
  id: number;
  circleId: number;
  aggrDate: string;
  circleName: string;
  lastMonthCircleRank: number;
  lastMonthPoint: number;
}

export interface Maimai2UserCircleInfo {
  joinedCircle: Maimai2Circle | null;
  circleChallenge: Maimai2CircleChallenge | null;
  userCircleData: Maimai2UserCircleData | null;
  userCirclePointData: Maimai2UserCirclePointData | null;
  userCirclePointRankingResult: Maimai2UserCirclePointRankingResult | null;
  userCircleChallenge: Maimai2UserCircleChallenge | null;
  isCircleOwner: boolean;
}

export interface CircleMemberProfile {
  userName: string;
  playerRating: number;
  classRank?: number;
  gradeRank?: number;
  lastPlayDate?: string;
}

export interface Maimai2CircleMemberInfo {
  userCode: string;
  userProfile: CircleMemberProfile;
  userCircleData: Maimai2UserCircleData | null;
  userCirclePointData: Maimai2UserCirclePointData | null;
  userCircleChallenge: Maimai2UserCircleChallenge | null;
}

export interface Maimai2RequestJoinCircleUser {
  userProfile: CircleMemberProfile;
  requestTime: string;
  userCode: string;
}

export interface Maimai2FestaSideData {
  festaSideId: number;
  rankInPlace: number;
  rank?: number;
  advantagePercent: number;
}

export interface Maimai2GameFesta {
  name: string;
  collaboration: number;
  seasonNum: number;
  festaTitle: string;
  festaSide01: string;
  festaSide02: string;
  festaSide03: string;
  musicClearPoint: number;
  rallyPoint1st: number;
  rallyPoint2nd: number;
  rallyPoint3rd: number;
  bonusPoint2p: number;
  daliyBonus: number;
  rewardBorder: number;
  rewardType: number;
  rewardId: number;
  openEventId: string;
  resultEventId: string;
  themeInfoFile: string;
  rewardInfoFile: string;
  netOpenName: string;
  releaseTagName: string;
  finalResultFile: string;
  rightFile: string;
  priority: number;
  dataName: string;
  festaPhaseState: string;
}

export interface Maimai2GameFestaData {
  eventId: number;
  isRallyPeriod: boolean;
  isCircleJoinNotAllowed: boolean;
  jackingFestaSideId: number;
  festaSideDataList: Maimai2FestaSideData[];
}

export interface Maimai2GameResultFestaData {
  eventId: number;
  resultFestaSideDataList: Maimai2FestaSideData[];
}

export interface Maimai2GameFestaInfo {
  gameFesta: Maimai2GameFesta | null;
  gameFestaData: Maimai2GameFestaData | null;
  gameRsultFesta: Maimai2GameFesta | null;
  gameResultFestaData: Maimai2GameResultFestaData | null;
}

export interface Maimai2CircleFestaData {
  circleId: number;
  eventId: number;
  festaSideId: number;
  placeId: number;
  totalPoint: number;
  circleName: string;
}

export interface Maimai2CircleFestaRankInfo {
  circleFestaData: Maimai2CircleFestaData;
  rank: number;
}

export interface Maimai2UserFestaData {
  eventId: number;
  circleId: number;
  festaSideId: number;
  circleTotalFestaPoint: number;
  currentTotalFestaPoint: number;
  circleRankInFestaSide: number;
  circleRecordDate: string;
  isDailyBonus: boolean;
  participationRewardGet: boolean;
  receivedRewardBorder: number;
  circleName: string;
  placeId: number;
}

export interface Maimai2UserResultFestaData {
  eventId: number;
  circleId: number;
  circleName: string;
  festaSideId: number;
  circleRankInFestaSide: number;
  receivedRewardBorder: number;
  circleTotalFestaPoint: number;
  resultRewardGet: number;
}

export interface Maimai2UserFestaInfo {
  circle: Maimai2Circle | null;
  circleFestaData: Maimai2CircleFestaData | null;
  userFestaData: Maimai2UserFestaData | null;
  userResultFestaData: Maimai2UserResultFestaData | null;
}

export type ChallengeMusic = Maimai2Music | null;
