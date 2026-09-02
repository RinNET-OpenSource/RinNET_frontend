import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { InfoCircleFill } from 'react-bootstrap-icons';
import { api } from '@/lib/api/client';
import { assetsHost, enableImages } from '@/lib/utils';
import { fullWidth } from '@/lib/format';
import type { OngekiPcRanking, OngekiUserRanking } from './models';
import './ranking.css';

enum RankingType {
  RATING = 'RATING',
  ACTIVITY = 'ACTIVITY',
}

/** 等价旧版 ongeki-user-ranking.component */
export function OngekiUserRankingPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawType = searchParams.get('type');
  const type =
    rawType && Object.values(RankingType).includes(rawType.toUpperCase() as RankingType)
      ? (rawType.toUpperCase() as RankingType)
      : RankingType.RATING;

  const [userRankings, setUserRankings] = useState<OngekiUserRanking[]>([]);
  const [pcRankings, setPcRankings] = useState<OngekiPcRanking[]>([]);

  useEffect(() => {
    if (type === RankingType.RATING) {
      void api.get('api/game/ongeki/data/userRatingRanking').then((data) => setUserRankings(data ?? []));
    } else if (type === RankingType.ACTIVITY) {
      void api.get('api/game/ongeki/data/dailyPcRanking').then((data) => setPcRankings(data?.data ?? []));
    }
  }, [type]);

  function setTypeFilter(next: RankingType) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('type', next.toLowerCase());
      return p;
    });
  }

  const medal = (i: number) => (
    <>
      {i === 0 && <img className="medal" src={assetsHost + 'assets/gold-medal.svg'} alt="" />}
      {i === 1 && <img className="medal" src={assetsHost + 'assets/silver-medal.svg'} alt="" />}
      {i === 2 && <img className="medal" src={assetsHost + 'assets/bronze-medal.svg'} alt="" />}
    </>
  );

  return (
    <div className="content">
      <h1 className="page-heading">{t('Ongeki.UserRankingPage.Title')}</h1>
      <div className="row mb-2 g-1">
        <div className="col-12 col-sm">
          <div className="row justify-content-start align-items-center g-1">
            <div className="col-auto">
              <button
                className={'tab-selector' + (type === RankingType.RATING ? ' tab-selector-active' : '')}
                onClick={() => setTypeFilter(RankingType.RATING)}
              >
                {t('Ongeki.UserRankingPage.Rating')}
              </button>
            </div>
            <div className="col-auto">
              <button
                className={'tab-selector' + (type === RankingType.ACTIVITY ? ' tab-selector-active' : '')}
                onClick={() => setTypeFilter(RankingType.ACTIVITY)}
              >
                {t('Ongeki.UserRankingPage.Activity')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {type === RankingType.RATING && (
        <table className="table table-hover">
          <colgroup>
            <col style={{ width: '2rem' }} />
            <col style={{ width: 'auto' }} />
          </colgroup>
          <tbody>
            {userRankings.map((item, i) => (
              <tr className="ranking-row" key={i}>
                <th className="text-end" scope="row">
                  {medal(i)}
                  {i > 2 && <span className="ranking-text">{item.ranking}.</span>}
                </th>
                <td>
                  <div className="d-flex align-items-center">
                    {enableImages && (
                      <img
                        className={
                          'ranking-item-icon me-2' +
                          (i === 0 ? ' ranking-item-icon-xl' : i === 1 || i === 2 ? ' ranking-item-icon-lg' : '')
                        }
                        src={
                          assetsHost +
                          `/assets/ongeki/card-icon/UI_Card_Icon_${(item as any).cardId}.webp`
                        }
                        alt=""
                      />
                    )}
                    <div>
                      <div className={i <= 2 ? 'fw-bold' : ''}>{fullWidth(item.userName)}</div>
                      <div>
                        <span>{item.nowRating.toFixed(3)}</span>
                        <span className="ms-1 text-secondary small">(Max: {item.highestRating.toFixed(3)})</span>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {type === RankingType.ACTIVITY && (
        <>
          <div className="hstack alert alert-info" role="alert">
            <InfoCircleFill className="me-2" />
            每天24:00统计当天游玩乐曲数。
          </div>
          <table className="table table-hover">
            <colgroup>
              <col style={{ width: '2rem' }} />
              <col style={{ width: 'auto' }} />
            </colgroup>
            <tbody>
              {pcRankings.map((item, i) => (
                <tr className="ranking-row" key={i}>
                  <th className="text-end" scope="row">
                    {medal(i)}
                    {i > 2 && <span className="ranking-text">{i + 1}.</span>}
                  </th>
                  <td>
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center">
                        {enableImages && (
                          <img
                            className={
                              'ranking-item-icon me-2' +
                              (i === 0 ? ' ranking-item-icon-xl' : i === 1 || i === 2 ? ' ranking-item-icon-lg' : '')
                            }
                            src={
                              assetsHost + `/assets/ongeki/card-icon/UI_Card_Icon_${(item as any).cardId}.webp`
                            }
                            alt=""
                          />
                        )}
                        <div className={i <= 2 ? 'fw-bold' : ''}>{fullWidth(item.username)}</div>
                      </div>
                      <div>
                        <span>{item.pc}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
