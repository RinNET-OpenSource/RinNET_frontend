import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './OngekiProfilePage.css';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { dbGetByKey } from '@/lib/db/db';
import { getCurrentUser } from '@/lib/user';
import { assetsHost, enableImages } from '@/lib/utils';
import { fullWidth, compareVersion } from '@/lib/format';
import type { DisplayOngekiProfile, OngekiTrophy } from './models';

/** 等价旧版 ongeki-profile.component */
export function OngekiProfilePage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<DisplayOngekiProfile | null>(null);

  useEffect(() => {
    const aimeId = String(getCurrentUser()?.defaultCard?.extId ?? '');
    void api
      .get('api/game/ongeki/profile', { aimeId })
      .then((data) => {
        const p = data as DisplayOngekiProfile;
        p.rankId = getRankId(p.battlePoint);
        p.rankPattern = getRankPattern(p.battlePoint);
        setProfile(p);
        void dbGetByKey<OngekiTrophy>('ongekiTrophy', p.trophyId).then((x) => {
          if (x) setProfile((prev) => (prev ? { ...prev, trophy: x } : prev));
        });
      })
      .catch((error) => notice(String(error)));
  }, []);

  if (!profile) return null;

  const ratingType = getRatingType(profile.playerRating);
  const newRatingType = getNewRatingType(profile.newPlayerRating);
  const oldRating = compareVersion(profile.lastRomVersion, '1.50.00', '<');
  const pad2 = (n: number) => String(n).padStart(2, '0');

  const maskDigits: number[] = [
    Math.floor(profile.newPlayerRating / 10000),
    Math.floor(profile.newPlayerRating / 1000) % 10,
    -1,
    Math.floor(profile.newPlayerRating / 100) % 10,
    Math.floor(profile.newPlayerRating / 10) % 10,
    Math.floor(profile.newPlayerRating % 10),
  ];
  const maskImage = (digit: number): string => {
    const basePath = `${assetsHost}assets/ongeki/gameUi/UI_NUM_30pt_Rating_${newRatingType}`;
    if (digit === -1) return `url(${basePath}/dot.webp)`;
    return `url(${basePath}/${digit}.webp)`;
  };
  const maskClass = (index: number): string => {
    if (index < 2) return 'rating-num-integer rating-new-num-mask';
    if (index === 2) return 'rating-num-dot rating-new-num-dot rating-new-num-mask';
    return 'rating-num-fractional rating-new-num-fractional rating-new-num-mask';
  };

  return (
    <div className="content ongeki-profile-page">
      <div className="d-flex flex-column align-items-center">
        <div className="col-12 col-sm-8 col-md-6 col-lg-7 col-xl-6">
          <div className="user-data-container p-0 m-3 mb-0">
            <div
              className="trophy-bg"
              style={{
                backgroundImage: `url(${assetsHost}/assets/ongeki/gameUi/UI_CMN_Signage_UserTitle_${pad2(
                  getTrophyRarityCode(profile.trophy?.rarityType ?? ''),
                )}.webp)`,
              }}
            >
              <div className="trophy">{profile.trophy?.name ?? `ID: ${profile.trophyId}`}</div>
            </div>
            <div
              className="level-bg"
              style={{
                backgroundImage: `url(${assetsHost}/assets/ongeki/gameUi/UI_CMN_Signage_UserLevel_BG_00.webp)`,
              }}
            >
              {profile.reincarnationNum > 0 && (
                <div
                  className="rebirth-bg"
                  style={{
                    backgroundImage: `url(${assetsHost}/assets/ongeki/gameUi/UI_CMN_Signage_UserLevel_Rebirth_BG.webp)`,
                  }}
                >
                  <div className="rebirth">{profile.reincarnationNum}</div>
                </div>
              )}
              <div className="level">{profile.level}</div>
            </div>
            <div
              className="name-bg"
              style={{
                backgroundImage: `url(${assetsHost}/assets/ongeki/gameUi/UI_CMN_Signage_UserName_BG.webp)`,
              }}
            >
              <div className="name">{fullWidth(profile.userName)}</div>
            </div>
            <div className="user-icon-border">
              {enableImages && (
                <img
                  className="user-icon"
                  src={assetsHost + `/assets/ongeki/card-icon/UI_Card_Icon_${profile.cardId}.webp`}
                  alt=""
                />
              )}
            </div>
            <img
              className="rank-bg"
              src={assetsHost + `/assets/ongeki/gameUi/UI_CMN_Signage_UserRank_BG_0${profile.rankPattern}.webp`}
              alt=""
            />
            <img
              className={`rank rank-0${profile.rankPattern}`}
              src={
                assetsHost +
                `/assets/ongeki/gameUi/UI_CMN_Signage_UserRank_Rank_${pad2(profile.rankId)}.webp`
              }
              alt=""
            />
            <div className={`battle-point bp-0${profile.rankPattern}`}>
              {profile.battlePoint.toLocaleString()}
            </div>

            {oldRating && (
              <>
                <img
                  className="rating-header"
                  src={assetsHost + `/assets/ongeki/gameUi/UI_NUM_30pt_Rating_${ratingType}_Header.webp`}
                  alt=""
                />
                <div className="rating">
                  {Math.floor(profile.playerRating / 1000) > 0 && (
                    <img
                      className="rating-num-integer"
                      src={
                        assetsHost +
                        `/assets/ongeki/gameUi/UI_NUM_30pt_Rating_${ratingType}/${Math.floor(profile.playerRating / 1000)}.webp`
                      }
                      alt=""
                    />
                  )}
                  <img
                    className="rating-num-integer"
                    src={
                      assetsHost +
                      `/assets/ongeki/gameUi/UI_NUM_30pt_Rating_${ratingType}/${Math.floor(profile.playerRating / 100) % 10}.webp`
                    }
                    alt=""
                  />
                  <img
                    className="rating-num-dot"
                    src={assetsHost + `/assets/ongeki/gameUi/UI_NUM_30pt_Rating_${ratingType}/dot.webp`}
                    alt=""
                  />
                  <img
                    className="rating-num-fractional"
                    src={
                      assetsHost +
                      `/assets/ongeki/gameUi/UI_NUM_30pt_Rating_${ratingType}/${Math.floor(profile.playerRating / 10) % 10}.webp`
                    }
                    alt=""
                  />
                  <img
                    className="rating-num-fractional"
                    src={
                      assetsHost +
                      `/assets/ongeki/gameUi/UI_NUM_30pt_Rating_${ratingType}/${Math.floor(profile.playerRating) % 10}.webp`
                    }
                    alt=""
                  />
                  <div className="rating-highest text-nowrap">
                    (Max: {(profile.highestRating / 100).toFixed(2)})
                  </div>
                </div>
              </>
            )}

            {!oldRating && (
              <>
                <img
                  className="rating-header"
                  src={assetsHost + `/assets/ongeki/gameUi/UI_NUM_30pt_Rating_${newRatingType}_Header.webp`}
                  alt=""
                />
                <div className="rating">
                  {Math.floor(profile.newPlayerRating / 10000) > 0 && (
                    <img
                      className="rating-num-integer"
                      src={
                        assetsHost +
                        `/assets/ongeki/gameUi/UI_NUM_30pt_Rating_${newRatingType}/${Math.floor(profile.newPlayerRating / 10000)}.webp`
                      }
                      alt=""
                    />
                  )}
                  <img
                    className="rating-num-integer"
                    src={
                      assetsHost +
                      `/assets/ongeki/gameUi/UI_NUM_30pt_Rating_${newRatingType}/${Math.floor(profile.newPlayerRating / 1000) % 10}.webp`
                    }
                    alt=""
                  />
                  <img
                    className="rating-num-dot rating-new-num-dot"
                    src={assetsHost + `/assets/ongeki/gameUi/UI_NUM_30pt_Rating_${newRatingType}/dot.webp`}
                    alt=""
                  />
                  <img
                    className="rating-num-fractional rating-new-num-fractional"
                    src={
                      assetsHost +
                      `/assets/ongeki/gameUi/UI_NUM_30pt_Rating_${newRatingType}/${Math.floor(profile.newPlayerRating / 100) % 10}.webp`
                    }
                    alt=""
                  />
                  <img
                    className="rating-num-fractional rating-new-num-fractional"
                    src={
                      assetsHost +
                      `/assets/ongeki/gameUi/UI_NUM_30pt_Rating_${newRatingType}/${Math.floor(profile.newPlayerRating / 10) % 10}.webp`
                    }
                    alt=""
                  />
                  <img
                    className="rating-num-fractional rating-new-num-fractional"
                    src={
                      assetsHost +
                      `/assets/ongeki/gameUi/UI_NUM_30pt_Rating_${newRatingType}/${Math.floor(profile.newPlayerRating) % 10}.webp`
                    }
                    alt=""
                  />
                </div>
                {profile.newPlayerRating >= 20000 && (
                  <div className="rating rating-num-clip-path">
                    {maskDigits.map((digit, i) => (
                      <img
                        key={i}
                        style={{
                          maskImage: maskImage(digit),
                          WebkitMaskImage: maskImage(digit),
                        }}
                        className={maskClass(i)}
                        src={assetsHost + 'assets/ongeki/gameUi/UI_NUM_30pt_Rating_09Rainbow/0-no.webp'}
                        alt=""
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="chara-container">
            {enableImages && (
              <img
                className="chara-img"
                src={assetsHost + `assets/ongeki/character/${profile.characterId}.webp`}
                alt=""
              />
            )}
            <div
              className="chara-back"
              style={{ backgroundImage: `url(${assetsHost}assets/ongeki/back_character.webp)` }}
            />
            <table className="profile-table table table-borderless m-0">
              <tbody>
                <tr>
                  <th>{t('Ongeki.ProfilePage.TotalPlayCount')}</th>
                  <td>{profile.playCount}</td>
                </tr>
                <tr>
                  <th>{t('Ongeki.ProfilePage.Money')}</th>
                  <td>{profile.point}</td>
                </tr>
                <tr>
                  <th>{t('Ongeki.ProfilePage.Medal')}</th>
                  <td>{profile.medalCount}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function getTrophyRarityCode(rt: string): number {
  if (rt === 'Silver') return 1;
  else if (rt === 'Gold') return 2;
  else if (rt === 'Platinum') return 3;
  else if (rt === 'Rainbow') return 4;
  else return 0;
}

function getRatingType(rt: number): string {
  if (rt < 200) return '00Bule';
  else if (rt < 400) return '01Green';
  else if (rt < 700) return '02Orange';
  else if (rt < 1000) return '03Red';
  else if (rt < 1200) return '04Purple';
  else if (rt < 1300) return '05Bronze';
  else if (rt < 1400) return '06Silver';
  else if (rt < 1450) return '07Gold';
  else if (rt < 1500) return '08Platinum';
  else return '09Rainbow';
}

function getNewRatingType(rt: number): string {
  switch (true) {
    case rt >= 22000:
      return '11Rainbow';
    case rt >= 21000:
      return '10Rainbow';
    case rt >= 20000:
      return '09Rainbow';
    case rt >= 19000:
      return '09Rainbow';
    case rt >= 18000:
      return '08Platinum';
    case rt >= 17000:
      return '07Gold';
    case rt >= 15000:
      return '06Silver';
    case rt >= 13000:
      return '05Bronze';
    case rt >= 11000:
      return '04Purple';
    case rt >= 9000:
      return '03Red';
    case rt >= 7000:
      return '02Orange';
    case rt >= 4000:
      return '01Green';
    case rt >= 0:
      return '00Bule';
    default:
      return '09Rainbow';
  }
}

function getRankId(bp: number): number {
  if (bp < 200) return 0;
  else if (bp < 500) return 1;
  else if (bp < 1000) return 2;
  else if (bp < 1500) return 3;
  else if (bp < 2000) return 4;
  else if (bp < 2500) return 5;
  else if (bp < 3000) return 6;
  else if (bp < 3500) return 7;
  else if (bp < 4000) return 8;
  else if (bp < 4500) return 9;
  else if (bp < 5000) return 10;
  else if (bp < 6000) return 11;
  else if (bp < 7000) return 12;
  else if (bp < 8000) return 13;
  else if (bp < 9000) return 14;
  else if (bp < 10000) return 15;
  else if (bp < 11000) return 16;
  else if (bp < 12000) return 17;
  else if (bp < 13000) return 18;
  else if (bp < 14000) return 19;
  else if (bp < 15000) return 20;
  else if (bp < 17000) return 21;
  else if (bp < 19000) return 22;
  else if (bp < 20000) return 23;
  else return 24;
}

function getRankPattern(bp: number): number {
  if (bp < 200) return 0;
  else if (bp < 5000) return 1;
  else if (bp < 12000) return 2;
  else if (bp < 15000) return 3;
  else if (bp < 17000) return 4;
  else if (bp < 19000) return 5;
  else if (bp < 20000) return 6;
  else return 7;
}
