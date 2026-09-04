export interface ChuniV2Profile {
  userName: string;
  level: number;
  reincarnationNum: number;
  exp: number;
  point: number;
  totalPoint: number | string;
  playCount: number;
  multiPlayCount: number;
  multiWinCount: number;
  requestResCount: number;
  acceptResCount: number;
  successResCount: number;
  playerRating: number;
  highestRating: number;
  nameplateId: number;
  frameId: number;
  characterId: number;
  trophyId: number;
  trophyIdSub1: number;
  trophyIdSub2: number;
  playedTutorialBit: number;
  firstTutorialCancelNum: number;
  masterTutorialCancelNum: number;
  totalRepertoireCount: number;
  totalMapNum: number;
  totalHiScore: number | string;
  totalBasicHighScore: number | string;
  totalAdvancedHighScore: number | string;
  totalExpertHighScore: number | string;
  totalMasterHighScore: number | string;
  totalUltimaHighScore: number | string;
  friendCount: number;
  firstGameId: string;
  firstRomVersion: string;
  lastRomVersion: string;
  firstDataVersion: string;
  lastDataVersion: string;
  firstPlayDate: string;
  lastPlayDate: string;
  courseClass: number;
  overPowerPoint: number;
  overPowerRate: number;
  mapIconId: number;
  voiceId: number;
  stageId: number;
  avatarWear: number;
  avatarHead: number;
  avatarFace: number;
  avatarSkin: number;
  avatarItem: number;
  avatarFront: number;
  avatarBack: number;
}

export interface ChuniV2UserRanking {
  userName: string;
  characterId: number;
  nowRating: number;
  highestRating: number;
}

export interface ChuniV2PcRanking {
  username: string;
  characterId: string;
  pc: number;
}

export interface ChuniV2RatingItem {
  musicId: number;
  musicName: string;
  artistName: string;
  level: number;
  score: number;
  ratingBase: number;
  rating: number;
}

export interface ChuniV2MusicLevelInfo {
  enable: boolean;
  level: number;
  levelDecimal: number;
  diff: number;
}

export interface ChuniV2Music {
  musicId: number;
  name: string;
  sotrName: string;
  artistName: string;
  genre: string;
  releaseVersion: string;
  levels: Record<number, ChuniV2MusicLevelInfo>;
}

export interface ChuniV2PlayLog {
  playDate: string | Date;
  userPlayDate: string | Date;
  musicId: number;
  songInfo?: ChuniV2Music;
  level: number;
  customId: number;
  playedCustom1: number;
  playedCustom2: number;
  playedCustom3: number;
  track: number;
  score: number;
  rank: number;
  maxCombo: number;
  maxChain: number;
  rateTap: number;
  rateHold: number;
  rateSlide: number;
  rateAir: number;
  rateFlick: number;
  judgeGuilty: number;
  judgeAttack: number;
  judgeJustice: number;
  judgeCritical: number;
  judgeHeaven: number;
  playerRating: number;
  fullChainKind: number;
  characterId: number;
  skillId: number;
  playKind: number;
  skillLevel: number;
  skillEffect: number;
  isNewRecord: boolean;
  isFullCombo: boolean;
  isAllJustice: boolean;
  isClear: boolean;
}
