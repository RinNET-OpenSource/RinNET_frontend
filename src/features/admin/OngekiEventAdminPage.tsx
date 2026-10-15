import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import type { OngekiTechChallengeEvent } from '@/features/ongeki/models';

interface DraftDates {
  startDate: string;
  endDate: string;
}

function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function eventType(event: OngekiTechChallengeEvent): string {
  return event.type === 2 ? 'KoP Qualify' : 'Tech Challenge';
}

export function OngekiEventAdminPage() {
  const [events, setEvents] = useState<OngekiTechChallengeEvent[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftDates>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState('');

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

  function updateDraft(eventId: number, field: keyof DraftDates, value: string) {
    setDrafts((current) => ({
      ...current,
      [String(eventId)]: { ...current[String(eventId)], [field]: value },
    }));
  }

  async function save(event: OngekiTechChallengeEvent) {
    const draft = drafts[String(event.id)];
    if (!draft?.startDate || !draft.endDate) {
      notice('Both dates are required.', 'warning');
      return;
    }
    const start = new Date(draft.startDate);
    const end = new Date(draft.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      notice('End date must be later than start date.', 'warning');
      return;
    }

    setSavingId(event.id);
    setError('');
    try {
      const updated = await api.put(`api/game/ongeki/tech-challenge-event/${event.id}`, {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      }) as OngekiTechChallengeEvent;
      setEvents((current) => current.map((item) => item.id === event.id ? updated : item));
      setDrafts((current) => ({
        ...current,
        [String(event.id)]: {
          startDate: toDateTimeLocal(updated.startDate),
          endDate: toDateTimeLocal(updated.endDate),
        },
      }));
      notice('Event dates updated.', 'success');
    } catch (reason: unknown) {
      const message = String(reason);
      setError(message);
      notice(message, 'danger');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="content">
      <h1 className="page-heading">Ongeki Event Management</h1>
      <p className="text-secondary">Edit the dates used by the Ongeki event-period API. Period IDs must match the client package.</p>
      {loading && <p className="text-secondary">Loading events…</p>}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {!loading && events.length === 0 && <div className="alert alert-info">No Tech Challenge metadata is configured.</div>}

      {events.length > 0 && (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr><th>Event</th><th>Period</th><th>Chapter</th><th>Type</th><th>KoP ID</th><th>Start</th><th>End</th><th /></tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const draft = drafts[String(event.id)] ?? { startDate: '', endDate: '' };
                return (
                  <tr key={event.id}>
                    <td className="text-nowrap">{event.name}</td>
                    <td>{event.id}</td>
                    <td>{event.chapterId}</td>
                    <td><span className="badge text-bg-secondary">{eventType(event)}</span></td>
                    <td>{event.kopId || '—'}</td>
                    <td><input className="form-control form-control-sm" type="datetime-local" value={draft.startDate} onChange={(input) => updateDraft(event.id, 'startDate', input.target.value)} /></td>
                    <td><input className="form-control form-control-sm" type="datetime-local" value={draft.endDate} onChange={(input) => updateDraft(event.id, 'endDate', input.target.value)} /></td>
                    <td><button type="button" className="btn btn-primary btn-sm text-nowrap" disabled={savingId === event.id} onClick={() => void save(event)}>{savingId === event.id ? 'Saving…' : 'Save'}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
