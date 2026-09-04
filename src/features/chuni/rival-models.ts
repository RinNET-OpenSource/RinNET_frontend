export interface ChuniV2Rival {
  rivalName: string;
  rivalId: string;
  playerRating: number;
  characterId: number;
  overPowerRate: number;
  isFavorite: boolean;
  reincarnationNum: number;
  level: number;
}

export interface ChuniV2RivalProfile {
  userName: string;
  level: number;
  reincarnationNum: number;
  playerRating: number;
  overPowerRate: number;
  characterId: number;
  lastPlayDate: string;
}
