import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { compareVersions } from 'compare-versions';
import { dbGetByKey } from '@/lib/db/db';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { getCurrentUser, loadUser } from '@/lib/user';
import { assetsHost, enableImages } from '@/lib/utils';
import { formatNumber, padDigits } from '@/lib/format';
import type { ChuniV2Profile, ChuniV2RatingItem } from './models';
import { ChuniV2SongScoreRanking } from './ChuniV2SongScoreRanking';
import type { ChuniV2Song } from './song-models';
import './ChuniV2RatingPage.css';

function rating(value: number, digits = 2): string {
  return formatNumber(value / 100, digits, digits);
}

function difficulty(level: number): { className: string; label: string } | null {
  const values = [
    ['difficulty-basic', 'Basic'],
    ['difficulty-advanced', 'Advanced'],
    ['difficulty-expert', 'Expert'],
    ['difficulty-master', 'Master'],
    ['difficulty-ultima text-danger border border-danger', 'Ultima'],
  ] as const;
  const value = values[level];
  return value ? { className: value[0], label: value[1] } : null;
}

function RatingRecord({
  item,
  index,
  onOpen,
}: {
  item: ChuniV2RatingItem;
  index: number;
  onOpen: (item: ChuniV2RatingItem) => void;
}) {
  const level = difficulty(item.level);
  return (
    <div className="col-12 col-md-6 col-xxl-4">
      <div
        className={`card rating-card${item.musicId !== 0 ? ' card-btn' : ''}`}
        onClick={() => item.musicId !== 0 && onOpen(item)}
        onKeyDown={(event) => {
          if (item.musicId !== 0 && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            onOpen(item);
          }
        }}
        role={item.musicId !== 0 ? 'button' : undefined}
        tabIndex={item.musicId !== 0 ? 0 : undefined}
      >
        <div className="hstack">
          {enableImages && (
            <img
              className="jacket rounded-start"
              src={`${assetsHost}assets/chuni/jacket/CHU_UI_Jacket_${padDigits(item.musicId, 4)}.webp`}
              alt=""
            />
          )}
          {item.musicId !== 0 ? (
            <div className="card-body overflow-hidden py-0 px-2">
              <div className="text-truncate fw-bold m-0">
                <span>#{index + 1}</span> {item.musicName}
              </div>
              <div className="text-truncate">{item.score}</div>
              <div className="text-truncate small rating-score">
                {level && (
                  <span className={`${level.className} badge rounded-pill`}>
                    {level.label} {rating(item.ratingBase, 1)}
                  </span>
                )}
                <b>➛</b>
                <span className="score-value">{rating(item.rating)}</span>
              </div>
            </div>
          ) : (
            <div className="card-body overflow-hidden py-0 px-4 text-truncate">No Record</div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingRating({ label }: { label: string }) {
  return (
    <div className="placeholder-wave">
      <div className="mb-3 d-flex align-items-center">
        <h2 className="mb-0">
          <span className="placeholder">{label}</span>
        </h2>
      </div>
      <div className="row mb-4 g-2">
        <div className="col-12 col-md-6 col-xxl-4">
          <div className="card rating-card">
            <div className="hstack">
              <div className="jacket rounded-start placeholder" />
              <div className="card-body overflow-hidden user-select-none py-0 px-2">
                <div className="fw-bold m-0 mb-1 placeholder">
                  <span className="placeholder">#0 Music Title</span>
                </div>
                <div className="text-truncate mb-1">
                  <span className="placeholder">1010000</span>
                </div>
                <div className="text-truncate small rating-score">
                  <span className="score-value placeholder">Master 10.0 ➛ 12.15</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Equivalent to the legacy Chunithm v2 rating component. */
export function ChuniV2RatingPage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ChuniV2Profile | null>(null);
  const [top, setTop] = useState<ChuniV2RatingItem[] | null>(null);
  const [recent, setRecent] = useState<ChuniV2RatingItem[] | null>(null);
  const [newRating, setNewRating] = useState<ChuniV2RatingItem[] | null>(null);
  const [loadingRating, setLoadingRating] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [detailMusic, setDetailMusic] = useState<ChuniV2Song | null>(null);
  const [detailLevel, setDetailLevel] = useState<number | undefined>(undefined);

  async function openSongDetail(item: ChuniV2RatingItem) {
    if (item.musicId === 0) return;
    try {
      const music = await dbGetByKey<ChuniV2Song>('chusanMusic', item.musicId);
      if (!music) {
        notice(`找不到乐曲数据: ${item.musicId}`);
        return;
      }
      setDetailLevel(item.level);
      setDetailMusic(music);
    } catch (error) {
      notice(`乐曲详情加载失败: ${String(error)}`);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadUser();
        const aimeId = String(getCurrentUser()?.defaultCard?.extId ?? '');
        const loadedProfile = (await api.get('api/game/chuni/v2/profile', { aimeId })) as ChuniV2Profile;
        setProfile(loadedProfile);

        if (compareVersions(loadedProfile.lastRomVersion, '2.30.00') >= 0) {
          const data = await api.get('api/game/chuni/v2/verse-rating', { aimeId });
          setTop(data?.old ?? []);
          setNewRating(data?.new ?? []);
          setRecent(null);
          setLoadingRating(false);
          setLoadingRecent(false);
          return;
        }

        const [best, loadedRecent] = await Promise.all([
          api.get('api/game/chuni/v2/rating', { aimeId }),
          api.get('api/game/chuni/v2/rating/recent', { aimeId }),
        ]);
        setTop(best ?? []);
        setRecent(loadedRecent ?? []);
        setNewRating(null);
        setLoadingRating(false);
        setLoadingRecent(false);
      } catch (error) {
        notice(String(error));
        setLoadingRating(false);
        setLoadingRecent(false);
      }
    })();
  }, []);

  const topTotal = top?.reduce((sum, item) => sum + item.rating, 0) ?? 0;
  const recentTotal = recent?.reduce((sum, item) => sum + item.rating, 0) ?? 0;
  const newTotal = newRating?.reduce((sum, item) => sum + item.rating, 0) ?? 0;
  const denominator = newRating ? 50 : 40;
  const calculatedRating = (topTotal + (newRating ? newTotal : recentTotal)) / denominator;

  return (
    <div className="content chuni-v2-rating-page">
      <h1 className="page-heading">{t('ChuniV2.RatingPage.Title')}</h1>

      {profile?.playerRating ? (
        <>
          <div className="mb-3 d-flex align-items-center">
            <h2 className="mb-0">{t('ChuniV2.RatingPage.Overview')}</h2>
          </div>
          <div className="mb-4">
            <div className="card user-select-none mb-2">
              <ul className="list-group list-group-flush my-1">
                <li className="list-group-item">
                  <div>
                    {t('ChuniV2.RatingPage.PlayerRating')} {t('Common.Colon')} {rating(profile.playerRating)}
                  </div>
                </li>
                <li className="list-group-item">
                  <div>
                    {t('ChuniV2.RatingPage.HighestRating')} {t('Common.Colon')} {rating(profile.highestRating)}
                  </div>
                </li>
              </ul>
            </div>
            {!loadingRating && profile.playerRating !== calculatedRating && (
              <div className="alert alert-warning" role="alert">
                {t('ChuniV2.RatingPage.DataVersionWarning')}
              </div>
            )}
          </div>
        </>
      ) : null}

      {loadingRating && <LoadingRating label="Best" />}
      {loadingRecent && <LoadingRating label="Recent" />}

      {!loadingRating && newRating && (
        <>
          <div className="mb-3 d-flex align-items-center">
            <h2 className="mb-0">{t('ChuniV2.RatingPage.New')}</h2>
            <span className="badge bg-primary rounded-pill ms-2">{rating(newTotal / 20)}</span>
          </div>
          <div className="row mb-4 g-2">
            {newRating.map((item, index) => (
              <RatingRecord
                item={item}
                index={index}
                onOpen={openSongDetail}
                key={`${item.musicId}-${item.level}-${index}`}
              />
            ))}
          </div>
        </>
      )}

      {!loadingRating && top && (
        <>
          <div className="mb-3 d-flex align-items-center">
            <h2 className="mb-0">{t('ChuniV2.RatingPage.Best')}</h2>
            <span className="badge bg-primary rounded-pill ms-2">{rating(topTotal / 30)}</span>
          </div>
          <div className="row mb-4 g-2">
            {top.map((item, index) => (
              <RatingRecord
                item={item}
                index={index}
                onOpen={openSongDetail}
                key={`${item.musicId}-${item.level}-${index}`}
              />
            ))}
          </div>
        </>
      )}

      {!loadingRecent && recent && (
        <>
          <div className="mb-3 d-flex align-items-center">
            <h2 className="mb-0">{t('ChuniV2.RatingPage.Recent')}</h2>
            <span className="badge bg-primary rounded-pill ms-2">{rating(recentTotal / 10)}</span>
          </div>
          <div className="row mb-4 g-2">
            {recent.map((item, index) => (
              <RatingRecord
                item={item}
                index={index}
                onOpen={openSongDetail}
                key={`${item.musicId}-${item.level}-${index}`}
              />
            ))}
          </div>
        </>
      )}

      <ChuniV2SongScoreRanking
        music={detailMusic}
        open={detailMusic !== null}
        initialLevel={detailLevel}
        onClose={() => {
          setDetailMusic(null);
          setDetailLevel(undefined);
        }}
      />
    </div>
  );
}
