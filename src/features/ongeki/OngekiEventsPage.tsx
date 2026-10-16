import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { assetsHost, enableImages } from '@/lib/utils';
import { padDigits } from '@/lib/format';
import { OngekiPagination } from './OngekiPagination';
import { OngekiRecentItem } from './OngekiRecentItem';
import { hydratePlaylogs } from './playlog-hydrate';
import type {
  OngekiTechChallengeDetail,
  OngekiTechChallengeEvent,
  OngekiTechChallengeMusic,
  OngekiTechChallengeRankingEntry,
  OngekiTechChallengeScore,
  PlayerPlaylog,
} from './models';
import './events.css';

/** Client difficulty id → the badge class shared with the song list page. */
const DIFFICULTY_BADGES: Record<number, { className: string; label: string }> = {
  0: { className: 'difficulty-basic', label: 'BASIC' },
  1: { className: 'difficulty-advanced', label: 'ADVANCED' },
  2: { className: 'difficulty-expert', label: 'EXPERT' },
  3: { className: 'difficulty-master', label: 'MASTER' },
  4: { className: 'difficulty-lunatic', label: 'LUNATIC' },
  10: { className: 'difficulty-lunatic', label: 'LUNATIC' },
};

/** 用户侧页面的选项卡：课题曲目、个人成绩与游玩记录、排行榜。 */
type EventTab = 'songs' | 'record' | 'ranking';

const TABS: { key: EventTab; labelKey: string }[] = [
  { key: 'songs', labelKey: 'Ongeki.EventsPage.SongList' },
  { key: 'record', labelKey: 'Ongeki.EventsPage.TabRecord' },
  { key: 'ranking', labelKey: 'Ongeki.EventsPage.Ranking' },
];

const PLAYLOG_PAGE_SIZE = 5;

/** Renders `YYYY-MM-DD HH:mm` so the client never shows a raw timestamp. */
function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function OngekiEventsPage() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<OngekiTechChallengeEvent[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<EventTab>('songs');
  const [areaId, setAreaId] = useState('0');
  const [music, setMusic] = useState<OngekiTechChallengeMusic[]>([]);
  const [ranking, setRanking] = useState<OngekiTechChallengeRankingEntry[]>([]);
  const [detail, setDetail] = useState<OngekiTechChallengeDetail | null>(null);
  const [scores, setScores] = useState<OngekiTechChallengeScore[]>([]);
  const [playlogs, setPlaylogs] = useState<PlayerPlaylog[]>([]);
  const [playlogPage, setPlaylogPage] = useState(1);
  const [playlogTotal, setPlaylogTotal] = useState(0);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [error, setError] = useState('');

  const selected = useMemo(
    () => events.find((event) => event.id === selectedId) ?? null,
    [events, selectedId],
  );

  const eventType = (event: OngekiTechChallengeEvent) =>
    event.type === 2 ? t('Ongeki.EventsPage.KoPQualify') : t('Ongeki.EventsPage.TechChallenge');

  useEffect(() => {
    let active = true;
    setLoadingEvents(true);
    void api
      .get('api/game/ongeki/tech-challenge-event/active')
      .then((data) => {
        if (!active) return;
        const next = (data ?? []) as OngekiTechChallengeEvent[];
        setEvents(next);
        setSelectedId((current) => current ?? next[0]?.id ?? null);
      })
      .catch((reason: unknown) => {
        if (active) {
          const message = String(reason);
          setError(message);
          notice(message, 'danger');
        }
      })
      .finally(() => {
        if (active) setLoadingEvents(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selected) {
      setMusic([]);
      setRanking([]);
      setDetail(null);
      return;
    }
    let active = true;
    setLoadingResults(true);
    setError('');
    const params = selected.type === 2 ? { areaId: Number(areaId) } : undefined;
    void Promise.all([
      api.get(`api/game/ongeki/tech-challenge-event/${selected.id}/music`),
      api.get(`api/game/ongeki/tech-challenge-event/${selected.id}/ranking`, params),
      api.get(`api/game/ongeki/tech-challenge-event/${selected.id}/detail`, params),
    ])
      .then(([musicData, rankingData, detailData]) => {
        if (!active) return;
        setMusic((musicData ?? []) as OngekiTechChallengeMusic[]);
        setRanking((rankingData ?? []) as OngekiTechChallengeRankingEntry[]);
        setDetail((detailData ?? null) as OngekiTechChallengeDetail | null);
      })
      .catch((reason: unknown) => {
        if (active) {
          const message = String(reason);
          setError(message);
          setMusic([]);
          setRanking([]);
          setDetail(null);
          notice(message, 'danger');
        }
      })
      .finally(() => {
        if (active) setLoadingResults(false);
      });
    return () => {
      active = false;
    };
  }, [selected, areaId]);

  // 个人成绩与游玩记录只在打开该选项卡时读取。
  useEffect(() => {
    if (!selected || tab !== 'record') {
      return;
    }
    let active = true;
    setLoadingRecord(true);
    void Promise.all([
      api.get(`api/game/ongeki/tech-challenge-event/${selected.id}/score`),
      api.get(`api/game/ongeki/tech-challenge-event/${selected.id}/playlog`, { page: playlogPage - 1 }),
    ])
      .then(async ([scoreData, playlogData]) => {
        if (!active) return;
        setScores((scoreData ?? []) as OngekiTechChallengeScore[]);
        setPlaylogTotal(playlogData?.totalElements ?? 0);
        setPlaylogs(await hydratePlaylogs((playlogData?.content ?? []) as PlayerPlaylog[]));
      })
      .catch((reason: unknown) => {
        if (active) {
          const message = String(reason);
          setError(message);
          setScores([]);
          setPlaylogs([]);
          setPlaylogTotal(0);
          notice(message, 'danger');
        }
      })
      .finally(() => {
        if (active) setLoadingRecord(false);
      });
    return () => {
      active = false;
    };
  }, [selected, tab, playlogPage]);

  // 换活动时回到第一页游玩记录。
  useEffect(() => {
    setPlaylogPage(1);
  }, [selectedId]);

  return (
    <div className="content ongeki-events-page">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="page-heading mb-0">{t('Ongeki.EventsPage.Title')}</h1>
        {selected?.type === 2 && (
          <label className="d-flex align-items-center gap-2 small">
            <span>{t('Ongeki.EventsPage.Area')}</span>
            <input
              className="form-control form-control-sm"
              style={{ width: '7rem' }}
              type="number"
              min="0"
              value={areaId}
              onChange={(event) => setAreaId(event.target.value)}
            />
          </label>
        )}
      </div>

      {loadingEvents && <p className="text-secondary">{t('Ongeki.EventsPage.Loading')}</p>}
      {!loadingEvents && events.length === 0 && (
        <div className="alert alert-info" role="status">
          {t('Ongeki.EventsPage.Empty')}
        </div>
      )}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {events.length > 0 && (
        <div className="row g-3">
          <div className="col-12 col-lg-4">
            <div className="list-group">
              {events.map((event) => (
                <button
                  type="button"
                  key={event.id}
                  className={'list-group-item list-group-item-action text-start' + (event.id === selectedId ? ' active' : '')}
                  onClick={() => setSelectedId(event.id)}
                >
                  <div className="event-heading d-flex justify-content-between gap-2">
                    <strong>{event.name || event.chapterName}</strong>
                    <span className="badge text-bg-secondary">{eventType(event)}</span>
                  </div>
                  <div className="small mt-1">
                    {t('Ongeki.EventsPage.Period')} {event.id}
                    {event.chapterName && ` · ${event.chapterName}`}
                    {' · '}
                    {t('Ongeki.EventsPage.SongCount', { count: event.songCount })}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="col-12 col-lg-8">
            {selected && (
              <>
                <div className="card mb-3">
                  <div className="card-body">
                    <div className="event-heading d-flex flex-wrap justify-content-between gap-2">
                      <div>
                        <h2 className="h5 mb-1">{selected.name || selected.chapterName}</h2>
                        <div className="text-secondary small">
                          {eventType(selected)}
                          {' · '}
                          {t('Ongeki.EventsPage.Period')} {selected.id}
                          {selected.chapterName && ` · ${t('Ongeki.EventsPage.Chapter')} ${selected.chapterName}`}
                          {selected.type === 2 && ` · KoP ${selected.kopId}`}
                        </div>
                      </div>
                      <span className={'badge ' + (selected.active ? 'text-bg-success' : 'text-bg-secondary')}>
                        {selected.active ? t('Ongeki.EventsPage.Active') : t('Ongeki.EventsPage.Inactive')}
                      </span>
                    </div>
                    <div className="row mt-2 small">
                      <div className="col-sm-6">
                        <span className="text-secondary">{formatDateTime(selected.startDate)}</span>
                      </div>
                      <div className="col-sm-6 text-sm-end">
                        <span className="text-secondary">{formatDateTime(selected.endDate)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="d-flex flex-wrap gap-2 mb-3">
                  {TABS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={'tab-selector' + (tab === item.key ? ' tab-selector-active' : '')}
                      onClick={() => setTab(item.key)}
                    >
                      {t(item.labelKey)}
                    </button>
                  ))}
                </div>

                {tab === 'songs' && (
                  <>
                    {loadingResults && <p className="text-secondary small">{t('Ongeki.EventsPage.Loading')}</p>}
                    {!loadingResults && music.length === 0 && (
                      <p className="text-secondary small">{t('Ongeki.EventsPage.NoSongs')}</p>
                    )}
                    {music.map((song) => {
                      const badge = DIFFICULTY_BADGES[song.level];
                      return (
                        <div className="card mb-2" key={`${song.musicId}-${song.level}`}>
                          <div className="song-info card-body hstack gap-2 p-0">
                            <div className="jacket-container ratio ratio-1x1">
                              {enableImages && (
                                <img
                                  className="position-absolute rounded-start"
                                  src={assetsHost + `assets/ongeki/jacket/UI_Jacket_${padDigits(song.musicId, 4)}.webp`}
                                  alt=""
                                />
                              )}
                            </div>
                            <div className="overflow-hidden">
                              <div className="song-info-title text-truncate fw-bold">
                                <span>
                                  {song.musicId}.「{song.name || t('Ongeki.EventsPage.UnknownSong')}」
                                </span>
                              </div>
                              <div className="song-info-artist text-truncate mb-1">
                                <span>{song.artistName || '—'}</span>
                              </div>
                              <div className="row m-0 align-items-center gap-2">
                                <span className={'col-auto difficulty ' + (badge?.className ?? '') + ' badge rounded-pill'}>
                                  {badge?.label ?? song.level} {song.chartLevel || '—'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {tab === 'record' && (
                  <>
                    <div className="card mb-3">
                      <div className="card-body">
                        <h2 className="h6">{t('Ongeki.EventsPage.MyRecord')}</h2>
                        {loadingResults && <p className="text-secondary small mb-0">{t('Ongeki.EventsPage.Loading')}</p>}
                        {detail && detail.rank == null && (
                          <p className="text-secondary small mb-2">{t('Ongeki.EventsPage.NotPlayed')}</p>
                        )}
                        {detail && (
                          <div className="row g-2 small">
                            <div className="col-6 col-md-3">
                              <span className="text-secondary">{t('Ongeki.EventsPage.Rank')}</span>
                              <div className="fs-5">{detail.rank ?? '—'}</div>
                            </div>
                            <div className="col-6 col-md-3">
                              <span className="text-secondary">{t('Ongeki.EventsPage.TechScore')}</span>
                              <div className="fs-5">{detail.totalTechScore}</div>
                            </div>
                            <div className="col-6 col-md-3">
                              <span className="text-secondary">{t('Ongeki.EventsPage.PlatinumScore')}</span>
                              <div className="fs-5">{detail.totalPlatinumScore}</div>
                            </div>
                            <div className="col-6 col-md-3">
                              <span className="text-secondary">{t('Ongeki.EventsPage.Recorded')}</span>
                              <div>{formatDateTime(detail.techRecordDate)}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <h2 className="h6">{t('Ongeki.EventsPage.SongScores')}</h2>
                    {loadingRecord && <p className="text-secondary small">{t('Ongeki.EventsPage.Loading')}</p>}
                    {!loadingRecord && scores.length > 0 && (
                      <div className="table-responsive mb-3">
                        <table className="table table-sm table-hover align-middle mb-0">
                          <thead>
                            <tr>
                              <th scope="col">{t('Ongeki.EventsPage.SongTitle')}</th>
                              <th scope="col">{t('Ongeki.EventsPage.Difficulty')}</th>
                              <th scope="col">{t('Ongeki.EventsPage.TechScore')}</th>
                              <th scope="col">{t('Ongeki.EventsPage.PlatinumScore')}</th>
                              <th scope="col">{t('Ongeki.EventsPage.PlayCount')}</th>
                              <th scope="col">{t('Ongeki.EventsPage.Marks')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scores.map((score) => {
                              const badge = DIFFICULTY_BADGES[score.level];
                              const marks = score.played && !score.isFullCombo && !score.isAllBreak ? '—' : null;
                              return (
                                <tr key={`${score.musicId}-${score.level}`}>
                                  <td>
                                    <span className="text-secondary me-2">{score.musicId}</span>
                                    {score.name || t('Ongeki.EventsPage.UnknownSong')}
                                  </td>
                                  <td>
                                    <span className={'badge rounded-pill ' + (badge?.className ?? 'text-bg-secondary')}>
                                      {badge?.label ?? score.level} {score.chartLevel || '—'}
                                    </span>
                                  </td>
                                  <td>{score.played ? score.techScoreMax : '—'}</td>
                                  <td>{score.played ? score.platinumScoreMax : '—'}</td>
                                  <td>{score.played ? score.playCount : '—'}</td>
                                  <td style={{ whiteSpace: 'nowrap' }}>
                                    {!score.played && '—'}
                                    {marks}
                                    {score.isFullCombo && <span className="badge text-bg-info me-1">FULL COMBO</span>}
                                    {score.isAllBreak && <span className="badge text-bg-warning">ALL BREAK</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                      <h2 className="h6 mb-0">{t('Ongeki.EventsPage.PlayRecords')}</h2>
                      {playlogTotal > 0 && (
                        <OngekiPagination
                          current={playlogPage}
                          marginClassName="m-0"
                          pageSize={PLAYLOG_PAGE_SIZE}
                          totalItems={playlogTotal}
                          onPageChange={setPlaylogPage}
                        />
                      )}
                    </div>
                    {!loadingRecord && playlogs.length === 0 && (
                      <p className="text-secondary small mb-0">{t('Ongeki.EventsPage.NoPlayRecords')}</p>
                    )}
                    <div className="list-group gap-3 my-3">
                      {playlogs.map((playLog, index) => (
                        <div key={index}>
                          <OngekiRecentItem playLog={playLog} />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {tab === 'ranking' && (
                  <>
                    {!loadingResults && ranking.length === 0 && (
                      <div className="alert alert-secondary" role="status">{t('Ongeki.EventsPage.NoRanking')}</div>
                    )}
                    {ranking.length > 0 && (
                      <div className="table-responsive">
                        <table className="table table-hover align-middle">
                          <thead>
                            <tr>
                              <th scope="col">{t('Ongeki.EventsPage.Rank')}</th>
                              <th scope="col">{t('Ongeki.EventsPage.Player')}</th>
                              <th scope="col">{t('Ongeki.EventsPage.TechScore')}</th>
                              <th scope="col">{t('Ongeki.EventsPage.PlatinumScore')}</th>
                              <th scope="col">{t('Ongeki.EventsPage.Recorded')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ranking.map((entry) => (
                              <tr key={`${entry.userId}-${entry.rank}`}>
                                <th scope="row">{entry.rank}</th>
                                <td>{entry.userName || entry.userId}</td>
                                <td>{entry.totalTechScore}</td>
                                <td>{entry.totalPlatinumScore}</td>
                                <td>{formatDateTime(entry.techRecordDate)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
