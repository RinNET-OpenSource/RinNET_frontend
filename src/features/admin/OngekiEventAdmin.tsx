import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DateTimeField } from '@/components/shared/DateTimeField';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import type { OngekiTechChallengeEvent, OngekiTechChallengeMusic } from '@/features/ongeki/models';

/** 游戏内难度名称，与乐曲列表保持一致，不翻译。 */
const DIFFICULTY_OPTIONS = [
  { value: 0, label: 'BASIC' },
  { value: 1, label: 'ADVANCED' },
  { value: 2, label: 'EXPERT' },
  { value: 3, label: 'MASTER' },
  { value: 10, label: 'LUNATIC' },
];

const TYPE_OPTIONS = [
  { value: 1, labelKey: 'Ongeki.EventsPage.TechChallenge' },
  { value: 2, labelKey: 'Ongeki.EventsPage.KoPQualify' },
];

interface EventDraft {
  startDate: string;
  endDate: string;
  /** 1 = 音击挑战, 2 = KoP 预选。 */
  type: number;
  kopId: number;
}

function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * 管理员选项卡：编辑音击挑战活动的类型、开放时间与课题曲。
 *
 * 活动期号与客户端包一致，章节名称取自服务端的章节表；类型与 KoP ID 必须与
 * 客户端包中 TechChallengeEventData 的 Type / KopID 保持一致（客户端自行读取该数据）。
 */
export function OngekiEventAdmin() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<OngekiTechChallengeEvent[]>([]);
  const [drafts, setDrafts] = useState<Record<string, EventDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [songs, setSongs] = useState<Record<string, OngekiTechChallengeMusic[]>>({});
  const [loadingSongsId, setLoadingSongsId] = useState<number | null>(null);
  const [savingSongsId, setSavingSongsId] = useState<number | null>(null);
  const [newSongId, setNewSongId] = useState('');

  useEffect(() => {
    let active = true;
    void api
      .get('api/game/ongeki/tech-challenge-event')
      .then((data) => {
        if (!active) return;
        const next = (data ?? []) as OngekiTechChallengeEvent[];
        setEvents(next);
        setDrafts(Object.fromEntries(next.map((event) => [String(event.id), {
          startDate: toDateTimeLocal(event.startDate),
          endDate: toDateTimeLocal(event.endDate),
          type: event.type,
          kopId: event.kopId,
        }])));
      })
      .catch((reason: unknown) => {
        if (active) {
          const message = String(reason);
          setError(message);
          notice(message, 'danger');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function updateDraft<K extends keyof EventDraft>(eventId: number, field: K, value: EventDraft[K]) {
    setDrafts((current) => ({
      ...current,
      [String(eventId)]: { ...current[String(eventId)], [field]: value },
    }));
  }

  async function saveEvent(event: OngekiTechChallengeEvent) {
    const draft = drafts[String(event.id)];
    const startDate = draft ? toIso(draft.startDate) : null;
    const endDate = draft ? toIso(draft.endDate) : null;
    const type = draft ? draft.type : event.type;
    const kopId = draft ? draft.kopId : event.kopId;
    if (!startDate || !endDate) {
      notice(t('Ongeki.EventAdmin.NeedDates'), 'warning');
      return;
    }
    if (startDate >= endDate) {
      notice(t('Ongeki.EventAdmin.EndBeforeStart'), 'warning');
      return;
    }
    if (type === 2 && (!Number.isFinite(kopId) || kopId < 0)) {
      notice(t('Ongeki.EventAdmin.NeedKopId'), 'warning');
      return;
    }

    setSavingId(event.id);
    setError('');
    try {
      const updated = await api.put(`api/game/ongeki/tech-challenge-event/${event.id}`, {
        startDate,
        endDate,
        type,
        kopId,
      }) as OngekiTechChallengeEvent;
      setEvents((current) => current.map((item) => item.id === event.id ? updated : item));
      setDrafts((current) => ({
        ...current,
        [String(event.id)]: {
          startDate: toDateTimeLocal(updated.startDate),
          endDate: toDateTimeLocal(updated.endDate),
          type: updated.type,
          kopId: updated.kopId,
        },
      }));
      notice(t('Ongeki.EventAdmin.Saved'), 'success');
    } catch (reason: unknown) {
      const message = String(reason);
      setError(message);
      notice(message, 'danger');
    } finally {
      setSavingId(null);
    }
  }

  async function loadSongs(eventId: number) {
    setLoadingSongsId(eventId);
    try {
      const data = await api.get(`api/game/ongeki/tech-challenge-event/${eventId}/music`);
      setSongs((current) => ({ ...current, [String(eventId)]: (data ?? []) as OngekiTechChallengeMusic[] }));
    } catch (reason: unknown) {
      const message = String(reason);
      setError(message);
      notice(message, 'danger');
    } finally {
      setLoadingSongsId(null);
    }
  }

  function toggleSongs(event: OngekiTechChallengeEvent) {
    if (expandedId === event.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(event.id);
    setNewSongId('');
    if (!songs[String(event.id)]) void loadSongs(event.id);
  }

  function updateSong(eventId: number, musicId: number, level: number) {
    setSongs((current) => ({
      ...current,
      [String(eventId)]: (current[String(eventId)] ?? []).map((song) =>
        song.musicId === musicId ? { ...song, level } : song),
    }));
  }

  function removeSong(eventId: number, musicId: number) {
    setSongs((current) => ({
      ...current,
      [String(eventId)]: (current[String(eventId)] ?? []).filter((song) => song.musicId !== musicId),
    }));
  }

  function addSong(eventId: number) {
    const musicId = Number.parseInt(newSongId, 10);
    if (!Number.isFinite(musicId) || musicId <= 0) {
      notice(t('Ongeki.EventAdmin.NeedMusicId'), 'warning');
      return;
    }
    const list = songs[String(eventId)] ?? [];
    if (list.some((song) => song.musicId === musicId)) {
      notice(t('Ongeki.EventAdmin.DuplicateMusic'), 'warning');
      return;
    }
    setSongs((current) => ({
      ...current,
      [String(eventId)]: [...list, { eventId, musicId, level: 3, name: '', artistName: '', chartLevel: '' }],
    }));
    setNewSongId('');
  }

  async function saveSongs(event: OngekiTechChallengeEvent) {
    const list = songs[String(event.id)] ?? [];
    setSavingSongsId(event.id);
    setError('');
    try {
      const updated = await api.put(`api/game/ongeki/tech-challenge-event/${event.id}/music`, {
        musicList: list.map((song) => ({ musicId: song.musicId, level: song.level })),
      }) as OngekiTechChallengeMusic[];
      const next = updated ?? [];
      setSongs((current) => ({ ...current, [String(event.id)]: next }));
      setEvents((current) => current.map((item) =>
        item.id === event.id ? { ...item, songCount: next.length } : item));
      notice(t('Ongeki.EventAdmin.MusicSaved'), 'success');
    } catch (reason: unknown) {
      const message = String(reason);
      setError(message);
      notice(message, 'danger');
    } finally {
      setSavingSongsId(null);
    }
  }

  if (loading) return <p className="text-secondary">{t('Ongeki.EventsPage.Loading')}</p>;

  return (
    <div>
      <p className="text-secondary small">{t('Ongeki.EventAdmin.Description')}</p>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {events.length === 0 && (
        <div className="alert alert-info" role="status">{t('Ongeki.EventAdmin.Empty')}</div>
      )}

      {events.length > 0 && (
        <div className="table-responsive">
          {/* 窄屏时整表横向滚动，避免中文列被压成一字一行。 */}
          <table className="table table-hover align-middle" style={{ minWidth: '76rem' }}>
            <thead>
              <tr>
                <th scope="col" style={{ whiteSpace: 'nowrap' }}>{t('Ongeki.EventAdmin.Column.Event')}</th>
                <th scope="col" style={{ whiteSpace: 'nowrap' }}>{t('Ongeki.EventsPage.Period')}</th>
                <th scope="col" style={{ whiteSpace: 'nowrap' }}>{t('Ongeki.EventsPage.Chapter')}</th>
                <th scope="col" style={{ whiteSpace: 'nowrap' }}>{t('Ongeki.EventAdmin.Column.Type')}</th>
                <th scope="col" style={{ whiteSpace: 'nowrap' }}>{t('Ongeki.EventAdmin.Column.Kop')}</th>
                <th scope="col" style={{ whiteSpace: 'nowrap' }}>{t('Ongeki.EventAdmin.Column.Start')}</th>
                <th scope="col" style={{ whiteSpace: 'nowrap' }}>{t('Ongeki.EventAdmin.Column.End')}</th>
                <th scope="col" style={{ whiteSpace: 'nowrap' }}>{t('Ongeki.EventAdmin.Column.Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const draft = drafts[String(event.id)]
                  ?? { startDate: '', endDate: '', type: event.type, kopId: event.kopId };
                const list = songs[String(event.id)] ?? [];
                const title = event.name || event.chapterName || String(event.id);
                return (
                  <Fragment key={event.id}>
                    <tr>
                      <td style={{ whiteSpace: 'nowrap' }}>{event.name || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{event.id}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {event.chapterName || '—'}
                        <span className="text-secondary small ms-1">({event.chapterId})</span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <select
                          className="form-select form-select-sm"
                          style={{ width: '9rem' }}
                          value={draft.type}
                          aria-label={`${title} ${t('Ongeki.EventAdmin.Column.Type')}`}
                          disabled={savingId === event.id}
                          onChange={(input) => updateDraft(event.id, 'type', Number(input.target.value))}
                        >
                          {TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                          ))}
                          {TYPE_OPTIONS.every((option) => option.value !== draft.type) && (
                            <option value={draft.type}>
                              {t('Ongeki.EventAdmin.UnknownType', { type: draft.type })}
                            </option>
                          )}
                        </select>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <input
                          type="number"
                          min="0"
                          className="form-control form-control-sm"
                          style={{ width: '6rem' }}
                          value={draft.kopId}
                          aria-label={`${title} ${t('Ongeki.EventAdmin.Column.Kop')}`}
                          disabled={savingId === event.id || draft.type !== 2}
                          onChange={(input) => updateDraft(event.id, 'kopId', Number(input.target.value))}
                        />
                      </td>
                      <td style={{ minWidth: '16rem', whiteSpace: 'nowrap' }}>
                        <DateTimeField
                          value={draft.startDate}
                          label={`${title} ${t('Ongeki.EventAdmin.Column.Start')}`}
                          disabled={savingId === event.id}
                          onChange={(value) => updateDraft(event.id, 'startDate', value)}
                        />
                      </td>
                      <td style={{ minWidth: '16rem', whiteSpace: 'nowrap' }}>
                        <DateTimeField
                          value={draft.endDate}
                          label={`${title} ${t('Ongeki.EventAdmin.Column.End')}`}
                          disabled={savingId === event.id}
                          onChange={(value) => updateDraft(event.id, 'endDate', value)}
                        />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm me-1"
                          disabled={savingId === event.id}
                          onClick={() => void saveEvent(event)}
                        >
                          {savingId === event.id ? t('Ongeki.EventAdmin.Saving') : t('Ongeki.EventAdmin.Save')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => toggleSongs(event)}
                        >
                          {t('Ongeki.EventAdmin.SongButton', { count: event.songCount })}
                        </button>
                      </td>
                    </tr>
                    {expandedId === event.id && (
                      <tr>
                        <td colSpan={8}>
                          {loadingSongsId === event.id && (
                            <p className="text-secondary small mb-2">{t('Ongeki.EventAdmin.LoadingSongs')}</p>
                          )}
                          {loadingSongsId !== event.id && list.length === 0 && (
                            <p className="text-secondary small mb-2">{t('Ongeki.EventAdmin.NoSongs')}</p>
                          )}
                          {loadingSongsId !== event.id && list.length > 0 && (
                            <div className="table-responsive mb-2">
                              <table className="table table-sm align-middle mb-0">
                                <thead>
                                  <tr>
                                    <th scope="col" style={{ width: '4rem' }}>#</th>
                                    <th scope="col">{t('Ongeki.EventsPage.SongTitle')}</th>
                                    <th scope="col">{t('Ongeki.EventsPage.Difficulty')}</th>
                                    <th scope="col">{t('Ongeki.EventsPage.ChartLevel')}</th>
                                    <th scope="col" style={{ width: '5rem' }}>{t('Ongeki.EventAdmin.Column.Actions')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {list.map((song, index) => (
                                    <tr key={song.musicId}>
                                      <th scope="row">{index + 1}</th>
                                      <td>
                                        <span className="text-secondary me-2">{song.musicId}</span>
                                        {song.name || t('Ongeki.EventsPage.UnknownSong')}
                                      </td>
                                      <td>
                                        <select
                                          className="form-select form-select-sm"
                                          style={{ width: '9rem' }}
                                          value={song.level}
                                          onChange={(input) => updateSong(event.id, song.musicId, Number(input.target.value))}
                                        >
                                          {DIFFICULTY_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                          ))}
                                          {DIFFICULTY_OPTIONS.every((option) => option.value !== song.level) && (
                                            <option value={song.level}>
                                              {t('Ongeki.EventAdmin.UnknownDifficulty', { level: song.level })}
                                            </option>
                                          )}
                                        </select>
                                      </td>
                                      <td>{song.chartLevel || '—'}</td>
                                      <td>
                                        <button
                                          type="button"
                                          className="btn btn-outline-danger btn-sm"
                                          onClick={() => removeSong(event.id, song.musicId)}
                                        >
                                          {t('Ongeki.EventAdmin.Remove')}
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          <div className="d-flex flex-wrap align-items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              className="form-control form-control-sm"
                              style={{ width: '9rem' }}
                              placeholder={t('Ongeki.EventAdmin.MusicIdPlaceholder')}
                              value={newSongId}
                              onChange={(input) => setNewSongId(input.target.value)}
                            />
                            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => addSong(event.id)}>
                              {t('Ongeki.EventAdmin.Add')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={savingSongsId === event.id}
                              onClick={() => void saveSongs(event)}
                            >
                              {savingSongsId === event.id ? t('Ongeki.EventAdmin.Saving') : t('Ongeki.EventAdmin.SaveSongs')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
