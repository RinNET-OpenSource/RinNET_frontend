import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import './Maimai2KopRankingPage.css';

/** KOP tournament metadata returned by `/api/game/maimai2/kop/current` and `/tournaments`. */
export interface KopTournament {
  tournamentId: number;
  kopNo: number;
  shortName: string;
  name: string;
  musicIds: number[];
  requiredLevel: number;
  startDate: string;
  endDate: string;
  isEnabled: boolean;
  isOpen: boolean;
}

/** One row returned by `/api/game/maimai2/kop/ranking`. */
export interface KopRankItem {
  rank: number;
  userId: number;
  userName: string;
  score: number;
  deluxScore: number;
  tournamentId: number;
  kopNo: number;
  rankingDate: string;
}

const MEDALS = ['gold', 'silver', 'bronze'];

/** The backend returns raw objects/arrays; keep accepting an `{ data }` envelope too. */
function unwrap<T>(resp: unknown): T | null {
  if (resp === null || resp === undefined) {
    return null;
  }
  if (Array.isArray(resp)) {
    return resp as T;
  }
  if (typeof resp === 'object' && 'data' in resp) {
    return ((resp as { data?: unknown }).data ?? null) as T | null;
  }
  return resp as T;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Period is shown to the minute, matching the other RinNET event pages. */
function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Ranking timestamps keep seconds because two entries can differ within a minute. */
function formatRankDate(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function statusKey(tournament: KopTournament | null): string {
  if (!tournament) {
    return '';
  }
  const start = Date.parse(tournament.startDate);
  const end = Date.parse(tournament.endDate);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return '';
  }
  const now = Date.now();
  if (now < start) {
    return 'Maimai2.KopPage.StatusUpcoming';
  }
  if (now > end) {
    return 'Maimai2.KopPage.StatusClosed';
  }
  return 'Maimai2.KopPage.StatusOpen';
}

function medalSrc(name: string): string {
  return `${import.meta.env.BASE_URL}assets/${name}-medal.svg`;
}

/**
 * Maimai DX KOP qualifier ranking.
 *
 * The page mirrors the LCDX KOP viewer, but talks to the RinNET backend:
 * `/api/game/maimai2/kop/{current,tournaments,ranking}`.
 */
export function Maimai2KopRankingPage() {
  const { t } = useTranslation();
  const [tournaments, setTournaments] = useState<KopTournament[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rankings, setRankings] = useState<KopRankItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoadingInitial(true);
    setError('');

    void (async () => {
      let list: KopTournament[] = [];
      let current: KopTournament | null = null;

      try {
        list = unwrap<KopTournament[]>(await api.get('api/game/maimai2/kop/tournaments')) ?? [];
      } catch (reason: unknown) {
        if (active) {
          const message = String(reason);
          setError(message);
          notice(message, 'danger');
        }
      }

      try {
        current = unwrap<KopTournament>(await api.get('api/game/maimai2/kop/current'));
      } catch (reason: unknown) {
        if (active) {
          const message = String(reason);
          setError(message);
          notice(message, 'danger');
        }
      }

      if (!active) {
        return;
      }

      // Defensive: if the list endpoint lags behind current, still show current.
      if (current && !list.some((item) => item.tournamentId === current?.tournamentId)) {
        list = [current, ...list];
      }

      setTournaments(list);
      setSelectedId(current?.tournamentId ?? list[0]?.tournamentId ?? null);
      setLoadingInitial(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selectedId === null) {
      setRankings([]);
      setLoadingRanking(false);
      return;
    }

    let active = true;
    setLoadingRanking(true);
    setError('');

    void (async () => {
      try {
        const response = await api.get('api/game/maimai2/kop/ranking', {
          tournamentId: selectedId,
          limit: 30,
        });
        if (active) {
          setRankings(unwrap<KopRankItem[]>(response) ?? []);
        }
      } catch (reason: unknown) {
        if (active) {
          const message = String(reason);
          setError(message);
          setRankings([]);
          notice(message, 'danger');
        }
      } finally {
        if (active) {
          setLoadingRanking(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedId]);

  const selected = tournaments.find((item) => item.tournamentId === selectedId) ?? null;
  const heading = selected?.shortName || t('Maimai2.KopPage.Title');
  const status = statusKey(selected);

  return (
    <div className="content kop-ranking-page">
      <h1 className="page-heading">{heading}</h1>

      {loadingInitial && <p className="text-secondary">{t('Maimai2.KopPage.Loading')}</p>}

      {!loadingInitial && error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {!loadingInitial && tournaments.length === 0 && (
        <div className="card p-1" style={{ maxWidth: '100%' }}>
          {t('Maimai2.KopPage.NoTournament')}
        </div>
      )}

      {selected && (
        <div className="row align-items-center mb-2 g-2">
          <div className="col-12 col-md-auto">
            {status && (
              <span className={`badge ${status === 'Maimai2.KopPage.StatusOpen' ? 'text-bg-success' : 'text-bg-secondary'}`}>
                {t(status)}
              </span>
            )}
            <span className="ms-2">{selected.name}</span>
          </div>
          <div className="col-12 col-md-auto">
            <span className="text-body-secondary">
              {t('Maimai2.KopPage.Period')}: {formatDateTime(selected.startDate)} ~ {formatDateTime(selected.endDate)}
            </span>
          </div>
        </div>
      )}

      {tournaments.length > 1 && (
        <div className="row mb-3 align-items-center g-2">
          <label className="col-auto col-form-label" htmlFor="kop-tournament-select">
            {t('Maimai2.KopPage.Edition')}
          </label>
          <div className="col-md-4">
            <select
              id="kop-tournament-select"
              className="form-select"
              value={selectedId ?? ''}
              onChange={(event) => setSelectedId(Number(event.target.value))}
            >
              {tournaments.map((item) => (
                <option key={item.tournamentId} value={item.tournamentId}>
                  {item.shortName || item.name}
                  {item.isOpen ? ` (${t('Maimai2.KopPage.StatusOpen')})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {!loadingInitial && selected && (
        <>
          {loadingRanking && <p className="text-secondary small">{t('Maimai2.KopPage.Loading')}</p>}

          {!loadingRanking && rankings.length === 0 && (
            <div className="card p-1" style={{ maxWidth: '100%' }}>
              {t('Maimai2.KopPage.NoRanking')}
            </div>
          )}

          {rankings.length > 0 && (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th scope="col">{t('Maimai2.KopPage.Rank')}</th>
                    <th scope="col">{t('Maimai2.KopPage.Name')}</th>
                    <th scope="col">{t('Maimai2.KopPage.Score')}</th>
                    <th scope="col">{t('Maimai2.KopPage.Date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((item, index) => (
                    <tr key={`${item.userId}-${index}`}>
                      <td className="kop-rank">
                        {index < MEDALS.length ? (
                          <img className="medal" src={medalSrc(MEDALS[index])} alt="" />
                        ) : (
                          <span>{item.rank || index + 1}</span>
                        )}
                      </td>
                      <td className={index < MEDALS.length ? 'fw-bold' : undefined}>{item.userName}</td>
                      <td className="text-end font-monospace">{(item.score / 10000).toFixed(4)}%</td>
                      <td className="text-nowrap">{formatRankDate(item.rankingDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
