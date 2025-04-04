export interface V2Profile {
  userName: string;
  level: number;
  reincarnationNum: number;
  exp: number;
  point: number;
  totalPoint: bigint;
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
  totalHiScore: bigint;
  totalBasicHighScore: bigint;
  totalAdvancedHighScore: bigint;
  totalExpertHighScore: bigint;
  totalMasterHighScore: bigint;
  totalUltimaHighScore: bigint;
  friendCount: number;
  firstGameId: string;
  firstRomVersion: string;
  lastRomVersion: string;
  firstDataVersion: string;
  lastDataVersion: string;
  firstPlayDate: Date;
  lastPlayDate: Date;
  courseClass: number;
  overPowerPoint: number;
  overPowerRate: number;
  mapIconId: number;
  voiceId: number;
  avatarWear: number;
  avatarHead: number;
  avatarFace: number;
  avatarSkin: number;
  avatarItem: number;
  avatarFront: number;
  avatarBack: number;
}
