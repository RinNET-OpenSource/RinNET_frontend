export interface DisplayMaimai2Profile {
  userName: string;
  iconId: number;
  plateId: number;
  titleId: number;
  partnerId: number;
  frameId: number;
  selectMapId: number;
  totalAwake: number;
  gradeRating: number;
  musicRating: number;
  playerRating: number;
  highestRating: number;
  gradeRank: number;
  classRank: number;
  courseRank: number;
  charaSlot: string;
  charaLockSlot: string;
  playCount: number;
  eventWatchedDate: string;
  lastRomVersion: string;
  lastDataVersion: string;
  lastPlayDate: string;
  playVsCount: number;
  playSyncCount: number;
  winCount: number;
  helpCount: number;
  comboCount: number;
  totalDeluxscore: number;
  totalBasicDeluxscore: number;
  totalAdvancedDeluxscore: number;
  totalExpertDeluxscore: number;
  totalMasterDeluxscore: number;
  totalReMasterDeluxscore: number;
  totalSync: number;
  totalBasicSync: number;
  totalAdvancedSync: number;
  totalExpertSync: number;
  totalMasterSync: number;
  totalReMasterSync: number;
  totalAchievement: number;
  totalBasicAchievement: number;
  totalAdvancedAchievement: number;
  totalExpertAchievement: number;
  totalMasterAchievement: number;
  totalReMasterAchievement: number;
}

export interface Maimai2Photo {
  divLength: number;
  fileName: string;
  placeId: number;
  uploadDate: string;
  playlogId: number;
  trackNo: number;
}

export interface Maimai2DxPass {
  cardId: number;
  cardTypeId: number;
  charaId: number;
  mapId: number;
  startDate: string;
  endDate: string;
}

export interface Maimai2MusicDetail {
  id: number;
  tapCount: number;
  holdCount: number;
  breakCount: number;
  slideCount: number;
  touchCount: number;
  levelDecimal: number;
  noteDesigner: string;
  utageComment: string;
  utageKanji: string;
  tsuikaVersion: number;
  diff: number;
}

export interface Maimai2Music {
  musicId: number;
  name: string;
  artistName: string;
  sortName: string;
  genreId: number;
  romVersion: number;
  addVersion: number;
  details: Array<Maimai2MusicDetail | null>;
}

export interface Maimai2SongRecord {
  musicId: number;
  level: number;
  playCount: number;
  achievement: number;
  comboStatus: number;
  syncStatus: number;
  deluxscoreMax: number;
  scoreRank: number;
  extNum1: number;
  ranking?: {
    rank: number;
    playedCount: number;
  };
  musicDetail?: Maimai2MusicDetail;
  totalCombo: number;
}

export interface Maimai2SongRanking {
  level?: number;
  username: string;
  score: number;
}

export interface Maimai2Playlog {
  orderId: number;
  playlogId: number;
  songInfo?: Maimai2Music;
  version: number;
  placeId: number;
  placeName: string;
  loginDate: number;
  playDate: string;
  userPlayDate: string;
  type: number;
  musicId: number;
  level: number;
  trackNo: number;
  vsMode: number;
  vsUserName: string;
  vsStatus: number;
  vsUserRating: number;
  vsUserAchievement: number;
  vsUserGradeRank: number;
  vsRank: number;
  playerNum: number;
  playedUserId1: number;
  playedUserName1: string;
  playedMusicLevel1: number;
  playedUserId2: number;
  playedUserName2: string;
  playedMusicLevel2: number;
  playedUserId3: number;
  playedUserName3: string;
  playedMusicLevel3: number;
  achievement: number;
  deluxscore: number;
  scoreRank: number;
  maxCombo: number;
  totalCombo: number;
  maxSync: number;
  totalSync: number;
  tapCriticalPerfect: number;
  tapPerfect: number;
  tapGreat: number;
  tapGood: number;
  tapMiss: number;
  holdCriticalPerfect: number;
  holdPerfect: number;
  holdGreat: number;
  holdGood: number;
  holdMiss: number;
  slideCriticalPerfect: number;
  slidePerfect: number;
  slideGreat: number;
  slideGood: number;
  slideMiss: number;
  touchCriticalPerfect: number;
  touchPerfect: number;
  touchGreat: number;
  touchGood: number;
  touchMiss: number;
  breakCriticalPerfect: number;
  breakPerfect: number;
  breakGreat: number;
  breakGood: number;
  breakMiss: number;
  isTap: boolean;
  isHold: boolean;
  isSlide: boolean;
  isTouch: boolean;
  isBreak: boolean;
  isCriticalDisp: boolean;
  isFastLateDisp: boolean;
  fastCount: number;
  lateCount: number;
  isAchieveNewRecord: boolean;
  isDeluxscoreNewRecord: boolean;
  comboStatus: number;
  syncStatus: number;
  isClear: boolean;
  beforeRating: number;
  afterRating: number;
}

export interface Maimai2RatingItem {
  musicId: number;
  musicName: string;
  artistName: string;
  level: number;
  score: number;
  ratingBase: number;
  rating: number;
  romVersion: number;
  music?: Maimai2Music;
}

export interface Maimai2Rival {
  rivalName: string;
  rivalId: string;
  iconId: number;
  playerRating: number;
  lastPlayDate: string;
  awakenCount: number;
  playCount: number;
  isFavourite: boolean;
}



export const maimai2ClassNames = [
  'B5',
  'B4',
  'B3',
  'B2',
  'B1',
  'A5',
  'A4',
  'A3',
  'A2',
  'A1',
  'S5',
  'S4',
  'S3',
  'S2',
  'S1',
  'SS5',
  'SS4',
  'SS3',
  'SS2',
  'SS1',
  'SSS5',
  'SSS4',
  'SSS3',
  'SSS2',
  'SSS1',
  'LEGEND',
] as const;

export const maimai2CourseRanks = [
  '初心者',
  '見習い',
  '駆け出し',
  '修行中',
  '初段',
  '二段',
  '三段',
  '四段',
  '五段',
  '六段',
  '七段',
  '八段',
  '九段',
  '十段',
  '皆伝',
  '皆伝1',
  '皆伝2',
  '皆伝3',
  '皆伝4',
  '皆伝5',
  '皆伝6',
  '皆伝7',
  '皆伝8',
  '皆伝9',
  '皆伝10',
] as const;
