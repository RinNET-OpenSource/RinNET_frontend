import { Fragment, useEffect, useState } from 'react';
import { DateTimeField } from '@/components/shared/DateTimeField';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import type { OngekiTechChallengeEvent, OngekiTechChallengeMusic } from '@/features/ongeki/models';

const DIFFICULTY_OPTIONS = [
  { value: 0, label: 'BASIC' },
  { value: 1, label: 'ADVANCED' },
  { value: 2, label: 'EXPERT' },
  { value: 3, label: 'MASTER' },
  { value: 10, label: 'LUNATIC' },
];

interface EventDraft {
  startDate: string;
  endDate: string;
  /** 1 = 音击挑战, 2 = KoP 预选。 */
  type: number;
  kopId: number;
}

const TYPE_OPTIONS = [
  { value: 1, label: '音击挑战' },
  { value: 2, label: 'KoP 预选' },
];

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
      notice('请填写完整的开始与结束时间。', 'warning');
      return;
    }
    if (startDate >= endDate) {
      notice('结束时间必须晚于开始时间。', 'warning');
      return;
    }
    if (type === 2 && (!Number.isFinite(kopId) || kopId < 0)) {
      notice('KoP 预选需要填写有效的 KoP ID。', 'warning');
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
      notice('活动设置已保存。', 'success');
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
      notice('请输入有效的乐曲 ID。', 'warning');
      return;
    }
    const list = songs[String(eventId)] ?? [];
    if (list.some((song) => song.musicId === musicId)) {
      notice('该乐曲已在课题曲列表中。', 'warning');
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
      notice('课题曲已保存。', 'success');
    } catch (reason: unknown) {
      const message = String(reason);
      setError(message);
      notice(message, 'danger');
    } finally {
      setSavingSongsId(null);
    }
  }

  if (loading) return <p className="text-secondary">加载中…</p>;

  return (
    <div>
      <p className="text-secondary small">
        编辑音击挑战活动的类型、开放时间与课题曲。期号必须与客户端包中的数据一致，章节名称来自服务端章节表；
        类型与 KoP ID 必须与客户端包中 TechChallengeEventData 的 Type / KopID 一致，否则客户端的 KoP 预选与排行榜会对不上。
      </p>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {events.length === 0 && <div className="alert alert-info" role="status">没有配置任何音击挑战活动。</div>}

      {events.length > 0 && (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th scope="col">活动</th>
                <th scope="col">期号</th>
                <th scope="col">章节</th>
                <th scope="col">类型</th>
                <th scope="col">KoP</th>
                <th scope="col">开始时间</th>
                <th scope="col">结束时间</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const draft = drafts[String(event.id)]
                  ?? { startDate: '', endDate: '', type: event.type, kopId: event.kopId };
                const list = songs[String(event.id)] ?? [];
                return (
                  <Fragment key={event.id}>
                    <tr>
                      <td>{event.name || '—'}</td>
                      <td>{event.id}</td>
                      <td>
                        {event.chapterName || '—'}
                        <span className="text-secondary small ms-1">({event.chapterId})</span>
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          style={{ width: '9rem' }}
                          value={draft.type}
                          aria-label={`${event.name} 类型`}
                          disabled={savingId === event.id}
                          onChange={(input) => updateDraft(event.id, 'type', Number(input.target.value))}
                        >
                          {TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                          {TYPE_OPTIONS.every((option) => option.value !== draft.type) && (
                            <option value={draft.type}>类型 {draft.type}</option>
                          )}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          className="form-control form-control-sm"
                          style={{ width: '6rem' }}
                          value={draft.kopId}
                          aria-label={`${event.name} KoP ID`}
                          disabled={savingId === event.id || draft.type !== 2}
                          onChange={(input) => updateDraft(event.id, 'kopId', Number(input.target.value))}
                        />
                      </td>
                      <td style={{ minWidth: '17rem' }}>
                        <DateTimeField
                          value={draft.startDate}
                          label={`${event.name} 开始时间`}
                          disabled={savingId === event.id}
                          onChange={(value) => updateDraft(event.id, 'startDate', value)}
                        />
                      </td>
                      <td style={{ minWidth: '17rem' }}>
                        <DateTimeField
                          value={draft.endDate}
                          label={`${event.name} 结束时间`}
                          disabled={savingId === event.id}
                          onChange={(value) => updateDraft(event.id, 'endDate', value)}
                        />
                      </td>
                      <td className="text-nowrap">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm me-1"
                          disabled={savingId === event.id}
                          onClick={() => void saveEvent(event)}
                        >
                          {savingId === event.id ? '保存中…' : '保存'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => toggleSongs(event)}
                        >
                          课题曲 {event.songCount}
                        </button>
                      </td>
                    </tr>
                    {expandedId === event.id && (
                      <tr>
                        <td colSpan={8}>
                          {loadingSongsId === event.id && <p className="text-secondary small mb-2">加载课题曲…</p>}
                          {loadingSongsId !== event.id && list.length === 0 && (
                            <p className="text-secondary small mb-2">该活动还没有课题曲，可在下方添加。</p>
                          )}
                          {loadingSongsId !== event.id && list.length > 0 && (
                            <div className="table-responsive mb-2">
                              <table className="table table-sm align-middle mb-0">
                                <thead>
                                  <tr>
                                    <th scope="col" style={{ width: '4rem' }}>#</th>
                                    <th scope="col">乐曲</th>
                                    <th scope="col">难度</th>
                                    <th scope="col">定数</th>
                                    <th scope="col" style={{ width: '5rem' }}>操作</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {list.map((song, index) => (
                                    <tr key={song.musicId}>
                                      <th scope="row">{index + 1}</th>
                                      <td>
                                        <span className="text-secondary me-2">{song.musicId}</span>
                                        {song.name || '未知曲目'}
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
                                            <option value={song.level}>难度 {song.level}</option>
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
                                          移除
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
                              placeholder="乐曲 ID"
                              value={newSongId}
                              onChange={(input) => setNewSongId(input.target.value)}
                            />
                            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => addSong(event.id)}>
                              添加
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={savingSongsId === event.id}
                              onClick={() => void saveSongs(event)}
                            >
                              {savingSongsId === event.id ? '保存中…' : '保存课题曲'}
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
