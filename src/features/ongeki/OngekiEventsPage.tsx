import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import type {
  OngekiTechChallengeDetail,
  OngekiTechChallengeEvent,
  OngekiTechChallengeMusic,
  OngekiTechChallengeRankingEntry,
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
  const [areaId, setAreaId] = useState('0');
  const [music, setMusic] = useState<OngekiTechChallengeMusic[]>([]);
  const [ranking, setRanking] = useState<OngekiTechChallengeRankingEntry[]>([]);
  const [detail, setDetail] = useState<OngekiTechChallengeDetail | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
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

                <div className="card mb-3">
                  <div className="card-body">
                    <h2 className="h6">{t('Ongeki.EventsPage.SongList')}</h2>
                    {loadingResults && <p className="text-secondary small mb-0">{t('Ongeki.EventsPage.Loading')}</p>}
                    {!loadingResults && music.length === 0 && (
                      <p className="text-secondary small mb-0">{t('Ongeki.EventsPage.NoSongs')}</p>
                    )}
                    {music.length > 0 && (
                      <div className="table-responsive">
                        <table className="table table-sm table-hover align-middle mb-0">
                          <thead>
                            <tr>
                              <th scope="col" style={{ width: '3rem' }}>#</th>
                              <th scope="col">{t('Ongeki.EventsPage.SongTitle')}</th>
                              <th scope="col">{t('Ongeki.EventsPage.Difficulty')}</th>
                              <th scope="col">{t('Ongeki.EventsPage.ChartLevel')}</th>
                              <th scope="col">{t('Ongeki.EventsPage.Artist')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {music.map((song, index) => {
                              const badge = DIFFICULTY_BADGES[song.level];
                              return (
                                <tr key={`${song.musicId}-${song.level}`}>
                                  <th scope="row">{index + 1}</th>
                                  <td>
                                    <span className="text-secondary me-2">{song.musicId}</span>
                                    {song.name || t('Ongeki.EventsPage.UnknownSong')}
                                  </td>
                                  <td>
                                    <span className={'badge rounded-pill ' + (badge?.className ?? 'text-bg-secondary')}>
                                      {badge?.label ?? song.level}
                                    </span>
                                  </td>
                                  <td>{song.chartLevel || '—'}</td>
                                  <td className="text-secondary">{song.artistName || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {!loadingResults && detail && (
                  <div className="card mb-3">
                    <div className="card-body">
                      <h2 className="h6">{t('Ongeki.EventsPage.MyRecord')}</h2>
                      {detail.rank == null && (
                        <p className="text-secondary small mb-2">{t('Ongeki.EventsPage.NotPlayed')}</p>
                      )}
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
                    </div>
                  </div>
                )}

                {!loadingResults && ranking.length === 0 && (
                  <div className="alert alert-secondary" role="status">{t('Ongeki.EventsPage.NoRanking')}</div>
                )}
                {ranking.length > 0 && (
                  <>
                  <h2 className="h6">{t('Ongeki.EventsPage.Ranking')}</h2>
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
