import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api/client';
import { dbGetByKey } from '@/lib/db/db';
import { preloadStates } from '@/lib/db/preload';
import { formatNumber } from '@/lib/format';
import { notice } from '@/lib/message';
import { useStore } from '@/lib/store';
import { getCurrentUser, loadUser } from '@/lib/user';
import { assetsHost } from '@/lib/utils';
import { Maimai2SongDetail } from './Maimai2SongDetail';
import type { Maimai2Music, Maimai2RatingItem } from './models';
import './Maimai2RatingPage.css';

const rankIcons = ['sp', 'ss', 'ssp', 'sss', 'sssp'] as const;

function jacketId(input: number): string {
  return input.toString().slice(-4).padStart(6, '0');
}

function imageFallback(event: React.SyntheticEvent<HTMLImageElement>) {
  const fallback = `${assetsHost}assets/mai2/jacket/UI_Jacket_000000.webp`;
  if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
}

function calcRate(level: number, achievement: number): number {
  const records = [
    [0, 0], [100000, 16], [200000, 32], [300000, 48], [400000, 64], [500000, 80],
    [600000, 96], [700000, 112], [750000, 120], [799999, 128], [800000, 136],
    [900000, 152], [940000, 168], [969999, 176], [970000, 200], [980000, 203],
    [989999, 206], [990000, 208], [995000, 211], [999999, 214], [1000000, 216],
    [1004999, 222], [1005000, 224],
  ] as const;
  const capped = Math.min(achievement, records[22][0]);
  let offset = 0;
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (records[index][0] <= capped) {
      offset = records[index][1];
      break;
    }
  }
  return Math.floor((level * capped * offset) / 100_000_000);
}

function ratingGrowth(playerRating: number): number {
  if (playerRating <= 200) return 50;
  if (playerRating <= 250) return 40;
  if (playerRating <= 300) return 30;
  return 20;
}

function targetDs(rating: number, maximum: number, rank: number): Record<number, number> {
  const result: Record<number, number> = {};
  for (let difficulty = 10; difficulty <= 150; difficulty += 1) {
    const computed = calcRate(difficulty, rank);
    if (computed > rating && computed <= maximum) result[difficulty] = computed;
  }
  return result;
}

async function loadRating(aimeId: string, type: 'rating' | 'new_rating'): Promise<Maimai2RatingItem[]> {
  const response = await api.get(`api/game/maimai2/${type}`, { aimeId });
  const compact = String(response?.data ?? '');
  if (!compact) return [];
  return Promise.all(
    compact.split(',').map(async (record: string) => {
      const values = record.split(':').map(Number);
      const music = await dbGetByKey<Maimai2Music>('maimai2Music', values[0]);
      const detail = music?.details[values[1]];
      return {
        musicId: values[0],
        level: values[1],
        romVersion: values[2],
        score: values[3],
        artistName: music?.artistName ?? 'Unknown Artist',
        ratingBase: detail?.levelDecimal ?? 0,
        rating: 0,
        musicName: music?.name ?? `MusicID: ${values[0]}`,
        music,
      };
    }),
  );
}

function difficulty(level: number): { className: string; label: string } | null {
  const values = [
    ['difficulty-basic', 'Basic'],
    ['difficulty-advanced', 'Advanced'],
    ['difficulty-expert', 'Expert'],
    ['difficulty-master', 'Master'],
    ['difficulty-remaster', 'Re:Master'],
  ] as const;
  const value = values[level];
  return value ? { className: value[0], label: value[1] } : null;
}

function RatingRecord({ item, index, onOpen }: {
  item: Maimai2RatingItem;
  index: number;
  onOpen: (music: Maimai2Music | null) => void;
}) {
  const meta = difficulty(item.level);
  return (
    <div className="col-12 col-md-6 col-xxl-4">
      <div className="card card-btn rating-card" onClick={() => onOpen(item.music ?? null)}>
        <div className="hstack">
          <img
            className="jacket rounded-start"
            src={`${assetsHost}assets/mai2/jacket/UI_Jacket_${jacketId(item.musicId)}.webp`}
            onError={imageFallback}
            alt=""
          />
          {item.musicId !== 0 ? (
            <div className="card-body overflow-hidden py-0 px-2">
              <div className="text-truncate fw-bold m-0"><span>#{index + 1}</span> {item.musicName}</div>
              <div className="text-truncate">{formatNumber(item.score / 10_000, 4, 4)}%</div>
              <div className="text-truncate small rating-score">
                {meta && (
                  <span className={`${meta.className} badge rounded-pill`}>
                    {meta.label} {formatNumber(item.ratingBase / 10, 1, 1)}
                  </span>
                )}
                <b>➛</b>
                {item.rating}
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

/** Equivalent to the legacy maimai2 best-50 rating component. */
export function Maimai2RatingPage() {
  const { t } = useTranslation();
  const catalogStates = useStore(preloadStates);
  const [best35, setBest35] = useState<Maimai2RatingItem[]>([]);
  const [best15, setBest15] = useState<Maimai2RatingItem[]>([]);
  const [detailMusic, setDetailMusic] = useState<Maimai2Music | null>(null);
  const catalogReady = catalogStates.maimai2Music === 'OK';

  useEffect(() => {
    if (!catalogReady) return;
    let active = true;
    void (async () => {
      try {
        await loadUser();
        const aimeId = String(getCurrentUser()?.defaultCard?.extId ?? '');
        const [oldSongs, newSongs] = await Promise.all([
          loadRating(aimeId, 'rating'),
          loadRating(aimeId, 'new_rating'),
        ]);
        oldSongs.forEach((item) => { item.rating = calcRate(item.ratingBase, item.score); });
        newSongs.forEach((item) => { item.rating = calcRate(item.ratingBase, item.score); });
        if (!active) return;
        setBest35(oldSongs);
        setBest15(newSongs);
      } catch (error) {
        if (active) notice(String(error));
      }
    })();
    return () => { active = false; };
  }, [catalogReady]);

  const b35rating = best35.reduce((sum, item) => sum + item.rating, 0);
  const b15rating = best15.reduce((sum, item) => sum + item.rating, 0);
  const playerRating = b35rating + b15rating;

  const recommendation = useMemo(() => {
    if (best35.length === 0) {
      return { headers: [0, 0, 0, 0, 0], rows: [{}, {}, {}, {}, {}] as Array<Record<number, number>> };
    }
    let highest = 0;
    for (const item of best35) {
      if (item.rating > highest) highest = item.rating;
    }
    const maximum = highest + ratingGrowth(highest);
    const rows = [980000, 990000, 995000, 1000000, 1005000].map((rank) => targetDs(highest, maximum, rank));
    const ratingBases = Object.keys(rows[4]).map(Number).sort((left, right) => left - right);
    const preliminary = [0.2, 0.4, 0.6, 0.8, 1].map((percentile) =>
      ratingBases[Math.ceil(percentile * ratingBases.length) - 1],
    );
    const headers = [0, 0, 0, 0, 0];
    let insertion = 4;
    let last = 0;
    for (let index = 4; index >= 0; index -= 1) {
      if (preliminary[index] !== last) {
        headers[insertion] = preliminary[index] ?? 0;
        last = preliminary[index] ?? 0;
        insertion -= 1;
      }
    }
    return { headers, rows };
  }, [best35]);

  const recommendationValue = (ratingBase: number, rank: number) =>
    recommendation.rows[rank]?.[ratingBase] === undefined ? ' ' : String(recommendation.rows[rank][ratingBase]);

  return (
    <div className="maimai2-rating-page">
      <h1 className="page-heading">{t('Maimai2.RatingPage.Title')}</h1>

      <div className="card p-1 mt-3">
        <div className="row justify-content-between p-3 align-items-center" style={{ fontSize: '1.25rem' }}>
          <span className="col-auto">Rating:</span>
          <span className="col-auto">
            <span className="player-rating" style={{ fontSize: '0.75rem' }}>{b35rating}+{b15rating}=</span>
            {playerRating}
          </span>
        </div>
      </div>

      <div className="card mt-3 mb-3">
        <div className="card-body">
          <span className="card-title" style={{ fontSize: '1.25rem' }}>{t('Maimai2.RatingPage.ElevateRecommend')}</span>

          <div className="table-container d-block d-md-none">
            <table className="table table-striped" style={{ textAlign: 'center' }}>
              <thead>
                <tr>
                  <th />
                  {recommendation.headers.map((header, index) => (
                    <th style={{ fontWeight: 'bold' }} key={index}>{header !== 0 ? header / 10 : ' '}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rankIcons.map((icon, rowIndex) => (
                  <tr key={icon}>
                    <td><img className="rank-icon" src={`${assetsHost}assets/mai2/common/music_icon_${icon}.webp`} alt="" /></td>
                    {recommendation.headers.map((header, index) => (
                      <td key={index}>{recommendationValue(header, rowIndex)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-container d-none d-md-block">
            <table className="table table-striped" style={{ textAlign: 'center' }}>
              <thead>
                <tr>
                  <th />
                  {rankIcons.map((icon) => (
                    <th key={icon}><img className="rank-icon" src={`${assetsHost}assets/mai2/common/music_icon_${icon}.webp`} alt="" /></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recommendation.headers.map((header, rowIndex) => (
                  <tr key={rowIndex}>
                    <td style={{ fontWeight: 'bold' }}>{header !== 0 ? header / 10 : ' '}</td>
                    {rankIcons.map((_, rankIndex) => <td key={rankIndex}>{recommendationValue(header, rankIndex)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mb-3 d-flex align-items-center mt-3">
        <h2 className="mb-0">{t('Maimai2.RatingPage.B35')}</h2>
        <span className="badge bg-secondary text-bg-secondary rounded-pill ms-2">{b35rating}</span>
      </div>
      <div className="row mb-4 g-2">
        {best35.map((item, index) => (
          <RatingRecord item={item} index={index} onOpen={setDetailMusic} key={`${item.musicId}-${item.level}-${index}`} />
        ))}
      </div>

      <div className="mb-3 d-flex align-items-center mt-3">
        <h2 className="mb-0">{t('Maimai2.RatingPage.B15')}</h2>
        <span className="badge bg-info text-bg-info rounded-pill ms-2">{b15rating}</span>
      </div>
      <div className="row mb-4 g-2">
        {best15.map((item, index) => (
          <RatingRecord item={item} index={index} onOpen={setDetailMusic} key={`${item.musicId}-${item.level}-${index}`} />
        ))}
      </div>

      <Maimai2SongDetail music={detailMusic} open={detailMusic !== null} onClose={() => setDetailMusic(null)} />
    </div>
  );
}
