import { assetsHost } from '@/lib/utils';
import type { PlayerCard } from './models';
import './card-item.css';

const SPECIAL_HOLO_IDS = [
  100009, 100018, 100027, 100201, 100202, 100203, 100204, 100205, 100206, 100288, 100289, 100290, 100291,
  100292, 100293, 100294, 100295, 100296, 100297, 100298, 100458, 100459, 100460, 100489, 100572, 100613,
  100614, 100615, 100616, 100617, 100618, 100729, 100730, 100806, 100887, 101047, 101048, 101312, 101313,
  101314, 101322, 101323, 101324, 101325, 101326, 101327, 101328, 101329, 101330, 101331, 101332, 101333,
  101334, 101335, 101336, 101337, 101338, 101339, 101502, 102694, 102695, 102697, 102698, 102701, 102702,
  102703, 102704, 103650, 103655, 103660, 103665, 103670, 103675, 103680, 103685, 103690, 103695, 103700,
  103705, 103710, 103715, 103720, 103725, 103730,
];
const SIGN_HOLO_IDS = SPECIAL_HOLO_IDS.filter((id) => ![100201, 100202, 100203, 100204, 100205, 100206, 100489, 100572, 100613, 100614, 100615, 100616, 100617, 100618, 100806, 100887, 101502].includes(id));

const attrCode = (attr?: string) => (attr === 'Fire' ? '00' : attr === 'Aqua' ? '01' : '02');
const pad6 = (n: number) => String(n).padStart(6, '0');

function getCardBackground(card: PlayerCard, showHolo: boolean): string {
  const cardIdStr = pad6(card.cardId);
  if (!card.cardInfo) {
    return `url(${assetsHost}assets/ongeki/card-chara-p/UI_Card_Chara_${cardIdStr}_P.webp)`;
  }
  let bgUrl: string | undefined;
  const code = attrCode(card.cardInfo.attribute);
  if (card.cardInfo.rarity === 'N' || card.cardInfo.rarity === 'R') {
    const prefix = showHolo ? 'UI_Card_BG_Horo_' : 'UI_Card_BG_';
    bgUrl = `url(${assetsHost}assets/ongeki/card-bg/${prefix}${card.cardInfo.rarity}_${code}.webp)`;
  }
  return bgUrl ?? '';
}

function getFrame(card: PlayerCard): string {
  const code = attrCode(card.cardInfo?.attribute);
  return getFrameByRarity(card.cardInfo!.rarity, code);
}

function getFrameByRarity(rarity: string, code: string): string {
  let frame: string;
  if (rarity === 'SSR') {
    frame = assetsHost + 'assets/ongeki/card-frame/UI_Card_frame_SSR_00.webp';
  } else if (rarity === 'SR') {
    frame = assetsHost + `assets/ongeki/card-frame/UI_Card_frame_SR_${code}.webp`;
  } else if (rarity === 'SRPlus') {
    frame = assetsHost + 'assets/ongeki/card-frame/UI_Card_frame_SRPlus_00.webp';
  } else {
    frame = assetsHost + `assets/ongeki/card-frame/UI_Card_frame_${rarity}_${code}.webp`;
  }
  return `url(${frame})`;
}

function getHoloFrameByRarity(rarity: string, code: string): string {
  let frame: string;
  if (rarity === 'SSR') {
    frame = assetsHost + 'assets/ongeki/card-frame/UI_Card_frame_SSR_00.webp';
  } else if (rarity === 'SR') {
    frame = assetsHost + `assets/ongeki/card-frame/UI_Card_Frame_Horo_SR_${code}.webp`;
  } else if (rarity === 'SRPlus') {
    frame = assetsHost + 'assets/ongeki/card-frame/UI_Card_frame_SRPlus_00.webp';
  } else {
    frame = assetsHost + `assets/ongeki/card-frame/UI_Card_frame_${rarity}_${code}.webp`;
  }
  return `url(${frame})`;
}

function getChara(card: PlayerCard): string {
  return `url(${assetsHost}assets/ongeki/card-chara-p/UI_Card_Chara_${pad6(card.cardId)}_P.webp)`;
}

function getHoloBGMask(card: PlayerCard, showElements: boolean): string {
  const isSpecial = SPECIAL_HOLO_IDS.includes(card.cardId);
  const charaMaskUrl = `url(${assetsHost}assets/ongeki/card-chara-mask/UI_Card_Chara_Mask_${pad6(card.cardId)}.webp)`;
  let bgUrl: string;
  if (card.cardInfo) {
    if (isSpecial) {
      bgUrl = `url(${assetsHost}assets/ongeki/card-holo/UI_Card_Holo_${pad6(card.cardId)}.webp)`;
    } else if (card.cardInfo.rarity === 'SSR') {
      bgUrl = `url(${assetsHost}assets/ongeki/card-bg/UI_Card_Horo_BG_SSR_00.webp)`;
    } else if (card.cardInfo.rarity === 'SR' || card.cardInfo.rarity === 'SRPlus') {
      bgUrl = `url(${assetsHost}assets/ongeki/card-bg/UI_Card_Horo_BG_SR_00.webp)`;
    } else if (card.cardInfo.rarity === 'R') {
      bgUrl = `url(${assetsHost}assets/ongeki/card-bg/UI_Card_Horo_BG_R_00.webp)`;
    } else {
      bgUrl = `url(${assetsHost}assets/ongeki/card-bg/UI_Card_Horo_BG_N_00.webp)`;
    }
  } else {
    bgUrl = 'linear-gradient(transparent, transparent)';
  }
  if (isSpecial) return bgUrl;
  if (showElements) return `${bgUrl},${charaMaskUrl},${getFrame(card)}`;
  return `${bgUrl},${charaMaskUrl}`;
}

function getHoloFrame(card: PlayerCard): string {
  const code = attrCode(card.cardInfo?.attribute);
  const frameUrl = getHoloFrameByRarity(card.cardInfo!.rarity, code);
  if (card.cardInfo!.rarity === 'SRPlus') {
    return `${getHoloFrameByRarity('SR', code)},${frameUrl}`;
  }
  return frameUrl;
}

function getHoloFrameMask(card: PlayerCard, showElements: boolean): string {
  let frameUrl: string = '';
  if (card.cardInfo) {
    if (SIGN_HOLO_IDS.includes(card.cardId)) {
      frameUrl = showElements
        ? 'linear-gradient(transparent, transparent)'
        : `url(${assetsHost}assets/ongeki/card-holo-sign/UI_Card_Holo_Sign_${pad6(card.cardId)}.webp)`;
    } else if (card.cardInfo.rarity === 'SSR') {
      frameUrl = `url(${assetsHost}assets/ongeki/card-frame/UI_Card_Horo_Frame_SSR_00.webp)`;
    } else if (card.cardInfo.rarity === 'SR' || card.cardInfo.rarity === 'SRPlus') {
      frameUrl = `url(${assetsHost}assets/ongeki/card-frame/UI_Card_Horo_Frame_SR_01.webp)`;
    } else if (card.cardInfo.rarity === 'R') {
      frameUrl = `url(${assetsHost}assets/ongeki/card-frame/UI_Card_Horo_Frame_R_00.webp)`;
    } else {
      frameUrl = `url(${assetsHost}assets/ongeki/card-frame/UI_Card_Horo_Frame_N_00.webp)`;
    }
  }
  if (card.cardInfo?.rarity === 'R' || card.cardInfo?.rarity === 'N') {
    const charaMaskUrl = `url(${assetsHost}assets/ongeki/card-chara-mask/UI_Card_Chara_Mask_${pad6(card.cardId)}.webp)`;
    return `${frameUrl},${charaMaskUrl}`;
  }
  return frameUrl ?? '';
}

function getStarCount(item: PlayerCard): number {
  return (item.maxLevel - (item.kaikaDate === '0000-00-00 00:00:00.0' ? 5 : 45)) / 5;
}

function calculateAtk(level: number, levelParams: number[] | null, isChokaika: boolean): number | null {
  if (levelParams === null) return null;
  if (isChokaika) return levelParams[levelParams.length - 1];
  const levels = [1, 50, 55, 60, 65, 70, 80, 90, 100];
  if (level < levels[0]) level = 1;
  else if (level > levels[levels.length - 4]) level = levels[levels.length - 4];
  for (let i = 0; i < levels.length - 1; i++) {
    if (level >= levels[i] && level < levels[i + 1]) {
      const diff = levels[i + 1] - levels[i];
      const ratio = (level - levels[i]) / diff;
      const atkDiff = levelParams[i + 1] - levelParams[i];
      return Math.floor(levelParams[i] + ratio * atkDiff);
    }
  }
  return null;
}

function getCardName(str: string, rarity: string, nickName: string): string {
  if (!str) return '';
  return str.replace('【SR+】', '【SRPlus】').replace(`【${rarity}】`, '').replace(`[${nickName}]`, '');
}

const GAKUNEN_IMG: Record<string, string> = {
  高校1年生: 'UI_Card_Grade_00001',
  高校2年生: 'UI_Card_Grade_00002',
  高校3年生: 'UI_Card_Grade_00003',
  中学1年生: 'UI_Card_Grade_00004',
  中学2年生: 'UI_Card_Grade_00005',
  中学3年生: 'UI_Card_Grade_00006',
};
const RARITY_IMG: Record<string, string> = {
  N: 'UI_Card_Rare_00_N',
  R: 'UI_Card_Rare_01_R',
  SR: 'UI_Card_Rare_02_SR',
  SSR: 'UI_Card_Rare_03_SSR',
  SRPlus: 'UI_Card_Rare_05_SRPlus',
};
const ATTR_IMG: Record<string, string> = {
  Fire: 'UI_Card_Attribute_00_Red',
  Aqua: 'UI_Card_Attribute_01_Bule',
  Leaf: 'UI_Card_Attribute_02_Green',
};
const SKILL_IMG: Record<string, string> = {
  Attack: 'UI_Card_Skill_00_Attack',
  DangerAttack: 'UI_Card_Skill_00_Attack_Danger',
  Support: 'UI_Card_Skill_01_Assist',
  DangerSupport: 'UI_Card_Skill_01_Assist_Danger',
  Guard: 'UI_Card_Skill_02_Guard',
  DangerGuard: 'UI_Card_Skill_02_Guard_Danger',
  Boost: 'UI_Card_Skill_03_Boost',
  DangerBoost: 'UI_Card_Skill_03_Boost_Danger',
};

/** 等价旧版 ongeki-card-item.component（卡牌渲染） */
export interface OngekiCardItemProps {
  item: PlayerCard;
  showHolo: boolean;
  showElements: boolean;
  holoSheetStyle1?: React.CSSProperties;
  holoSheetStyle2?: React.CSSProperties;
}

export function OngekiCardItem({
  item,
  showHolo,
  showElements,
  holoSheetStyle1,
  holoSheetStyle2,
}: OngekiCardItemProps) {
  const holo = showHolo && item.digitalStock > 0;
  const kaika = item.kaikaDate !== '0000-00-00 00:00:00.0';
  const chokaika = item.choKaikaDate !== '0000-00-00 00:00:00.0';
  const maxAtk = item.cardInfo
    ? calculateAtk(
        item.maxLevel,
        item.cardInfo.levelParam ? item.cardInfo.levelParam.split(',').map((s) => parseFloat(s.trim())) : null,
        chokaika,
      )
    : null;
  const starCount = getStarCount(item);
  const totalStars = item.cardInfo?.rarity === 'N' ? 11 : 5;

  return (
    <div className="card-rotator w-100">
      {item?.cardId === 0 && (
        <div
          className="card-container user-select-none grayscale"
          style={{ backgroundImage: `url(${assetsHost}assets/ongeki/card-bg/UI_Card_BG_N_00.webp)` }}
        >
          <div
            className="w-100 h-100 card-none"
            style={{
              backgroundImage: `url(${assetsHost}assets/ongeki/card-chara-p/UI_Card_Chara_100001_P.webp)`,
            }}
          />
        </div>
      )}
      {item?.cardId !== 0 && !item?.cardInfo && (
        <div
          className="card-container user-select-none grayscale"
          style={{ backgroundImage: getCardBackground(item, holo) }}
        >
          <div className="w-100 h-100 d-flex align-items-center justify-content-center" />
        </div>
      )}
      {item?.cardInfo && (
        <div
          className="card-container user-select-none"
          style={{ backgroundImage: getCardBackground(item, holo) }}
        >
          {showElements && (item.cardInfo.rarity === 'N' || item.cardInfo.rarity === 'R') && (
            <div className="card-frame" style={{ backgroundImage: getFrame(item) }} />
          )}
          <div className="card-chara" style={{ backgroundImage: getChara(item) }} />
          {holo && (
            <div style={holoSheetStyle1} className="position-absolute w-100 h-100">
              <div
                className="card-holo-bg"
                style={{ WebkitMaskImage: getHoloBGMask(item, showElements), maskImage: getHoloBGMask(item, showElements) }}
              />
              <div
                className="card-holo"
                style={{ WebkitMaskImage: getHoloBGMask(item, showElements), maskImage: getHoloBGMask(item, showElements) }}
              />
            </div>
          )}
          {showElements && !holo && !(item.cardInfo.rarity === 'N' || item.cardInfo.rarity === 'R') && (
            <div className="card-frame" style={{ backgroundImage: getFrame(item) }} />
          )}
          {holo && (
            <div style={holoSheetStyle2} className="position-absolute w-100 h-100">
              {!(item.cardInfo.rarity === 'N' || item.cardInfo.rarity === 'R') && (
                <div className="card-frame" style={{ backgroundImage: getHoloFrame(item) }} />
              )}
              <div
                className="card-holo-frame-bg"
                style={{ WebkitMaskImage: getHoloFrameMask(item, showElements), maskImage: getHoloFrameMask(item, showElements) }}
              />
              <div
                className="card-holo"
                style={{ WebkitMaskImage: getHoloFrameMask(item, showElements), maskImage: getHoloFrameMask(item, showElements) }}
              />
            </div>
          )}
          {showElements && (
            <div className="position-absolute w-100 h-100">
              <div>
                {ATTR_IMG[item.cardInfo.attribute] && (
                  <img className="card-attribute" src={assetsHost + `assets/ongeki/gameUi/${ATTR_IMG[item.cardInfo.attribute]}.webp`} alt="" />
                )}
              </div>
              <div>
                {RARITY_IMG[item.cardInfo.rarity] && (
                  <img className="card-rare" src={assetsHost + `assets/ongeki/gameUi/${RARITY_IMG[item.cardInfo.rarity]}.webp`} alt="" />
                )}
              </div>
              <div>
                {GAKUNEN_IMG[item.cardInfo.gakunen] && (
                  <img className="card-gakunen" src={assetsHost + `assets/ongeki/gameUi/${GAKUNEN_IMG[item.cardInfo.gakunen]}.webp`} alt="" />
                )}
              </div>
              {kaika && (
                <img
                  className="card-kaika-state"
                  draggable={false}
                  src={
                    assetsHost +
                    `assets/ongeki/gameUi/${chokaika ? 'UI_CMN_PrintMark_02_tyoukaika' : 'UI_CMN_PrintMark_01_kaika'}.webp`
                  }
                  alt=""
                />
              )}
              {item.skillInfo && SKILL_IMG[item.skillInfo.category] && (
                <div>
                  <div>
                    <img
                      className="card-skill-bg"
                      draggable={false}
                      src={assetsHost + `assets/ongeki/gameUi/${SKILL_IMG[item.skillInfo.category]}.webp`}
                      alt=""
                    />
                  </div>
                </div>
              )}
              {item.maxLevel > 0 && (
                <div className="card-star-container">
                  {Array.from({ length: Math.max(0, starCount) }).map((_, i) => (
                    <img key={i} className="card-star" src={assetsHost + 'assets/ongeki/gameUi/UI_Card_star_00.webp'} alt="" />
                  ))}
                  {Array.from({ length: Math.max(0, totalStars - starCount) }).map((_, i) => (
                    <img key={'e' + i} className="card-star" src={assetsHost + 'assets/ongeki/gameUi/UI_Card_star_01.webp'} alt="" />
                  ))}
                </div>
              )}
              <img
                className="card-max-atk-title"
                draggable={false}
                src={assetsHost + 'assets/ongeki/gameUi/UI_Card_max_00.webp'}
                alt=""
              />
              {maxAtk !== null && (
                <div className="card-max-atk-value-container">
                  {maxAtk >= 100 && (
                    <img
                      className="card-max-atk-value-number"
                      src={assetsHost + `assets/ongeki/gameUi/UI_Card_NUM_attack/${Math.floor(maxAtk / 100)}.webp`}
                      alt=""
                    />
                  )}
                  {maxAtk >= 10 && (
                    <img
                      className="card-max-atk-value-number"
                      src={assetsHost + `assets/ongeki/gameUi/UI_Card_NUM_attack/${Math.floor((maxAtk % 100) / 10)}.webp`}
                      alt=""
                    />
                  )}
                  <img
                    className="card-max-atk-value-number"
                    src={assetsHost + `assets/ongeki/gameUi/UI_Card_NUM_attack/${maxAtk % 10}.webp`}
                    alt=""
                  />
                </div>
              )}
              <div className="card-name">
                <div className="card-name-shadow">
                  <div className="card-name-nick">{item.cardInfo.nickName}</div>
                  <div className="card-name-chara">
                    {getCardName(item.cardInfo.name, item.cardInfo.rarity, item.cardInfo.nickName)}
                  </div>
                </div>
                <div className="card-name-text">
                  <div className="card-name-nick card-text-shadow">{item.cardInfo.nickName}</div>
                  <div className="card-name-chara card-text-shadow">
                    {getCardName(item.cardInfo.name, item.cardInfo.rarity, item.cardInfo.nickName)}
                  </div>
                </div>
              </div>
              <div className="card-info-footer">
                <span>{item.cardId}</span>
                <span>{item.cardInfo.cardNumber}</span>
              </div>
            </div>
          )}
          <div className="card-highlight" />
        </div>
      )}
      <div
        className="card-back"
        style={{ backgroundImage: `url(${assetsHost}assets/ongeki/gameUi/UI_CMN_CardBackSide.webp)` }}
      />
    </div>
  );
}
