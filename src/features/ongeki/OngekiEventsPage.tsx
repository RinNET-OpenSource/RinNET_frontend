import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import type {
  OngekiTechChallengeDetail,
  OngekiTechChallengeEvent,
  OngekiTechChallengeRankingEntry,
} from './models';

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function eventType(event: OngekiTechChallengeEvent): string {
  return event.type === 2 ? 'KoP Qualify' : 'Tech Challenge';
}

export function OngekiEventsPage() {
  const [events, setEvents] = useState<OngekiTechChallengeEvent[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [areaId, setAreaId] = useState('0');
  const [ranking, setRanking] = useState<OngekiTechChallengeRankingEntry[]>([]);
  const [detail, setDetail] = useState<OngekiTechChallengeDetail | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState('');

  const selected = useMemo(
    () => events.find((event) => event.id === selectedId) ?? null,
    [events, selectedId],
  );

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
      setRanking([]);
      setDetail(null);
      return;
    }
    let active = true;
    setLoadingResults(true);
    setError('');
    const params = selected.type === 2 ? { areaId: Number(areaId) } : undefined;
    void Promise.all([
      api.get(`api/game/ongeki/tech-challenge-event/${selected.id}/ranking`, params),
      api.get(`api/game/ongeki/tech-challenge-event/${selected.id}/detail`, params),
    ])
      .then(([rankingData, detailData]) => {
        if (!active) return;
        setRanking((rankingData ?? []) as OngekiTechChallengeRankingEntry[]);
        setDetail((detailData ?? null) as OngekiTechChallengeDetail | null);
      })
      .catch((reason: unknown) => {
        if (active) {
          const message = String(reason);
          setError(message);
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
    <div className="content">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="page-heading mb-0">Ongeki Events</h1>
        {selected?.type === 2 && (
          <label className="d-flex align-items-center gap-2 small">
            <span>Area</span>
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

      {loadingEvents && <p className="text-secondary">Loading active events…</p>}
      {!loadingEvents && events.length === 0 && (
        <div className="alert alert-info" role="status">
          There are no active Tech Challenge events.
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
                  <div className="d-flex justify-content-between gap-2">
                    <strong>{event.name}</strong>
                    <span className="badge text-bg-secondary">{eventType(event)}</span>
                  </div>
                  <div className="small mt-1">
                    Period {event.id} · Chapter {event.chapterId}
                    {event.type === 2 && ` · KoP ${event.kopId}`}
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
                    <div className="d-flex flex-wrap justify-content-between gap-2">
                      <div>
                        <h2 className="h5 mb-1">{selected.name}</h2>
                        <div className="text-secondary small">{eventType(selected)} · Period {selected.id} · Chapter {selected.chapterId}</div>
                      </div>
                      <span className={'badge align-self-start ' + (selected.active ? 'text-bg-success' : 'text-bg-secondary')}>
                        {selected.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="row mt-2 small">
                      <div className="col-sm-6"><strong>Starts:</strong> {formatDate(selected.startDate)}</div>
                      <div className="col-sm-6"><strong>Ends:</strong> {formatDate(selected.endDate)}</div>
                    </div>
                  </div>
                </div>

                {loadingResults && <p className="text-secondary">Loading ranking…</p>}
                {!loadingResults && detail && (
                  <div className="card mb-3">
                    <div className="card-body">
                      <h2 className="h6">Your result</h2>
                      <div className="row g-2 small">
                        <div className="col-6 col-md-3"><span className="text-secondary">Rank</span><div className="fs-5">{detail.rank ?? '—'}</div></div>
                        <div className="col-6 col-md-3"><span className="text-secondary">Tech score</span><div className="fs-5">{detail.totalTechScore}</div></div>
                        <div className="col-6 col-md-3"><span className="text-secondary">Platinum score</span><div className="fs-5">{detail.totalPlatinumScore}</div></div>
                        <div className="col-6 col-md-3"><span className="text-secondary">Record date</span><div>{formatDate(detail.techRecordDate)}</div></div>
                      </div>
                    </div>
                  </div>
                )}

                {!loadingResults && ranking.length === 0 && (
                  <div className="alert alert-secondary" role="status">No ranking records have been saved yet.</div>
                )}
                {ranking.length > 0 && (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle">
                      <thead><tr><th>Rank</th><th>Player</th><th>Tech</th><th>Platinum</th><th>Recorded</th></tr></thead>
                      <tbody>
                        {ranking.map((entry) => (
                          <tr key={`${entry.userId}-${entry.rank}`}>
                            <th scope="row">{entry.rank}</th>
                            <td>{entry.userName || entry.userId}</td>
                            <td>{entry.totalTechScore}</td>
                            <td>{entry.totalPlatinumScore}</td>
                            <td>{formatDate(entry.techRecordDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
