import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BModal } from '@/components/shared/BModal';
import { assetsHost, enableImages } from '@/lib/utils';
import { padDigits } from '@/lib/format';
import { toBattleSprite, toTechSprite, toLevelDecimal } from './pipes';
import { OngekiCardLevel } from './OngekiCardLevel';
import { OngekiSongScoreRanking } from './OngekiSongScoreRanking';
import { Difficulty, type OngekiMusic, type PlayerPlaylog } from './models';
import './recent-item.css';
import './ongeki-common.css';

const DIFF_NAMES: Record<number, string> = {
  0: 'Basic',
  1: 'Advanced',
  2: 'Expert',
  3: 'Master',
  10: 'Lunatic',
};

const ATTR_NAMES: Record<number, string> = { 1: 'Fire', 2: 'Aqua', 3: 'Leaf', 4: 'Max' };

/** 等价旧版 ongeki-recent-item.component（单条游玩记录） */
export function OngekiRecentItem({ playLog }: { playLog: PlayerPlaylog }) {
  const { t } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rankingMusic, setRankingMusic] = useState<OngekiMusic | null>(null);

  const level = playLog.level;
  const levelData =
    level === 0
      ? playLog.songInfo?.level0
      : level === 1
        ? playLog.songInfo?.level1
        : level === 2
          ? playLog.songInfo?.level2
          : level === 3
            ? playLog.songInfo?.level3
            : playLog.songInfo?.level4;

  const diffClass: Record<string, string> = {
    Basic: 'difficulty-basic',
    Advanced: 'difficulty-advanced',
    Expert: 'difficulty-expert',
    Master: 'difficulty-master',
    Lunatic: 'difficulty-lunatic',
  };

  const platinumStars = playLog.platinumScoreStar ?? 0;

  return (
    <div className="card ongeki-recent-item">
      <div className="recent-song-info card-header hstack gap-2">
        <div className="jacket-container ratio ratio-1x1">
          {enableImages && (
            <img
              className="jacket"
              src={assetsHost + `assets/ongeki/jacket/UI_Jacket_${padDigits(playLog.musicId, 4)}.webp`}
              alt=""
            />
          )}
        </div>
        <div className="overflow-hidden">
          <div className="song-info-title text-truncate fw-bold">
            <span>{playLog.songInfo != null ? playLog.songInfo.name : `MusicID:${playLog.musicId}`}</span>
          </div>
          <div className="song-info-artist text-truncate">
            <span>
              {playLog.songInfo != null
                ? playLog.songInfo.artistName
                : t('Ongeki.RecentPage.UnknownArtist')}
            </span>
          </div>
          <div>
            <span className={'difficulty ' + diffClass[DIFF_NAMES[level]] + ' badge rounded-pill'}>
              {DIFF_NAMES[level]} {levelData ? toLevelDecimal(levelData) ?? 'None' : 'None'}
            </span>
          </div>
        </div>
      </div>
      <div className="play-result card-body">
        <div className="row align-items-center">
          <div className="score-area col-12 col-md-6">
            <div className="row text-nowrap">
              <div className="col-6 col-sm-3 col-md-6 col-lg-3 text-end">
                <div className="item-header battle-item-header">
                  <span>BATTLE SCORE</span>
                </div>
                <div className={'score' + (playLog.isBattleNewRecord ? ' new-record' : '')}>
                  <span className="score-font-large">{Math.floor(playLog.battleScore / 10000)}</span>
                  <span className="score-font-small">{padDigits(playLog.battleScore % 10000, 4)}</span>
                </div>
                <div className="item-header battle-item-header">
                  <span>OVER DAMAGE</span>
                </div>
                <div className={'score' + (playLog.isOverDamageNewRecord ? ' new-record' : '')}>
                  <span className="score-font-large">{Math.floor(playLog.overDamage / 100)}</span>
                  <span className="score-font-small">.{padDigits(playLog.overDamage % 100, 2)}%</span>
                </div>
              </div>
              <div className="col-6 col-sm-3 col-md-6 col-lg-3 align-items-center d-flex">
                {enableImages && (
                  <img
                    className="score-stamp"
                    src={assetsHost + `assets/ongeki/gameUi/${toBattleSprite(playLog.battleScoreRank)}`}
                    alt=""
                  />
                )}
              </div>
              <div className="col-6 col-sm-3 col-md-6 col-lg-3 text-end">
                <div className="item-header technical-item-header">
                  <span>TECHNICAL SCORE</span>
                </div>
                <div className={'score' + (playLog.isTechNewRecord ? ' new-record' : '')}>
                  <span className="score-font-large">{Math.floor(playLog.techScore / 10000)}</span>
                  <span className="score-font-small">{padDigits(playLog.techScore % 10000, 4)}</span>
                </div>
                <div className="item-header technical-item-header">
                  <span>PLATINUM</span>
                </div>
                <div className="score">
                  {enableImages && (
                    <div className="platinum-star-container">
                      {Array.from({ length: platinumStars }).map((_, i) => (
                        <img key={i} className="platinum-star" src={assetsHost + 'assets/ongeki/gameUi/UI_Card_star_00.webp'} alt="" />
                      ))}
                      {Array.from({ length: 5 - platinumStars }).map((_, i) => (
                        <img key={'e' + i} className="platinum-star" src={assetsHost + 'assets/ongeki/gameUi/UI_Card_star_01.webp'} alt="" />
                      ))}
                    </div>
                  )}
                  <div className="score-font-large platinum-score">{playLog.platinumScore}</div>
                </div>
              </div>
              <div className="col-6 col-sm-3 col-md-6 col-lg-3 align-items-center d-flex" style={{ maxWidth: 150 }}>
                {enableImages && (
                  <img
                    className="score-stamp"
                    src={assetsHost + `assets/ongeki/gameUi/${toTechSprite(playLog.techScoreRank)}`}
                    alt=""
                  />
                )}
              </div>
            </div>
            <div className="row row-cols-2 align-items-center">
              <div className="col-6 col-sm-auto col-md-6 col-xl-auto text-end">
                {enableImages && (
                  <img
                    className="score-honor"
                    alt=""
                    src={
                      assetsHost +
                      `assets/ongeki/gameUi/UI_RES_Score_FB_${playLog.isFullBell ? 'Badge' : 'Base'}.webp`
                    }
                  />
                )}
              </div>
              <div className="col-6 col-sm-auto col-md-6 col-xl-auto text-start">
                {enableImages && (
                  <img
                    className="score-honor"
                    alt=""
                    src={
                      assetsHost +
                      `assets/ongeki/gameUi/UI_RES_Score_${playLog.isAllBreak ? 'AB' : 'FC'}_${
                        playLog.isFullCombo ? 'Badge' : 'Base'
                      }.webp`
                    }
                  />
                )}
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div className="battle-area row">
              <div className="col-6">
                <div className="recent-chara-container">
                  <div className="chara-center position-relative">
                    <img
                      className="chara-center-img position-absolute"
                      src={
                        assetsHost +
                        `assets/ongeki/card-icon/UI_Card_Icon_${padDigits(playLog.cardInfo2?.id ?? 0, 6)}.webp`
                      }
                      alt=""
                    />
                    <OngekiCardLevel
                      className="chara-center-level position-absolute"
                      level={playLog.cardLevel2}
                      attribute={playLog.cardInfo2?.attribute ?? 'Fire'}
                    />
                  </div>
                  <div className="chara-side position-relative">
                    <img
                      className="chara-side-img position-absolute"
                      src={
                        assetsHost +
                        `assets/ongeki/card-icon/UI_Card_Icon_${padDigits(playLog.cardInfo1?.id ?? 0, 6)}.webp`
                      }
                      alt=""
                    />
                    <OngekiCardLevel
                      className="chara-side-level position-absolute"
                      level={playLog.cardLevel1}
                      attribute={playLog.cardInfo1?.attribute ?? 'Fire'}
                    />
                  </div>
                  <div className="chara-side position-relative">
                    <img
                      className="chara-side-img position-absolute"
                      src={
                        assetsHost +
                        `assets/ongeki/card-icon/UI_Card_Icon_${padDigits(playLog.cardInfo3?.id ?? 0, 6)}.webp`
                      }
                      alt=""
                    />
                    <OngekiCardLevel
                      className="chara-side-level position-absolute"
                      level={playLog.cardLevel3}
                      attribute={playLog.cardInfo3?.attribute ?? 'Fire'}
                    />
                  </div>
                </div>
              </div>
              <div className="col-6">
                <div className="boss position-relative">
                  <img
                    className="boss-img"
                    alt=""
                    src={
                      assetsHost +
                      `assets/ongeki/card-chara/UI_Card_Chara_${padDigits(playLog.songInfo?.bossCardId ?? 0, 6)}.webp`
                    }
                  />
                  <OngekiCardLevel
                    className="boss-level position-absolute"
                    level={playLog.bossLevel}
                    attribute={ATTR_NAMES[playLog.bossAttribute] ?? 'Fire'}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="card-footer fw-bold">
        <div className="float-start">
          <a className="text-primary cursor-pointer" onClick={() => setDetailsOpen(true)}>
            {t('Ongeki.RecentPage.Details')}
          </a>
        </div>
        <div className="float-start ms-3">
          <a
            className="text-primary cursor-pointer"
            onClick={() => playLog.songInfo && setRankingMusic(playLog.songInfo)}
          >
            {t('Ongeki.RecentPage.Ranking')}
          </a>
        </div>
        <div className="float-end">
          <span>{new Date(playLog.userPlayDate).toLocaleString()}</span>
        </div>
      </div>

      <BModal open={detailsOpen} onClose={() => setDetailsOpen(false)} title={t('Ongeki.RecentPage.Details')}>
        <table className="judge-table table table-borderless table-sm table-striped table-dark align-middle">
          <tbody>
            <tr>
              <td className="combo">COMBO</td>
              <td className="combo">{playLog.maxCombo}</td>
            </tr>
            <tr>
              <td className="critical-break">C.BREAK</td>
              <td className="critical-break">{playLog.judgeCriticalBreak}</td>
            </tr>
            <tr>
              <td className="break">BREAK</td>
              <td className="break">{playLog.judgeBreak}</td>
            </tr>
            <tr>
              <td className="hit">HIT</td>
              <td className="hit">{playLog.judgeHit}</td>
            </tr>
            <tr>
              <td className="miss">MISS</td>
              <td className="miss">{playLog.judgeMiss}</td>
            </tr>
            <tr>
              <td className="bell">BELL</td>
              <td className="bell">
                {playLog.bellCount}/{playLog.totalBellCount}
              </td>
            </tr>
            <tr>
              <td className="damage">DAMAGE</td>
              <td className="damage">{playLog.damageCount}</td>
            </tr>
            <tr>
              <td>TAP</td>
              <td>{playLog.rateTap}%</td>
            </tr>
            <tr>
              <td>HOLD</td>
              <td>{playLog.rateHold}%</td>
            </tr>
            <tr>
              <td>FLICK</td>
              <td>{playLog.rateFlick}%</td>
            </tr>
            <tr>
              <td>SIDE TAP</td>
              <td>{playLog.rateSideTap}%</td>
            </tr>
            <tr>
              <td>SIDE HOLD</td>
              <td>{playLog.rateSideHold}%</td>
            </tr>
          </tbody>
        </table>
      </BModal>

      <OngekiSongScoreRanking
        music={rankingMusic}
        open={!!rankingMusic}
        onClose={() => setRankingMusic(null)}
      />
    </div>
  );
}

export const __unusedDifficulty = Difficulty;
