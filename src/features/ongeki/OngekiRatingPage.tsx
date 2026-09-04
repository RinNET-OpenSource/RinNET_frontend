import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExclamationTriangleFill } from 'react-bootstrap-icons';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { dbGetByKey } from '@/lib/db/db';
import { assetsHost, enableImages } from '@/lib/utils';
import { padDigits } from '@/lib/format';
import {
  ClearMarkType,
  type DisplayOngekiProfile,
  type OngekiMusic,
  type PlayerNewRatingItem,
  type PlayerRatingItem,
} from './models';
import {
  NewRatingType,
  calcRate1000,
  getLevel100,
  getTechnicalRankIDByScore,
} from './new-rating';
import { toLevelDecimal, toTechHonorSprite, toTechRating } from './pipes';
import { OngekiSongScoreRanking } from './OngekiSongScoreRanking';
import './ongeki-common.css';

interface RatingV1 {
  bestList: PlayerRatingItem[];
  avgBest: string;
  newBestList: PlayerRatingItem[];
  avgNew: string;
  hotBestList: PlayerRatingItem[];
  avgHot: string;
}

interface RatingV2 {
  newBestList: PlayerNewRatingItem[];
  avgNew: string;
  bestList: PlayerNewRatingItem[];
  avgBest: string;
  platinumList: PlayerNewRatingItem[];
  avgPlatinum: string;
}

const DIFF_NAMES: Record<number, string> = {
  0: 'Basic',
  1: 'Advanced',
  2: 'Expert',
  3: 'Master',
  10: 'Lunatic',
};
const DIFF_CLASS: Record<string, string> = {
  Basic: 'difficulty-basic',
  Advanced: 'difficulty-advanced',
  Expert: 'difficulty-expert',
  Master: 'difficulty-master',
  Lunatic: 'difficulty-lunatic',
};
const LEVEL_FIELD: Record<number, keyof OngekiMusic> = {
  0: 'level0',
  1: 'level1',
  2: 'level2',
  3: 'level3',
  10: 'level4',
};

function getClearMarkType(item: PlayerNewRatingItem): ClearMarkType {
  if (item.isAllBreak) {
    if (item.techScoreMax >= 1010000) return ClearMarkType.AllBreakPlus;
    return ClearMarkType.AllBreak;
  } else if (item.isFullCombo) {
    return ClearMarkType.FullCombo;
  }
  return ClearMarkType.None;
}

function calcRating100(level100: number, score: number): number {
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
  return Math.max(Math.floor(num), 0);
}

function getAvgRating(items: PlayerRatingItem[], total: number): string {
  let sumRating100 = 0;
  for (const item of items) {
    const level100 = getLevel100(item.musicInfo, item.level);
    if (level100 === 0) continue;
    sumRating100 += calcRating100(level100, item.value);
  }
  return (Math.floor(sumRating100 / total) / 100).toFixed(2);
}

function getAvgNewRating(items: PlayerNewRatingItem[], total: number, type: NewRatingType): string {
  let sumRating1000 = 0;
  for (const item of items) {
    sumRating1000 += calcRate1000(item, type);
  }
  return (Math.floor(sumRating1000 / total) / 1000).toFixed(3);
}

/** 等价旧版 ongeki-rating.component */
export function OngekiRatingPage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<DisplayOngekiProfile | null>(null);
  const [ratingV1, setRatingV1] = useState<RatingV1 | null>(null);
  const [ratingV2, setRatingV2] = useState<RatingV2 | null>(null);
  const [avgRating, setAvgRating] = useState<string | null>(null);
  const [detailMusic, setDetailMusic] = useState<OngekiMusic | null>(null);

  useEffect(() => {
    void api
      .get('api/game/ongeki/profile')
      .then((data) => setProfile(data as DisplayOngekiProfile))
      .catch((error) => notice(String(error)));
    void loadNewRating();
  }, []);

  async function loadRating() {
    const newBestList: PlayerRatingItem[] = [];
    const bestList: PlayerRatingItem[] = [];
    const hotBestList: PlayerRatingItem[] = [];
    const avgNew = await load('rating_base_new_best', newBestList, (items) => getAvgRating(items, 15));
    const avgBest = await load('rating_base_best', bestList, (items) => getAvgRating(items, 30));
    const avgHot = await load('rating_base_hot_best', hotBestList, (items) => getAvgRating(items, 10));
    setRatingV1({ newBestList, avgNew, bestList, avgBest, hotBestList, avgHot });
    setAvgRating(getAvgRating([...bestList, ...newBestList, ...hotBestList], 55));
  }

  async function loadNewRating() {
    try {
      const resp = await api.get('api/game/ongeki/newRating');
      if (resp?.status) {
        const statusCode: number = resp.status.code;
        if (statusCode === 92001 && resp.data) {
          const data = resp.data;
          const newBestList: PlayerNewRatingItem[] = data.new10 ?? [];
          const bestList: PlayerNewRatingItem[] = data.old50 ?? [];
          const platinumList: PlayerNewRatingItem[] = data.pScore ?? [];
          for (const item of [...newBestList, ...bestList, ...platinumList]) {
            item.clearMarkType = getClearMarkType(item);
            item.musicInfo = (await dbGetByKey<OngekiMusic>('ongekiMusic', item.musicId)) ?? undefined;
          }
          const avgNew = getAvgNewRating(newBestList, 50, NewRatingType.New);
          const avgBest = getAvgNewRating(bestList, 50, NewRatingType.Best);
          const avgPlatinum = getAvgNewRating(platinumList, 50, NewRatingType.Platinum);
          setRatingV2({ newBestList, avgNew, bestList, avgBest, platinumList, avgPlatinum });
          setAvgRating((Number(avgNew) + Number(avgBest) + Number(avgPlatinum)).toFixed(3));
        } else if (statusCode === 94001) {
          console.log(resp.status.message);
          await loadRating();
        } else if (statusCode === 94041) {
          console.log(resp.status.message);
        }
      }
    } catch (error) {
      notice(String(error));
      console.log(error);
    }
  }

  async function load(
    key: string,
    list: PlayerRatingItem[],
    callback: (items: PlayerRatingItem[]) => string,
  ): Promise<string> {
    const data = await api.get('api/game/ongeki/general', { key });
    if (!data?.propertyValue || data.propertyValue.indexOf(',') < 0) {
      notice("Can't read battle data. Please save again in-game");
    } else {
      const records = data.propertyValue.split(',');
      for (const record of records) {
        const value = record.split(':');
        const item: PlayerRatingItem = {
          musicId: Number(value[0]),
          level: Number(value[1]),
          value: Number(value[2]),
          platinumScoreMax: Number(value[3]),
          platinumScoreStar: Number(value[4]),
        };
        item.musicInfo = (await dbGetByKey<OngekiMusic>('ongekiMusic', item.musicId)) ?? undefined;
        list.push(item);
      }
    }
    return callback(list);
  }

  const defaultJacket = assetsHost + 'assets/ongeki/jacket/UI_Jacket_0000_S.webp';
  const jacketSrc = (musicId: number) =>
    assetsHost + `assets/ongeki/jacket/UI_Jacket_${padDigits(musicId, 4)}_S.webp`;

  const levelBadge = (item: { musicId: number; level: number; musicInfo?: OngekiMusic }) => {
    const name = DIFF_NAMES[item.level];
    const field = LEVEL_FIELD[item.level];
    const levelData = item.musicInfo ? (item.musicInfo[field] as string) : null;
    return (
      <span
        className={
          'difficulty ' +
          DIFF_CLASS[name] +
          ' badge rounded-pill' +
          (item.level === 10 ? ' text-danger border border-danger' : '')
        }
      >
        {levelData ? toLevelDecimal(levelData) ?? name : name}
      </span>
    );
  };

  const newTechItem = (item: PlayerNewRatingItem, index: number, type: NewRatingType) => (
    <div className="col" key={`${type}-${index}`}>
      <div
        className="card rating-card card-btn user-select-none"
        onClick={() => item.musicInfo && setDetailMusic(item.musicInfo)}
      >
        <div className="hstack">
          {enableImages && (
            <img
              className="new-jacket"
              src={jacketSrc(item.musicId)}
              onError={(e) => ((e.target as HTMLImageElement).src = defaultJacket)}
              alt=""
            />
          )}
          {item.musicId !== 0 && (
            <div className="card-body small overflow-hidden py-0 px-2">
              <div className="text-truncate fw-bold m-0">
                {item.musicInfo ? item.musicInfo.name : `MusicID:${item.musicId}`}
              </div>
              <div className="d-flex align-items-center gap-1">
                {levelBadge(item)}
                <div>{item.techScoreMax}</div>
              </div>
            </div>
          )}
          {item.musicId === 0 && (
            <div className="card-body overflow-hidden py-0 px-4 text-truncate">No Record</div>
          )}
        </div>
        <div className="card-footer p-0 px-1">
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <div className="honor">
                <img
                  className="honor-badge"
                  src={assetsHost + `assets/ongeki/gameUi/${toTechHonorSprite(getTechnicalRankIDByScore(item.techScoreMax))}`}
                  alt=""
                />
                {item.clearMarkType === ClearMarkType.AllBreakPlus && (
                  <img
                    className="honor-badge"
                    src={assetsHost + 'assets/ongeki/gameUi/UI_SLC_MusicSelect_HornorBadge_ABPlus.webp'}
                    alt=""
                  />
                )}
                {item.clearMarkType === ClearMarkType.AllBreak && (
                  <img
                    className="honor-badge"
                    src={assetsHost + 'assets/ongeki/gameUi/UI_SLC_MusicSelect_HornorBadge_AB.webp'}
                    alt=""
                  />
                )}
                {item.clearMarkType === ClearMarkType.FullCombo && (
                  <img
                    className="honor-badge"
                    src={assetsHost + 'assets/ongeki/gameUi/UI_SLC_MusicSelect_HornorBadge_FC.webp'}
                    alt=""
                  />
                )}
                {item.clearMarkType === ClearMarkType.None && (
                  <img
                    className="honor-badge"
                    src={assetsHost + 'assets/ongeki/gameUi/UI_SLC_MusicSelect_HornorBadge_None.webp'}
                    alt=""
                  />
                )}
                <img
                  className="honor-badge"
                  src={
                    assetsHost +
                    `assets/ongeki/gameUi/UI_SLC_MusicSelect_HornorBadge_${item.isFullBell ? 'FB' : 'None'}.webp`
                  }
                  alt=""
                />
              </div>
              {item.musicInfo && (
                <div className="text-truncate small">
                  <span className="score-value">{(calcRate1000(item, type) / 1000).toFixed(3)}</span>
                </div>
              )}
            </div>
            <div className="small fw-bold">#{index + 1}</div>
          </div>
        </div>
      </div>
    </div>
  );

  const newPlatinumItem = (item: PlayerNewRatingItem, index: number) => (
    <div className="col" key={`p-${index}`}>
      <div
        className="card rating-card card-btn user-select-none"
        onClick={() => item.musicInfo && setDetailMusic(item.musicInfo)}
      >
        <div className="hstack">
          {enableImages && (
            <img
              className="new-jacket"
              src={jacketSrc(item.musicId)}
              onError={(e) => ((e.target as HTMLImageElement).src = defaultJacket)}
              alt=""
            />
          )}
          {item.musicId !== 0 && (
            <div className="card-body small overflow-hidden py-0 px-2">
              <div className="text-truncate fw-bold m-0">
                {item.musicInfo ? item.musicInfo.name : `MusicID:${item.musicId}`}
              </div>
              <div className="d-flex align-items-center gap-1">
                {levelBadge(item)}
                <div>{item.platinumScoreMax}</div>
              </div>
            </div>
          )}
          {item.musicId === 0 && (
            <div className="card-body overflow-hidden py-0 px-4 text-truncate">No Record</div>
          )}
        </div>
        <div className="card-footer p-0 px-1">
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-1">
              <div className="honor">
                <img
                  className="honor-star"
                  src={assetsHost + `assets/ongeki/gameUi/UI_CMN_Platinum_Star_${item.platinumScoreStar}.webp`}
                  alt=""
                />
              </div>
              {item.musicInfo && (
                <div className="text-truncate small">
                  <span className="score-value">
                    {(calcRate1000(item, NewRatingType.Platinum) / 1000).toFixed(3)}
                  </span>
                </div>
              )}
            </div>
            <div className="small fw-bold">#{index + 1}</div>
          </div>
        </div>
      </div>
    </div>
  );

  const v1Record = (item: PlayerRatingItem, index: number) => {
    const field = LEVEL_FIELD[item.level];
    const levelData = item.musicInfo ? (item.musicInfo[field] as string) : null;
    return (
      <div className="col-12 col-md-6 col-xxl-4" key={`v1-${index}`}>
        <div
          className="card rating-card card-btn user-select-none"
          onClick={() => item.musicInfo && setDetailMusic(item.musicInfo)}
        >
          <div className="hstack">
            {enableImages && (
              <img
                className="jacket rounded-start"
                src={jacketSrc(item.musicId)}
                onError={(e) => ((e.target as HTMLImageElement).src = defaultJacket)}
                alt=""
              />
            )}
            {item.musicId !== 0 && (
              <div className="card-body overflow-hidden py-0 px-2">
                <div className="text-truncate fw-bold m-0">
                  <span>#{index + 1}</span> {item.musicInfo ? item.musicInfo.name : `MusicID:${item.musicId}`}
                </div>
                <div className="text-truncate">{item.value}</div>
                <div className="text-truncate small">
                  {levelBadge(item)}
                  {item.musicInfo && levelData && (
                    <>
                      {' -> '}
                      <span className="score-value">{toTechRating(levelData, item.value)}</span>
                    </>
                  )}
                </div>
              </div>
            )}
            {item.musicId === 0 && (
              <div className="card-body overflow-hidden py-0 px-4 text-truncate">No Record</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="content">
      <h1 className="page-heading">{t('Ongeki.RatingPage.Title')}</h1>

      {ratingV2 && (
        <>
          {profile && (
            <div className="mb-3 d-flex align-items-center">
              <h2 className="mb-0">{t('Ongeki.RatingPage.Overview')}</h2>
            </div>
          )}
          {profile && (
            <div className="mb-4">
              <div className="card user-select-none mb-2">
                <ul className="list-group list-group-flush my-1">
                  <li className="list-group-item">
                    <div>
                      {t('Ongeki.RatingPage.PlayerRating')} {t('Common.Colon')}{' '}
                      {(profile.newPlayerRating / 1000).toFixed(3)}
                    </div>
                  </li>
                  <li className="list-group-item">
                    <div>
                      {t('Ongeki.RatingPage.HighestRating')} {t('Common.Colon')}{' '}
                      {(profile.newHighestRating / 1000).toFixed(3)}
                    </div>
                  </li>
                </ul>
              </div>
              {avgRating !== (profile.newPlayerRating / 1000).toFixed(3) && (
                <div className="alert alert-warning" role="alert">
                  {t('Ongeki.RatingPage.DataVersionWarning')}
                </div>
              )}
            </div>
          )}
          <div className="mb-3 d-flex align-items-center">
            <h2 className="mb-0">{t('Ongeki.RatingPage.New')}</h2>
            <span className="badge bg-primary rounded-pill ms-2">{ratingV2.avgNew}</span>
          </div>
          <div className="row mb-4 g-1 row-cols-xxs-1 row-cols-2 row-cols-sm-3 row-cols-xl-4 row-cols-xxl-5">
            {ratingV2.newBestList.map((item, i) => newTechItem(item, i, NewRatingType.New))}
          </div>
          <div className="mb-3 d-flex align-items-center">
            <h2 className="mb-0">{t('Ongeki.RatingPage.Best')}</h2>
            <span className="badge bg-primary rounded-pill ms-2">{ratingV2.avgBest}</span>
          </div>
          <div className="row mb-4 g-1 row-cols-xxs-1 row-cols-2 row-cols-sm-3 row-cols-xl-4 row-cols-xxl-5">
            {ratingV2.bestList.map((item, i) => newTechItem(item, i, NewRatingType.Best))}
          </div>
          <div className="mb-3 d-flex align-items-center">
            <h2 className="mb-0">{t('Ongeki.RatingPage.Platinum')}</h2>
            <span className="badge bg-primary rounded-pill ms-2">{ratingV2.avgPlatinum}</span>
          </div>
          <div className="row mb-4 g-1 row-cols-xxs-1 row-cols-2 row-cols-sm-3 row-cols-xl-4 row-cols-xxl-5">
            {ratingV2.platinumList.map((item, i) => newPlatinumItem(item, i))}
          </div>
        </>
      )}

      {ratingV1 && (
        <>
          <div className="alert alert-info">
            {t('Ongeki.RatingPage.TipLead')}
            <ul className="m-0 mt-2">
              <li>{t('Ongeki.RatingPage.Tip1')}</li>
              <li>{t('Ongeki.RatingPage.Tip2')}</li>
              <li>{t('Ongeki.RatingPage.Tip3')}</li>
            </ul>
          </div>
          {profile && (
            <div className="card mb-4">
              <div className="card-body">
                <div>
                  {t('Ongeki.RatingPage.PlayerRating')}
                  {t('Common.Colon')}
                  {(profile.playerRating / 100).toFixed(2)}
                </div>
                <div>
                  {t('Ongeki.RatingPage.HighestRating')}
                  {t('Common.Colon')}
                  {(profile.highestRating / 100).toFixed(2)}
                </div>
              </div>
            </div>
          )}
          {avgRating && profile && avgRating !== (profile.playerRating / 100).toFixed(2) && (
            <div className="hstack alert alert-warning" role="alert">
              <ExclamationTriangleFill className="me-2" />
              {t('Ongeki.RatingPage.DataVersionWarning')}
            </div>
          )}
          <div className="mb-3 d-flex align-items-center">
            <h2 className="mb-0">{t('Ongeki.RatingPage.New')}</h2>
            <span className="badge bg-primary rounded-pill ms-2">{ratingV1.avgNew}</span>
          </div>
          <div className="row mb-4 g-2">{ratingV1.newBestList.map((item, i) => v1Record(item, i))}</div>
          <div className="mb-3 d-flex align-items-center">
            <h2 className="mb-0">{t('Ongeki.RatingPage.Best')}</h2>
            <span className="badge bg-primary rounded-pill ms-2">{ratingV1.avgBest}</span>
          </div>
          <div className="row mb-4 g-2">{ratingV1.bestList.map((item, i) => v1Record(item, i))}</div>
          <div className="mb-3 d-flex align-items-center">
            <h2 className="mb-0">{t('Ongeki.RatingPage.Recent')}</h2>
            <span className="badge bg-primary rounded-pill ms-2">{ratingV1.avgHot}</span>
          </div>
          <div className="row mb-4 g-2">{ratingV1.hotBestList.map((item, i) => v1Record(item, i))}</div>
        </>
      )}

      <OngekiSongScoreRanking
        music={detailMusic}
        open={!!detailMusic}
        onClose={() => setDetailMusic(null)}
      />
    </div>
  );
}
