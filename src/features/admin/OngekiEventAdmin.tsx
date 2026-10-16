import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DateTimeField } from '@/components/shared/DateTimeField';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import type { OngekiTechChallengeEvent, OngekiTechChallengeMusic } from '@/features/ongeki/models';
import './ongeki-event-admin.css';

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

/** 同一时间只编辑一个活动的其中一部分。 */
interface EditorState {
  eventId: number;
  mode: 'event' | 'music';
}

function pad(part: number): string {
  return String(part).padStart(2, '0');
}

function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function typeLabelKey(type: number): string | undefined {
  return TYPE_OPTIONS.find((option) => option.value === type)?.labelKey;
}

/**
 * 管理员选项卡：编辑音击挑战活动的类型、开放时间与课题曲。
 *
 * 活动期号与客户端包一致，章节名称取自服务端的章节表；类型与 KoP ID 必须与
 * 客户端包中 TechChallengeEventData 的 Type / KopID 保持一致（客户端自行读取该数据）。
 *
 * 表格只做展示，编辑表单放在表格下方：animal-island 主题的日期/时间弹层是绝对定位的，
 * 放进横向滚动的表格里会被裁掉。
 */
export function OngekiEventAdmin() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<OngekiTechChallengeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [songs, setSongs] = useState<OngekiTechChallengeMusic[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [savingSongs, setSavingSongs] = useState(false);
  const [newSongId, setNewSongId] = useState('');

  useEffect(() => {
    let active = true;
    void api
      .get('api/game/ongeki/tech-challenge-event')
      .then((data) => {
        if (active) setEvents((data ?? []) as OngekiTechChallengeEvent[]);
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

  const editing = editor ? events.find((item) => item.id === editor.eventId) ?? null : null;
  const editingTitle = editing ? editing.name || editing.chapterName || `#${editing.id}` : '';

  function openEventEditor(event: OngekiTechChallengeEvent) {
    if (editor?.eventId === event.id && editor.mode === 'event') {
      setEditor(null);
      return;
    }
    setEditor({ eventId: event.id, mode: 'event' });
    setDraft({
      startDate: toDateTimeLocal(event.startDate),
      endDate: toDateTimeLocal(event.endDate),
      type: event.type,
      kopId: event.kopId,
    });
  }

  function openMusicEditor(event: OngekiTechChallengeEvent) {
    if (editor?.eventId === event.id && editor.mode === 'music') {
      setEditor(null);
      return;
    }
    setEditor({ eventId: event.id, mode: 'music' });
    setNewSongId('');
    void loadSongs(event.id);
  }

  function updateDraft<K extends keyof EventDraft>(field: K, value: EventDraft[K]) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  async function saveEvent(event: OngekiTechChallengeEvent) {
    if (!draft) return;
    const startDate = toIso(draft.startDate);
    const endDate = toIso(draft.endDate);
    if (!startDate || !endDate) {
      notice(t('Ongeki.EventAdmin.NeedDates'), 'warning');
      return;
    }
    if (startDate >= endDate) {
      notice(t('Ongeki.EventAdmin.EndBeforeStart'), 'warning');
      return;
    }
    if (draft.type === 2 && (!Number.isFinite(draft.kopId) || draft.kopId < 0)) {
      notice(t('Ongeki.EventAdmin.NeedKopId'), 'warning');
      return;
    }

    setSavingEvent(true);
    setError('');
    try {
      const updated = await api.put(`api/game/ongeki/tech-challenge-event/${event.id}`, {
        startDate,
        endDate,
        type: draft.type,
        kopId: draft.kopId,
      }) as OngekiTechChallengeEvent;
      setEvents((current) => current.map((item) => item.id === event.id ? updated : item));
      setDraft({
        startDate: toDateTimeLocal(updated.startDate),
        endDate: toDateTimeLocal(updated.endDate),
        type: updated.type,
        kopId: updated.kopId,
      });
      notice(t('Ongeki.EventAdmin.Saved'), 'success');
    } catch (reason: unknown) {
      const message = String(reason);
      setError(message);
      notice(message, 'danger');
    } finally {
      setSavingEvent(false);
    }
  }

  async function loadSongs(eventId: number) {
    setLoadingSongs(true);
    setSongs([]);
    try {
      const data = await api.get(`api/game/ongeki/tech-challenge-event/${eventId}/music`);
      setSongs((data ?? []) as OngekiTechChallengeMusic[]);
    } catch (reason: unknown) {
      const message = String(reason);
      setError(message);
      notice(message, 'danger');
    } finally {
      setLoadingSongs(false);
    }
  }

  function updateSong(musicId: number, level: number) {
    setSongs((current) => current.map((song) => song.musicId === musicId ? { ...song, level } : song));
  }

  function removeSong(musicId: number) {
    setSongs((current) => current.filter((song) => song.musicId !== musicId));
  }

  function addSong(eventId: number) {
    const musicId = Number.parseInt(newSongId, 10);
    if (!Number.isFinite(musicId) || musicId <= 0) {
      notice(t('Ongeki.EventAdmin.NeedMusicId'), 'warning');
      return;
    }
    if (songs.some((song) => song.musicId === musicId)) {
      notice(t('Ongeki.EventAdmin.DuplicateMusic'), 'warning');
      return;
    }
    setSongs((current) => [...current, { eventId, musicId, level: 3, name: '', artistName: '', chartLevel: '' }]);
    setNewSongId('');
  }

  async function saveSongs(event: OngekiTechChallengeEvent) {
    setSavingSongs(true);
    setError('');
    try {
      const updated = await api.put(`api/game/ongeki/tech-challenge-event/${event.id}/music`, {
        musicList: songs.map((song) => ({ musicId: song.musicId, level: song.level })),
      }) as OngekiTechChallengeMusic[];
      const next = updated ?? [];
      setSongs(next);
      setEvents((current) => current.map((item) =>
        item.id === event.id ? { ...item, songCount: next.length } : item));
      notice(t('Ongeki.EventAdmin.MusicSaved'), 'success');
    } catch (reason: unknown) {
      const message = String(reason);
      setError(message);
      notice(message, 'danger');
    } finally {
      setSavingSongs(false);
    }
  }

  return (
    <div className="ongeki-event-admin">
      <p className="text-secondary small">{t('Ongeki.EventAdmin.Description')}</p>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {loading && <p className="text-secondary">{t('Ongeki.EventsPage.Loading')}</p>}
      {!loading && events.length === 0 && (
        <div className="alert alert-info" role="status">{t('Ongeki.EventAdmin.Empty')}</div>
      )}

      {events.length > 0 && (
        <div className="table-responsive">
          <table className="table table-hover align-middle w-auto mb-0">
            <thead>
              <tr>
                <th scope="col">{t('Ongeki.EventAdmin.Column.Event')}</th>
                <th scope="col">{t('Ongeki.EventsPage.Period')}</th>
                <th scope="col">{t('Ongeki.EventsPage.Chapter')}</th>
                <th scope="col">{t('Ongeki.EventAdmin.Column.Type')}</th>
                <th scope="col">{t('Ongeki.EventAdmin.Column.Kop')}</th>
                <th scope="col">{t('Ongeki.EventAdmin.Column.Start')}</th>
                <th scope="col">{t('Ongeki.EventAdmin.Column.End')}</th>
                <th scope="col">{t('Ongeki.EventAdmin.Column.Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const labelKey = typeLabelKey(event.type);
                const eventEditorOpen = editor?.eventId === event.id && editor.mode === 'event';
                const musicEditorOpen = editor?.eventId === event.id && editor.mode === 'music';
                return (
                  <tr key={event.id}>
                    <td>{event.name || '—'}</td>
                    <td>{event.id}</td>
                    <td>
                      {event.chapterName || '—'}
                      <span className="text-secondary small ms-1">({event.chapterId})</span>
                    </td>
                    <td>
                      <span className={`badge ${event.type === 2 ? 'text-bg-warning' : 'text-bg-info'}`}>
                        {labelKey ? t(labelKey) : t('Ongeki.EventAdmin.UnknownType', { type: event.type })}
                      </span>
                    </td>
                    <td>{event.type === 2 ? event.kopId : '—'}</td>
                    <td>{formatDateTime(event.startDate)}</td>
                    <td>{formatDateTime(event.endDate)}</td>
                    <td>
                      <button
                        type="button"
                        className={`btn btn-sm me-1 ${eventEditorOpen ? 'btn-primary' : 'btn-outline-primary'}`}
                        aria-expanded={eventEditorOpen}
                        onClick={() => openEventEditor(event)}
                      >
                        {t('Ongeki.EventAdmin.Edit')}
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${musicEditorOpen ? 'btn-primary' : 'btn-outline-secondary'}`}
                        aria-expanded={musicEditorOpen}
                        onClick={() => openMusicEditor(event)}
                      >
                        {t('Ongeki.EventAdmin.SongButton', { count: event.songCount })}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && editor?.mode === 'event' && draft && (
        <div className="ongeki-event-editor border rounded p-3 mt-3">
          <h3 className="h6 mb-3">{t('Ongeki.EventAdmin.EditTitle', { name: editingTitle })}</h3>
          <div className="d-flex flex-wrap align-items-end gap-3">
            <div>
              <label className="form-label small mb-1" htmlFor="ongeki-event-type">
                {t('Ongeki.EventAdmin.Column.Type')}
              </label>
              <select
                id="ongeki-event-type"
                className="form-select form-select-sm"
                style={{ width: '9rem' }}
                value={draft.type}
                disabled={savingEvent}
                onChange={(input) => updateDraft('type', Number(input.target.value))}
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
            </div>
            <div>
              <label className="form-label small mb-1" htmlFor="ongeki-event-kop">
                {t('Ongeki.EventAdmin.Column.Kop')}
              </label>
              <input
                id="ongeki-event-kop"
                type="number"
                min="0"
                className="form-control form-control-sm"
                style={{ width: '6rem' }}
                value={draft.kopId}
                disabled={savingEvent || draft.type !== 2}
                onChange={(input) => updateDraft('kopId', Number(input.target.value))}
              />
            </div>
            <div>
              <span className="form-label small mb-1 d-block">{t('Ongeki.EventAdmin.Column.Start')}</span>
              <DateTimeField
                value={draft.startDate}
                label={`${editingTitle} ${t('Ongeki.EventAdmin.Column.Start')}`}
                disabled={savingEvent}
                onChange={(value) => updateDraft('startDate', value)}
              />
            </div>
            <div>
              <span className="form-label small mb-1 d-block">{t('Ongeki.EventAdmin.Column.End')}</span>
              <DateTimeField
                value={draft.endDate}
                label={`${editingTitle} ${t('Ongeki.EventAdmin.Column.End')}`}
                disabled={savingEvent}
                onChange={(value) => updateDraft('endDate', value)}
              />
            </div>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={savingEvent}
              onClick={() => void saveEvent(editing)}
            >
              {savingEvent ? t('Ongeki.EventAdmin.Saving') : t('Ongeki.EventAdmin.Save')}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={savingEvent}
              onClick={() => setEditor(null)}
            >
              {t('Ongeki.EventAdmin.Cancel')}
            </button>
          </div>
          {/* animal-island 主题的日期/时间弹层需要下方留白，否则会被裁掉 */}
          <div className="ongeki-event-editor-spacer" aria-hidden="true" />
        </div>
      )}

      {editing && editor?.mode === 'music' && (
        <div className="ongeki-music-editor border rounded p-3 mt-3">
          <h3 className="h6 mb-3">{t('Ongeki.EventAdmin.MusicTitle', { name: editingTitle })}</h3>
          {loadingSongs && <p className="text-secondary small mb-2">{t('Ongeki.EventAdmin.LoadingSongs')}</p>}
          {!loadingSongs && songs.length === 0 && (
            <p className="text-secondary small mb-2">{t('Ongeki.EventAdmin.NoSongs')}</p>
          )}
          {!loadingSongs && songs.length > 0 && (
            <div className="table-responsive mb-2">
              <table className="table table-sm align-middle mb-0 w-auto">
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
                  {songs.map((song, index) => (
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
                          aria-label={`${song.musicId} ${t('Ongeki.EventsPage.Difficulty')}`}
                          value={song.level}
                          onChange={(input) => updateSong(song.musicId, Number(input.target.value))}
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
                          onClick={() => removeSong(song.musicId)}
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
              aria-label={t('Ongeki.EventAdmin.MusicIdPlaceholder')}
              value={newSongId}
              onChange={(input) => setNewSongId(input.target.value)}
            />
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={() => addSong(editing.id)}
            >
              {t('Ongeki.EventAdmin.Add')}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={savingSongs}
              onClick={() => void saveSongs(editing)}
            >
              {savingSongs ? t('Ongeki.EventAdmin.Saving') : t('Ongeki.EventAdmin.SaveSongs')}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={savingSongs}
              onClick={() => setEditor(null)}
            >
              {t('Ongeki.EventAdmin.Cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
