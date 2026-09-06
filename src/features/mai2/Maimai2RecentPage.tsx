import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api/client';
import { dbGetByKey } from '@/lib/db/db';
import { preloadStates } from '@/lib/db/preload';
import { notice } from '@/lib/message';
import { useStore } from '@/lib/store';
import { getCurrentUser, loadUser } from '@/lib/user';
import { assetsHost, enableImages } from '@/lib/utils';
import { Maimai2Pagination } from './Maimai2Pagination';
import { Maimai2SongDetail } from './Maimai2SongDetail';
import type { Maimai2Music, Maimai2Playlog } from './models';
import './Maimai2RecentPage.css';

interface PageResponse<T> {
  content?: T[];
  totalElements?: number;
}

const PAGE_SIZE = 10;
const difficultyLabels = ['Basic', 'Advanced', 'Expert', 'Master', 'Re:Master'] as const;
const difficultyClasses = [
  'difficulty-basic',
  'difficulty-advanced',
  'difficulty-expert',
  'difficulty-master',
  'difficulty-remaster',
] as const;

function jacketId(input: number): string {
  return input.toString().slice(-4).padStart(6, '0');
}

function imageFallback(event: React.SyntheticEvent<HTMLImageElement>) {
  const fallback = `${assetsHost}assets/mai2/jacket/UI_Jacket_000000.webp`;
  if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
}

function comboIcon(status: number): string {
  return ['', 'music_icon_fc', 'music_icon_fcp', 'music_icon_ap', 'music_icon_app'][status] ?? '';
}

function syncIcon(status: number): string {
  return ['', 'music_icon_fs', 'music_icon_fsp', 'music_icon_fdx', 'music_icon_fdxp', 'music_icon_sync'][status] ?? '';
}

function rankIcon(rank: number): string {
  return [
    'music_icon_d', 'music_icon_c', 'music_icon_b', 'music_icon_bb', 'music_icon_bbb',
    'music_icon_a', 'music_icon_aa', 'music_icon_aaa', 'music_icon_s', 'music_icon_sp',
    'music_icon_ss', 'music_icon_ssp', 'music_icon_sss', 'music_icon_sssp',
  ][rank] ?? '';
}

function dxScoreStar(item: Maimai2Playlog): string {
  const theoryDeluxe = item.totalCombo * 3;
  if (item.deluxscore >= theoryDeluxe * 0.97) return '⭐⭐⭐⭐⭐';
  if (item.deluxscore >= theoryDeluxe * 0.95) return '⭐⭐⭐⭐';
  if (item.deluxscore >= theoryDeluxe * 0.93) return '⭐⭐⭐';
  if (item.deluxscore >= theoryDeluxe * 0.9) return '⭐⭐';
  if (item.deluxscore >= theoryDeluxe * 0.85) return '⭐';
  return 'DXScore';
}

function DifficultyBadge({ item }: { item: Maimai2Playlog }) {
  if (!item.songInfo) return null;
  if (item.level === 9) {
    return <span className="difficulty difficulty-utage badge rounded-pill">U﹒TA﹒GE</span>;
  }
  const label = difficultyLabels[item.level];
  const className = difficultyClasses[item.level];
  const detail = item.songInfo.details[item.level];
  if (!label || !className || !detail) return null;
  return (
    <span className={`difficulty ${className} badge rounded-pill`}>
      {label} {(detail.levelDecimal / 10).toFixed(1)}
    </span>
  );
}

function DetailValue({ label, color, children }: { label: string; color?: string; children: ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: '8rem' }}>
      <div
        className={color ? undefined : 'small'}
        style={{
          color,
          fontWeight: color ? 'bold' : undefined,
          height: '1.25rem',
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {label}
      </div>
      <div className="dx-rating-container p-1 bg-secondary-subtle mt-1">
        <div className="dx-rating-textholder">{children}</div>
      </div>
    </div>
  );
}

function JudgmentRows({ item }: { item: Maimai2Playlog }) {
  const rows: Array<[string, number, number, number, number, number]> = [
    ['TAP', item.tapCriticalPerfect, item.tapPerfect, item.tapGreat, item.tapGood, item.tapMiss],
    ['HOLD', item.holdCriticalPerfect, item.holdPerfect, item.holdGreat, item.holdGood, item.holdMiss],
    ['SLIDE', item.slideCriticalPerfect, item.slidePerfect, item.slideGreat, item.slideGood, item.slideMiss],
  ];
  if (item.isTouch) {
    rows.push(['TOUCH', item.touchCriticalPerfect, item.touchPerfect, item.touchGreat, item.touchGood, item.touchMiss]);
  }
  rows.push(['BREAK', item.breakCriticalPerfect, item.breakPerfect, item.breakGreat, item.breakGood, item.breakMiss]);
  return rows.map(([label, ...values]) => (
    <tr key={label}>
      <td>{label}</td>
      {values.map((value, index) => <td key={index}>{value}</td>)}
    </tr>
  ));
}

/** Equivalent to the legacy maimai2 recent-play component. */
export function Maimai2RecentPage() {
  const { t } = useTranslation();
  const catalogStates = useStore(preloadStates);
  const [recent, setRecent] = useState<Maimai2Playlog[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [detailMusic, setDetailMusic] = useState<Maimai2Music | null>(null);
  const catalogReady = catalogStates.maimai2Music === 'OK';

  useEffect(() => {
    if (!catalogReady) return;
    let active = true;
    setExpandedIndex(null);
    void (async () => {
      try {
        await loadUser();
        const aimeId = String(getCurrentUser()?.defaultCard?.extId ?? '');
        const data = (await api.get('api/game/maimai2/recent', {
          aimeId,
          page: currentPage - 1,
        })) as PageResponse<Maimai2Playlog>;
        const rows = await Promise.all(
          (data.content ?? []).map(async (item) => ({
            ...item,
            songInfo: await dbGetByKey<Maimai2Music>('maimai2Music', item.musicId),
          })),
        );
        if (!active) return;
        setRecent(rows);
        setTotalElements(data.totalElements ?? rows.length);
      } catch (error) {
        if (active) notice(String(error));
      }
    })();
    return () => { active = false; };
  }, [catalogReady, currentPage]);

  return (
    <div className="maimai2-recent-page">
      <h1 className="page-heading">{t('Maimai2.RecentPage.Title')}</h1>

      <div className="record d-flex flex-column gap-3">
        {recent.map((item, index) => {
          const hasCombo = item.comboStatus !== 0;
          const hasMultiplayer = item.playerNum > 1;
          const showClear = !hasCombo && !hasMultiplayer && item.isClear;
          const expanded = expandedIndex === index;
          return (
            <div className="card" key={`${item.playlogId}-${item.musicId}-${index}`}>
              <div className="card-header px-3 py-2">
                <div className="d-flex align-items-center justify-content-between gap-2">
                  <span className="no-wrap track-num-title" style={{ fontSize: '0.875rem' }}>TRACK {item.trackNo}</span>
                  <DifficultyBadge item={item} />
                </div>
              </div>

              <div className="card-body gap-2 d-grid">
                <div className="d-block gap-2 d-flex align-items-center">
                  <div>
                    {enableImages && (
                      <img
                        className="song-jacket cover-full"
                        src={`${assetsHost}assets/mai2/jacket/UI_Jacket_${jacketId(item.musicId)}.webp`}
                        onError={imageFallback}
                        alt=""
                      />
                    )}
                  </div>
                  <div className="d-grid gap-4 position-relative w-100">
                    <div className="overflow-hidden" style={{ textOverflow: 'ellipsis' }}>
                      <h3 className="text-nowrap fw-bold m-0">{item.songInfo?.name ?? `musicId:${item.musicId}`}</h3>
                      <div className="text-nowrap fw-light">{item.songInfo?.artistName ?? 'artist'}</div>
                    </div>
                    <div>
                      <div className="d-flex justify-content-between h-100 gap-1" style={{ flexFlow: 'column' }}>
                        <div className="position-relative">
                          <div>
                            <h3 className="d-inline-block m-0">{Math.floor(item.achievement / 10_000)}.</h3>
                            <div className="d-inline-block position-relative">
                              <h3 className={`small m-0${item.isAchieveNewRecord ? ' new-record' : ''}`}>
                                {String(item.achievement % 10_000).padStart(4, '0')}%
                              </h3>
                            </div>
                          </div>
                          <div className="recent-rank-icon position-absolute">
                            <img
                              className="rank-icon"
                              src={`${assetsHost}assets/mai2/common/${rankIcon(item.scoreRank)}.webp`}
                              alt=""
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card bg-secondary-subtle">
                  <div className="row justify-content-between align-items-center no-wrap">
                    <div className="col-auto">
                      <div className="d-flex flex-row gap-2" style={{ alignItems: 'center' }}>
                        {hasCombo && (
                          <div className="col ms-1">
                            <img className="honor-img" src={`${assetsHost}assets/mai2/common/${comboIcon(item.comboStatus)}.webp`} alt="" />
                          </div>
                        )}
                        {hasMultiplayer && (
                          <>
                            <div className="col">
                              <img className="honor-img" src={`${assetsHost}assets/mai2/common/${syncIcon(item.syncStatus)}.webp`} alt="" />
                            </div>
                            <div className="col">
                              <img className="rival-img" src={`${assetsHost}assets/mai2/common/${item.vsRank === 0 ? '1st' : '2nd'}.webp`} alt="" />
                            </div>
                          </>
                        )}
                        {showClear && (
                          <div className="col ms-2">
                            <img className="clear-img" src={`${assetsHost}assets/mai2/common/clear.webp`} alt="" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-auto">
                      <div className="d-flex flex-column align-items-end dx-score-container">
                        <span className="text-end mx-1">
                          {item.deluxscore}/<span style={{ fontSize: '0.75rem' }}>{item.totalCombo * 3}</span>
                        </span>
                        <span className="text-end tiny-text mx-1">{dxScoreStar(item)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`card-footer p-0 collapse${expanded ? ' show' : ''}`}>
                <div className="align-items-center px-3 py-2">
                  <div className="d-flex gap-2 flex-wrap">
                    <DetailValue label="FAST" color="#2973e0">{item.fastCount}</DetailValue>
                    <DetailValue label="LATE" color="#f35015">{item.lateCount}</DetailValue>
                    <DetailValue label="Combo">{item.maxCombo}/<span style={{ fontSize: '0.75rem' }}>{item.totalCombo}</span></DetailValue>
                    {hasMultiplayer && (
                      <>
                        <DetailValue label="Sync">{item.maxSync}/<span style={{ fontSize: '0.75rem' }}>{item.totalSync}</span></DetailValue>
                        <DetailValue label="2P Player">{item.playedUserName1}</DetailValue>
                      </>
                    )}
                    <DetailValue label="DXRating">
                      {item.afterRating}<span style={{ fontSize: '0.75rem' }}>(+{item.afterRating - item.beforeRating})</span>
                    </DetailValue>
                  </div>

                  <table className="table detail-table table-striped my-2 w-100" style={{ textAlign: 'center' }}>
                    <thead className="table-grade-color">
                      <tr>
                        <th style={{ width: '15%' }} />
                        <th style={{ width: '17%' }}>CRIT.PERF</th>
                        <th style={{ width: '17%' }}>PERFECT</th>
                        <th style={{ width: '17%' }}>GREAT</th>
                        <th style={{ width: '17%' }}>GOOD</th>
                        <th style={{ width: '17%' }}>MISS</th>
                      </tr>
                    </thead>
                    <tbody className="table-first-col table-grade-color"><JudgmentRows item={item} /></tbody>
                  </table>
                </div>
              </div>

              <div className="card-footer">
                <div className="d-flex justify-content-between">
                  <div className="align-items-center d-flex">{new Date(item.userPlayDate).toLocaleString()}</div>
                  <div>
                    {item.songInfo && (
                      <button className="btn btn-secondary btn-sm me-2" type="button" onClick={() => setDetailMusic(item.songInfo ?? null)}>
                        {t('Maimai2.RecentPage.ShowData')}
                      </button>
                    )}
                    <button className="btn btn-primary btn-sm" type="button" onClick={() => setExpandedIndex(expanded ? null : index)}>
                      {t('Maimai2.RecentPage.Detailed')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Maimai2Pagination current={currentPage} pageSize={PAGE_SIZE} totalItems={totalElements} onPageChange={setCurrentPage} />
      <Maimai2SongDetail music={detailMusic} open={detailMusic !== null} onClose={() => setDetailMusic(null)} />
    </div>
  );
}
