import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { format, parseISO, isToday, isTomorrow, differenceInDays } from 'date-fns';
import './Calendar.css';

function eventDate(event) {
  return event.start?.dateTime || event.start?.date;
}

function formatEventTime(event) {
  const start = event.start?.dateTime;
  const end = event.end?.dateTime;
  if (!start) return 'All day';
  const s = format(parseISO(start), 'h:mm a');
  const e = end ? format(parseISO(end), 'h:mm a') : null;
  return e ? `${s} – ${e}` : s;
}

function dayLabel(event) {
  const d = eventDate(event);
  if (!d) return '';
  const date = d.includes('T') ? parseISO(d) : parseISO(d + 'T00:00:00');
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  const diff = differenceInDays(date, new Date());
  if (diff <= 6) return format(date, 'EEEE');
  return format(date, 'MMM d');
}

export default function Calendar() {
  const [status, setStatus] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    const s = await api.get('/calendar/status');
    setStatus(s.connected);
    return s.connected;
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/calendar/events');
      setEvents(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus().then(connected => { if (connected) loadEvents(); });
  }, [loadStatus, loadEvents]);

  async function connect() {
    const { url } = await api.get('/calendar/auth');
    const win = window.open(url, '_blank', 'width=500,height=600');
    const interval = setInterval(async () => {
      try {
        if (win?.closed) {
          clearInterval(interval);
          const connected = await loadStatus();
          if (connected) loadEvents();
        }
      } catch {}
    }, 500);
  }

  async function disconnect() {
    await api.delete('/calendar/disconnect');
    setEvents([]);
    setStatus(false);
  }

  // Group events by day label
  const groups = [];
  const seen = new Map();
  for (const ev of events) {
    const label = dayLabel(ev);
    if (!seen.has(label)) { seen.set(label, []); groups.push({ label, items: seen.get(label) }); }
    seen.get(label).push(ev);
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Calendar</h1>
        {status === true && (
          <button className="btn btn-ghost" onClick={disconnect}>Disconnect</button>
        )}
      </div>

      {status === false && (
        <div className="card connect-card">
          <div className="connect-icon">◷</div>
          <div className="connect-text">
            <strong>Connect Google Calendar</strong>
            <p>View your upcoming events in a read-only feed.</p>
          </div>
          <button className="btn btn-primary" onClick={connect}>Connect</button>
        </div>
      )}

      {status === true && loading && <div className="empty-state">Loading events…</div>}
      {status === true && error && <div className="empty-state" style={{ color: 'var(--red)' }}>Error: {error}</div>}

      {status === true && !loading && events.length === 0 && !error && (
        <div className="empty-state">No upcoming events in the next 14 days.</div>
      )}

      {groups.map(({ label, items }) => (
        <div key={label} className="event-group">
          <div className="event-group-label">{label}</div>
          <div className="events-list">
            {items.map(ev => (
              <div key={ev.id} className="event-card card">
                <div className="event-bar" />
                <div className="event-content">
                  <div className="event-title">{ev.summary || '(No title)'}</div>
                  <div className="event-time">{formatEventTime(ev)}</div>
                  {ev.location && <div className="event-loc">📍 {ev.location}</div>}
                  {ev.description && <div className="event-desc">{ev.description.slice(0, 120)}{ev.description.length > 120 ? '…' : ''}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
