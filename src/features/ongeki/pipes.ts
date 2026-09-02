/** 等价旧版 ongeki util/*.pipe.ts */

import { BattleRank, TechnicalRank } from './models';

/** toAttributeClass：属性 → lv 颜色类 */
export function toAttributeClass(value: string | number): string {
  if (typeof value === 'string') {
    switch (value) {
      case 'Fire':
        return 'lv12';
      case 'Aqua':
        return 'lv8';
      case 'Leaf':
        return 'lv6';
      case 'Max':
        return '';
    }
  }
  if (typeof value === 'number') {
    switch (value) {
      case 1:
        return 'lv12';
      case 2:
        return 'lv8';
      case 3:
        return 'lv6';
      case 4:
        return '';
    }
  }
  return '';
}

/** toBattleSprite：战斗评级 → 印章图名 */
export function toBattleSprite(value: number): string | null {
  switch (BattleRank[value]) {
    case 'Yu':
      return 'SB_RES_ScoreStamp_Great.webp';
    case 'Ryo':
      return 'SB_RES_ScoreStamp_Good.webp';
    case 'Fuka':
      return 'SB_RES_ScoreStamp_NoGood.webp';
    case 'Shu':
      return 'SB_RES_ScoreStamp_Excellent.webp';
    case 'Ka':
      return 'SB_RES_ScoreStamp_Usually.webp';
    case 'Goku':
    case 'Goku1':
    case 'Goku2':
    case 'Goku3':
    case 'Goku4':
    case 'Goku5':
      return 'SB_RES_ScoreStamp_Unbelievable.webp';
  }
  return null;
}

/** toLevelDecimal："13,70" → "13.7" */
export function toLevelDecimal(value: string): string | null {
  if (value === null) return null;
  let v = value.replace(',', '.');
  if (v.charAt(v.length - 1) === '0' && v.charAt(v.length - 2) !== '.') {
    v = v.slice(0, v.length - 1);
  }
  return v;
}

/** toRaritySprite：稀有度 → 图名后缀 */
export function toRaritySprite(value: string): string | undefined {
  switch (value) {
    case 'N':
      return 'N';
    case 'R':
      return 'R';
    case 'SR':
      return 'SR';
    case 'SRPlus':
      return 'SR_plus';
    case 'SSR':
      return 'SSR';
  }
  return undefined;
}

/** toTechHonorSprite：技术评级 → 荣誉徽章图名 */
export function toTechHonorSprite(value: number): string | null {
  switch (TechnicalRank[value]) {
    case 'D':
      return 'UI_SLC_MusicSelect_HornorBadge_D.webp';
    case 'C':
      return 'UI_SLC_MusicSelect_HornorBadge_C.webp';
    case 'B':
      return 'UI_SLC_MusicSelect_HornorBadge_B.webp';
    case 'BB':
      return 'UI_SLC_MusicSelect_HornorBadge_BB.webp';
    case 'BBB':
      return 'UI_SLC_MusicSelect_HornorBadge_BBB.webp';
    case 'A':
      return 'UI_SLC_MusicSelect_HornorBadge_A.webp';
    case 'AA':
      return 'UI_SLC_MusicSelect_HornorBadge_AA.webp';
    case 'AAA':
      return 'UI_SLC_MusicSelect_HornorBadge_AAA.webp';
    case 'S':
      return 'UI_SLC_MusicSelect_HornorBadge_S.webp';
    case 'SS':
      return 'UI_SLC_MusicSelect_HornorBadge_SS.webp';
    case 'SSS':
      return 'UI_SLC_MusicSelect_HornorBadge_SSS.webp';
    case 'SSS1':
      return 'UI_SLC_MusicSelect_HornorBadge_SSSplus.webp';
  }
  return null;
}

/** toTechSprite：技术评级 → 评级图名 */
export function toTechSprite(value: number): string | null {
  switch (TechnicalRank[value]) {
    case 'D':
      return 'SB_RES_ScoreRank_D.webp';
    case 'C':
      return 'SB_RES_ScoreRank_C.webp';
    case 'B':
      return 'SB_RES_ScoreRank_B.webp';
    case 'BB':
      return 'SB_RES_ScoreRank_BB.webp';
    case 'BBB':
      return 'SB_RES_ScoreRank_BBB.webp';
    case 'A':
      return 'SB_RES_ScoreRank_A.webp';
    case 'AA':
      return 'SB_RES_ScoreRank_AA.webp';
    case 'AAA':
      return 'SB_RES_ScoreRank_AAA.webp';
    case 'S':
      return 'SB_RES_ScoreRank_S.webp';
    case 'SS':
      return 'SB_RES_ScoreRank_SS.webp';
    case 'SSS':
      return 'SB_RES_ScoreRank_SSS.webp';
    case 'SSS1':
      return 'SB_RES_ScoreRank_SSS%2B.webp';
  }
  return null;
}

/** toTechRating：定数+分数 → 理论技术 rating（旧版算法照搬） */
export function toTechRating(diff: string, score: number): string | null {
  if (diff === null) return null;
  const diffNum = parseFloat(diff);
  let result: number;
  const scoreZero = 500000;
  const rateTbls = [
    [800000, -600],
    [900000, -400],
    [970000, 0],
    [990000, 100],
    [1000000, 150],
    [1007500, 200],
    [1100000, 200],
  ];
  const level100 = Math.floor(diffNum * 100.0 + 0.5);
  let num = 0;

  if (score <= rateTbls[0][0]) {
    num = ((level100 + rateTbls[0][1]) * (score - scoreZero)) / (rateTbls[0][0] - scoreZero);
  } else {
    for (let i = 1; i < 7; i++) {
      const rateTbl = rateTbls[i];
      if (score <= rateTbl[0]) {
        const rateTbl2 = rateTbls[i - 1];
        num = level100 + rateTbl2[1];
        num += ((rateTbl[1] - rateTbl2[1]) * (score - rateTbl2[0])) / (rateTbl[0] - rateTbl2[0]);
        break;
      }
    }
  }

  num = Math.floor(num);
  result = Math.max(num, 0) / 100.0;

  if (result === 0) {
    return '0.00';
  } else {
    return result.toFixed(2).toString();
  }
}
