/** 等价旧版 ongeki model/*.ts */

export interface OngekiCharacter {
  id: number;
  name: string;
  cv: string;
  modelId: number;
}

export interface OngekiSkill {
  id: number;
  name: string;
  category: string;
  info: string;
}

export interface OngekiCard {
  id: number;
  name: string;
  nickName: string;
  attribute: string;
  charaId: number;
  characterInfo?: OngekiCharacter;
  school: string;
  gakunen: string;
  rarity: string;
  levelParam: string;
  skillId: number;
  skillInfo?: OngekiSkill;
  choKaikaSkillId: number;
  choKaikaSkillInfo?: OngekiSkill;
  cardNumber: string;
  version: string;
}

export interface OngekiMusic {
  id: number;
  name: string;
  sortName: string;
  artistName: string;
  genre: string;
  bossCardId: number;
  bossLevel: number;
  level0: string;
  level1: string;
  level2: string;
  level3: string;
  level4: string;
}

export interface OngekiTrophy {
  id: number;
  name: string;
  rarityType: string;
}

export interface DisplayOngekiProfile {
  userName: string;
  level: number;
  reincarnationNum: number;
  lastPlayDate: string;
  lastDataVersion: string;
  lastRomVersion: string;
  exp: number;
  point: number;
  totalPoint: number;
  playCount: number;
  jewelCount: number;
  totalJewelCount: number;
  medalCount: number;
  playerRating: number;
  highestRating: number;
  newPlayerRating: number;
  newHighestRating: number;
  battlePoint: number;
  bestBattlePoint: number;
  rankId: number;
  rankPattern: number;
  nameplateId: number;
  trophyId: number;
  trophy: OngekiTrophy;
  cardId: number;
  characterId: number;
  sumTechHighScore: number;
  sumTechBasicHighScore: number;
  sumTechAdvancedHighScore: number;
  sumTechExpertHighScore: number;
  sumTechMasterHighScore: number;
  sumTechLunaticHighScore: number;
  sumBattleHighScore: number;
  sumBattleBasicHighScore: number;
  sumBattleAdvancedHighScore: number;
  sumBattleExpertHighScore: number;
  sumBattleMasterHighScore: number;
  sumBattleLunaticHighScore: number;
}

export interface OngekiRival {
  rivalUserId: number;
  rivalUserName: string;
  rivalNowRating: number;
  rivalHighestRating: number;
  rivalCardId: number;
  lastPlayDate: string;
  reincarnationNum: number;
  rivalBattleScore: number;
  level: number;
}

export interface OngekiGameRanking {
  music: OngekiMusic;
  playCount: number;
  ranking: number;
  state: number;
}

export interface OngekiPcRanking {
  username: string;
  pc: number;
}

export interface OngekiUserRanking {
  userName: string;
  ranking: number;
  cardId: string;
  nowRating: number;
  highestRating: number;
}

export interface PlayerCard {
  cardId: number;
  digitalStock: number;
  analogStock: number;
  level: number;
  maxLevel: number;
  exp: number;
  printCount: number;
  useCount: number;
  kaikaDate: string;
  choKaikaDate: string;
  skillId: number;
  created: string;
  isNew: boolean;
  isAcquired: boolean;
  cardInfo?: OngekiCard;
  characterInfo?: OngekiCharacter;
  skillInfo?: OngekiSkill;
}

export enum ClearMarkType {
  None,
  FullCombo,
  AllBreak,
  AllBreakPlus,
}

export interface PlayerNewRatingItem {
  musicId: number;
  level: number;
  techScoreMax: number;
  platinumScoreMax: number;
  platinumScoreStar: number;
  isFullBell?: boolean;
  isFullCombo?: boolean;
  isAllBreak?: boolean;
  clearMarkType?: ClearMarkType;
  musicInfo?: OngekiMusic;
}

export interface PlayerPlaylog {
  sortNumber: number;
  placeId: number;
  placeName: string;
  playDate: string;
  userPlayDate: string;
  musicId: number;
  songInfo: OngekiMusic;
  level: number;
  playKind: number;
  eventId: number;
  eventName: string;
  eventPoint: number;
  playedUserId1: number;
  playedUserId2: number;
  playedUserId3: number;
  playedUserName1: string;
  playedUserName2: string;
  playedUserName3: string;
  playedMusicLevel1: number;
  playedMusicLevel2: number;
  playedMusicLevel3: number;
  cardId1: number;
  cardId2: number;
  cardId3: number;
  cardLevel1: number;
  cardLevel2: number;
  cardLevel3: number;
  cardAttack1: number;
  cardAttack2: number;
  cardAttack3: number;
  cardInfo1?: OngekiCard;
  cardInfo2?: OngekiCard;
  cardInfo3?: OngekiCard;
  bossCharaId: number;
  bossLevel: number;
  bossAttribute: number;
  bossCardInfo?: OngekiCard;
  bossCharaInfo?: OngekiCharacter;
  clearStatus: number;
  techScore: number;
  techScoreRank: number;
  battleScore: number;
  battleScoreRank: number;
  maxCombo: number;
  judgeMiss: number;
  judgeHit: number;
  judgeBreak: number;
  judgeCriticalBreak: number;
  rateTap: number;
  rateHold: number;
  rateFlick: number;
  rateSideTap: number;
  rateSideHold: number;
  bellCount: number;
  totalBellCount: number;
  damageCount: number;
  overDamage: number;
  playerRating: number;
  battlePoint: number;
  isFullCombo: boolean;
  isOverDamageNewRecord: boolean;
  isFullBell: boolean;
  isTechNewRecord: boolean;
  isAllBreak: boolean;
  isBattleNewRecord: boolean;
  platinumScore: number;
  platinumScoreStar: number;
}

export interface PlayerRatingItem {
  musicId: number;
  level: number;
  value: number;
  platinumScoreMax: number;
  platinumScoreStar: number;
  musicInfo?: OngekiMusic;
  bossCardInfo?: OngekiCard;
}

export enum Difficulty {
  Basic = 0,
  Advanced = 1,
  Expert = 2,
  Master = 3,
  Lunatic = 10, // Client sends 10 as id of Lunatic difficulty to server
}

export enum BattleRank {
  Invalid = -1,
  None = 0,
  Fuka = 1,
  Ka = 2,
  Ryo = 3,
  Yu = 4,
  Shu = 5,
  Goku = 6,
  Goku1 = 7,
  Goku2 = 8,
  Goku3 = 9,
  Goku4 = 10,
  Goku5 = 11,
}

export enum TechnicalRank {
  None = 0,
  D = 1,
  C = 2,
  B = 3,
  BB = 4,
  BBB = 5,
  A = 6,
  AA = 7,
  AAA = 8,
  S = 9,
  SS = 10,
  SSS = 11,
  SSS1 = 12,
}

export enum AttributeType {
  Fire = 1,
  Aqua = 2,
  Leaf = 3,
  Max = 4,
}
