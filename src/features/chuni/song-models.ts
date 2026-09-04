export interface ChuniV2SongLevelInfo {
  enable: boolean;
  level: number;
  levelDecimal: number;
  diff: number;
}

export interface ChuniV2Song {
  musicId: number;
  name: string;
  sotrName: string;
  artistName: string;
  genre: string;
  releaseVersion: string;
  levels: Record<number, ChuniV2SongLevelInfo>;
}

export interface ChuniV2SongUserRanking {
  rank: number;
  playedCount: number;
}

export interface ChuniV2SongRecord {
  musicId: number;
  level: number;
  playCount: number;
  scoreMax: number;
  missCount: number;
  maxComboCount: number;
  isFullCombo: boolean;
  isAllJustice: boolean;
  isSuccess: number;
  fullChain: number;
  maxChain: number;
  scoreRank: number;
  isLock: boolean;
  theoryCount: number;
  ext1: number;
  ranking: ChuniV2SongUserRanking;
}

export interface ChuniV2SongRankingRow {
  level?: number;
  username: string;
  score: number;
}
