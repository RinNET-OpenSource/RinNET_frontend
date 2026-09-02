/** 等价旧版 new-rating.service.ts（New/Best/Platinum rating 计算） */

import { ClearMarkType, type OngekiMusic, type PlayerNewRatingItem } from './models';

export enum NewRatingType {
  New,
  Best,
  Platinum,
}

enum TechnicalRankID {
  None,
  D,
  C,
  B,
  BB,
  BBB,
  A,
  AA,
  AAA,
  S,
  SS,
  SSS,
  SSS1,
}

class RateTbl {
  constructor(
    public score: number,
    public bonus1000: number,
  ) {}
}

const rateTbl: RateTbl[] = [
  new RateTbl(800000, -6000),
  new RateTbl(900000, -4000),
  new RateTbl(970000, 0),
  new RateTbl(990000, 750),
  new RateTbl(1000000, 1250),
  new RateTbl(1007500, 1750),
  new RateTbl(1010000, 2000),
];

const clearMarkRateTbl = new Map<ClearMarkType, number>([
  [ClearMarkType.None, 0],
  [ClearMarkType.FullCombo, 100],
  [ClearMarkType.AllBreak, 300],
  [ClearMarkType.AllBreakPlus, 350],
]);

const fullBellRateTbl = new Map<boolean, number>([
  [false, 0],
  [true, 50],
]);

const teckRankRateTbl = new Map<TechnicalRankID, number>([
  [TechnicalRankID.S, 0],
  [TechnicalRankID.SS, 100],
  [TechnicalRankID.SSS, 200],
  [TechnicalRankID.SSS1, 300],
]);

const technicalRankTable = new Map<TechnicalRankID, number>([
  [TechnicalRankID.D, 0],
  [TechnicalRankID.C, 500000],
  [TechnicalRankID.B, 700000],
  [TechnicalRankID.BB, 750000],
  [TechnicalRankID.BBB, 800000],
  [TechnicalRankID.A, 850000],
  [TechnicalRankID.AA, 900000],
  [TechnicalRankID.AAA, 940000],
  [TechnicalRankID.S, 970000],
  [TechnicalRankID.SS, 990000],
  [TechnicalRankID.SSS, 1000000],
  [TechnicalRankID.SSS1, 1007500],
]);

const teckRankOrder: TechnicalRankID[] = [
  TechnicalRankID.S,
  TechnicalRankID.SS,
  TechnicalRankID.SSS,
  TechnicalRankID.SSS1,
];

export function getTechnicalRankIDByScore(score: number): TechnicalRankID {
  const entries = Array.from(technicalRankTable.entries());
  entries.sort((a, b) => b[1] - a[1]);
  const found = entries.find(([, value]) => score >= value);
  return found ? found[0] : TechnicalRankID.None;
}

export function calcRate1000(ratingItem: PlayerNewRatingItem, type: NewRatingType): number {
  if (!ratingItem.musicInfo) {
    return 0;
  } else if (type === NewRatingType.Best) {
    return calcTechnicalScoreRate1000(ratingItem);
  } else if (type === NewRatingType.New) {
    const rate1000 = calcTechnicalScoreRate1000(ratingItem);
    return Math.floor(rate1000 / 5) * 5;
  } else if (type === NewRatingType.Platinum) {
    return calcPlatinumScoreRate1000(ratingItem);
  }
  return 0;
}

export function calcTechnicalScoreRate1000(ratingItem: PlayerNewRatingItem): number {
  const score = ratingItem.techScoreMax;
  const clearMarkType = ratingItem.clearMarkType;
  const isFullBell = ratingItem.isFullBell;

  const level1000 = getLevel1000(ratingItem.musicInfo, ratingItem.level);
  let rate1000 = 0;

  if (score <= rateTbl[0].score) {
    rate1000 = Math.floor(((level1000 + rateTbl[0].bonus1000) * (score - 500000)) / (rateTbl[0].score - 500000));
  } else {
    for (let i = 1; i < rateTbl.length; i++) {
      const nextRate = rateTbl[i];
      if (score <= nextRate.score) {
        const rate = rateTbl[i - 1];
        const techScoreRank = getTechnicalRankIDByScore(score);
        const clearMarkBonus = clearMarkRateTbl.get(clearMarkType ?? ClearMarkType.None) || 0;
        const fullBellBonus = fullBellRateTbl.get(isFullBell ?? false) || 0;
        let teckRankBonus = 0;

        for (const rank of teckRankOrder) {
          if (techScoreRank < rank) {
            break;
          }
          teckRankBonus = teckRankRateTbl.get(rank) || 0;
        }

        let num4 = level1000 + rate.bonus1000;
        const bonusDiff = nextRate.bonus1000 - rate.bonus1000;
        const scoreDiff = score - rate.score;
        const rateDiff = nextRate.score - rate.score;
        num4 += Math.floor((bonusDiff * scoreDiff) / rateDiff);
        rate1000 = num4 + clearMarkBonus + teckRankBonus + fullBellBonus;
        break;
      }
    }
  }

  return Math.max(rate1000, 0);
}

export function calcPlatinumScoreRate1000(ratingItem: PlayerNewRatingItem): number {
  const level = getLevel(ratingItem.musicInfo, ratingItem.level);
  const platinumScoreStar = Math.min(ratingItem.platinumScoreStar, 5);
  const rate1000 = platinumScoreStar * Math.pow(level, 2);
  return Math.max(Math.floor(rate1000), 0);
}

export function getLevel1000(musicInfo: OngekiMusic | undefined, level: number): number {
  const level100 = getLevel100(musicInfo, level);
  return level100 * 10;
}

export function getLevel100(musicInfo: OngekiMusic | undefined, level: number): number {
  if (!musicInfo) {
    return 0;
  }
  let levelData: string | undefined;
  if (level === 0) {
    levelData = musicInfo.level0;
  } else if (level === 1) {
    levelData = musicInfo.level1;
  } else if (level === 2) {
    levelData = musicInfo.level2;
  } else if (level === 3) {
    levelData = musicInfo.level3;
  } else if (level === 10) {
    levelData = musicInfo.level4;
  }
  if (!levelData) {
    return 0;
  }
  const levelDatas = levelData.split(',');
  if (levelDatas.length !== 2) {
    return 0;
  }
  return Math.floor(parseInt(levelDatas[0], 10) * 100 + parseInt(levelDatas[1], 10) + 0.5);
}

export function getLevel(musicInfo: OngekiMusic | undefined, level: number): number {
  const level100 = getLevel100(musicInfo, level);
  return level100 / 100;
}
