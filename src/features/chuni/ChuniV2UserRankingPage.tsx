import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api/client';
import { assetsHost, enableImages } from '@/lib/utils';
import { characterImage, fullWidth } from '@/lib/format';
import type { ChuniV2PcRanking, ChuniV2UserRanking } from './models';
import './ChuniV2UserRankingPage.css';

enum RankingType {
  RATING = 'RATING',
  ACTIVITY = 'ACTIVITY',
}

/** Equivalent to the legacy Chunithm v2 user-ranking component. */
export function ChuniV2UserRankingPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawType = searchParams.get('type');
  const type =
    rawType && Object.values(RankingType).includes(rawType.toUpperCase() as RankingType)
      ? (rawType.toUpperCase() as RankingType)
      : RankingType.RATING;

  const [userRankings, setUserRankings] = useState<ChuniV2UserRanking[]>([]);
  const [pcRankings, setPcRankings] = useState<ChuniV2PcRanking[]>([]);

  useEffect(() => {
    if (type === RankingType.RATING) {
      void api
        .get('api/game/chuni/v2/data/userRatingRanking')
        .then((data) => setUserRankings(data?.data ?? []));
    } else {
      void api
        .get('api/game/chuni/v2/data/dailyPcRanking')
        .then((data) => setPcRankings(data?.data ?? []));
    }
  }, [type]);

  const setType = (next: RankingType) => {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      params.set('type', next.toLowerCase());
      return params;
    });
  };

  const medal = (index: number) => {
    if (index === 0) return <img className="medal" src={`${assetsHost}assets/gold-medal.svg`} alt="" />;
    if (index === 1) return <img className="medal" src={`${assetsHost}assets/silver-medal.svg`} alt="" />;
    if (index === 2) return <img className="medal" src={`${assetsHost}assets/bronze-medal.svg`} alt="" />;
    return <span className="ranking-text">{index + 1}.</span>;
  };

  const characterClass = (index: number) =>
    `ranking-item-icon me-2${
      index === 0 ? ' ranking-item-icon-xl' : index === 1 || index === 2 ? ' ranking-item-icon-lg' : ''
    }`;

  const characterSrc = (characterId: number | string) =>
    `${assetsHost}/assets/chuni/chara/CHU_UI_Character_${characterImage(characterId)}_02.webp`;

  return (
    <div className="content chuni-v2-user-ranking-page">
      <h1 className="page-heading">{t('ChuniV2.UserRankingPage.Title')}</h1>
      <div className="row mb-2 g-1">
        <div className="col-12 col-sm">
          <div className="row justify-content-start align-items-center g-1">
            <div className="col-auto">
              <button
                type="button"
                className={`tab-selector${type === RankingType.RATING ? ' tab-selector-active' : ''}`}
                onClick={() => setType(RankingType.RATING)}
              >
                {t('ChuniV2.UserRankingPage.Rating')}
              </button>
            </div>
            <div className="col-auto">
              <button
                type="button"
                className={`tab-selector${type === RankingType.ACTIVITY ? ' tab-selector-active' : ''}`}
                onClick={() => setType(RankingType.ACTIVITY)}
              >
                {t('ChuniV2.UserRankingPage.Activity')}
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
            {userRankings.map((item, index) => (
              <tr className="ranking-row" key={`${item.userName}-${index}`}>
                <th className="text-end" scope="row">
                  {medal(index)}
                </th>
                <td>
                  <div className="d-flex align-items-center">
                    {enableImages && <img className={characterClass(index)} src={characterSrc(item.characterId)} alt="" />}
                    <div>
                      <div className={index <= 2 ? 'fw-bold' : ''}>{fullWidth(item.userName)}</div>
                      <div>
                        {(item.nowRating / 100).toFixed(2)}
                        <span className="ms-1 text-secondary small">
                          (Max: {(item.highestRating / 100).toFixed(2)})
                        </span>
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
          <p className="mt-3">Updated at 0:00 every day</p>
          <table className="table table-hover">
            <colgroup>
              <col style={{ width: '2rem' }} />
              <col style={{ width: 'auto' }} />
            </colgroup>
            <tbody>
              {pcRankings.map((item, index) => (
                <tr className="ranking-row" key={`${item.username}-${index}`}>
                  <th className="text-end" scope="row">
                    {medal(index)}
                  </th>
                  <td>
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center">
                        {enableImages && (
                          <img className={characterClass(index)} src={characterSrc(item.characterId)} alt="" />
                        )}
                        <div className={index <= 2 ? 'fw-bold' : ''}>{fullWidth(item.username)}</div>
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
