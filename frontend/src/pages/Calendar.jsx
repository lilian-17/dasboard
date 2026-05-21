import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import {
  format, parseISO, isSameDay, isSameMonth,
  addDays, addWeeks, addMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, getHours, getMinutes,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import './Calendar.css';

const HOUR_START = 7;
const HOUR_END = 22;
const TOTAL_HOURS = HOUR_END - HOUR_START; // 15

function formatEventTime(event) {
  const start = event.start?.dateTime;
  const end = event.end?.dateTime;
  if (!start) return 'Toute la journée';
  const s = format(parseISO(start), 'H:mm');
  const e = end ? format(parseISO(end), 'H:mm') : null;
  return e ? `${s} – ${e}` : s;
}

function getEventPosition(event) {
  const startStr = event.start?.dateTime;
  const endStr = event.end?.dateTime;
  if (!startStr) return null;

  const startDate = parseISO(startStr);
  const startHour = getHours(startDate) + getMinutes(startDate) / 60;

  let endHour;
  if (endStr) {
    const endDate = parseISO(endStr);
    endHour = isSameDay(startDate, endDate)
      ? getHours(endDate) + getMinutes(endDate) / 60
      : HOUR_END;
  } else {
    endHour = startHour + 1;
  }

  const clampedStart = Math.max(HOUR_START, Math.min(HOUR_END, startHour));
  if (clampedStart >= HOUR_END) return null;

  let clampedEnd = Math.max(clampedStart + 0.25, Math.min(HOUR_END, endHour));
  clampedEnd = Math.min(HOUR_END, clampedEnd);

  return {
    top: (clampedStart - HOUR_START) / TOTAL_HOURS * 100,
    height: (clampedEnd - clampedStart) / TOTAL_HOURS * 100,
  };
}

function EventBlock({ event }) {
  const pos = getEventPosition(event);
  if (!pos) return null;
  return (
    <div
      className="event-block"
      style={{ top: `${pos.top}%`, height: `${pos.height}%` }}
      title={event.summary || '(Sans titre)'}
    >
      <div className="event-block-title">{event.summary || '(Sans titre)'}</div>
      <div className="event-block-time">{formatEventTime(event)}</div>
    </div>
  );
}

function WeekGrid({ weekStart, events }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => HOUR_START + i);

  const allDayEvents = events.filter(ev => !ev.start?.dateTime);
  const timedEvents = events.filter(ev => ev.start?.dateTime);

  const eventsByDay = days.map(day =>
    timedEvents.filter(ev => isSameDay(parseISO(ev.start.dateTime), day))
  );

  const allDayByDay = days.map(day =>
    allDayEvents.filter(ev => {
      if (!ev.start?.date || !ev.end?.date) return false;
      const start = parseISO(ev.start.date + 'T00:00:00');
      const end = parseISO(ev.end.date + 'T00:00:00');
      return day >= start && day < end;
    })
  );

  const nowHour = getHours(today) + getMinutes(today) / 60;
  const nowPct = (nowHour - HOUR_START) / TOTAL_HOURS * 100;
  const isCurrentWeek = days.some(d => isSameDay(d, today));

  const hasAllDay = allDayEvents.length > 0;

  return (
    <div className="week-grid">
      <div className="week-header">
        <div className="week-time-gutter" />
        {days.map((day, i) => (
          <div
            key={format(day, 'yyyy-MM-dd')}
            className={[
              'week-day-header',
              isSameDay(day, today) ? 'today' : '',
              i >= 5 ? 'weekend' : '',
            ].filter(Boolean).join(' ')}
          >
            <span className="week-day-name">
              {format(day, 'EEE', { locale: fr })}
            </span>
            <span className={`week-day-num${isSameDay(day, today) ? ' today-circle' : ''}`}>
              {format(day, 'd')}
            </span>
          </div>
        ))}
      </div>

      {hasAllDay && (
        <div className="week-allday-row">
          <div className="week-time-gutter">
            <span className="allday-label">jour</span>
          </div>
          {days.map((day, i) => (
            <div key={format(day, 'yyyy-MM-dd')} className={`week-allday-cell${i >= 5 ? ' weekend' : ''}`}>
              {allDayByDay[i].map(ev => (
                <div key={ev.id} className="allday-event">
                  {ev.summary || '(Sans titre)'}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="week-body">
        <div className="week-time-col">
          {hours.map(h => (
            <div key={h} className="week-hour-cell">
              <span className="week-hour-label">{h}h</span>
            </div>
          ))}
        </div>
        {days.map((day, i) => (
          <div
            key={format(day, 'yyyy-MM-dd')}
            className={[
              'week-day-col',
              isSameDay(day, today) ? 'today' : '',
              i >= 5 ? 'weekend' : '',
            ].filter(Boolean).join(' ')}
          >
            {hours.map(h => (
              <div key={h} className="week-hour-slot" />
            ))}
            {eventsByDay[i].map(ev => (
              <EventBlock key={ev.id} event={ev} />
            ))}
            {isCurrentWeek && isSameDay(day, today) && nowPct >= 0 && nowPct <= 100 && (
              <div className="now-line" style={{ top: `${nowPct}%` }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniMonth({ currentWeekStart, onDayClick, viewingMonth, onMonthChange }) {
  const monthStart = startOfMonth(viewingMonth);
  const monthEnd = endOfMonth(viewingMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const today = new Date();
  const weekEnd = addDays(currentWeekStart, 6);

  return (
    <div className="mini-month">
      <div className="mini-month-header">
        <button onClick={() => onMonthChange(-1)} aria-label="Mois précédent">‹</button>
        <span>{format(viewingMonth, 'MMMM yyyy', { locale: fr })}</span>
        <button onClick={() => onMonthChange(1)} aria-label="Mois suivant">›</button>
      </div>
      <div className="mini-month-grid">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <span key={i} className="mini-day-label">{d}</span>
        ))}
        {days.map(day => {
          const inMonth = isSameMonth(day, viewingMonth);
          const isToday = isSameDay(day, today);
          const inWeek = day >= currentWeekStart && day <= weekEnd;
          return (
            <button
              key={day.toISOString()}
              className={[
                'mini-day',
                !inMonth ? 'out-of-month' : '',
                inWeek ? 'in-week' : '',
                isToday ? 'is-today' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onDayClick(day)}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Calendar() {
  const [status, setStatus] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(
    () => startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [viewingMonth, setViewingMonth] = useState(
    () => startOfMonth(new Date())
  );

  const statusRef = useRef(null);
  useEffect(() => { statusRef.current = status; }, [status]);

  const connectIntervalRef = useRef(null);
  useEffect(() => {
    return () => { if (connectIntervalRef.current) clearInterval(connectIntervalRef.current); };
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const s = await api.get('/calendar/status');
      setStatus(s.connected);
      return s.connected;
    } catch {
      setStatus(false);
      return false;
    }
  }, []);

  const loadEvents = useCallback(async (weekStart) => {
    setLoading(true);
    setError(null);
    try {
      const timeMin = weekStart.toISOString();
      const timeMax = addDays(weekStart, 7).toISOString();
      const data = await api.get(
        `/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`
      );
      setEvents(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadStatus().then(connected => { if (connected) loadEvents(currentWeekStart); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload when week changes
  useEffect(() => {
    if (statusRef.current === true) loadEvents(currentWeekStart);
  }, [currentWeekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDayClick(day) {
    const newWeekStart = startOfWeek(day, { weekStartsOn: 1 });
    setCurrentWeekStart(newWeekStart);
    setViewingMonth(startOfMonth(day));
  }

  function handleMonthChange(delta) {
    setViewingMonth(prev => addMonths(prev, delta));
  }

  function goToPrevWeek() {
    const newW = addWeeks(currentWeekStart, -1);
    setCurrentWeekStart(newW);
    setViewingMonth(startOfMonth(newW));
  }

  function goToNextWeek() {
    const newW = addWeeks(currentWeekStart, 1);
    setCurrentWeekStart(newW);
    setViewingMonth(startOfMonth(newW));
  }

  function goToToday() {
    const newW = startOfWeek(new Date(), { weekStartsOn: 1 });
    setCurrentWeekStart(newW);
    setViewingMonth(startOfMonth(new Date()));
  }

  async function connect() {
    try {
      const { url } = await api.get('/calendar/auth');
      const win = window.open(url, '_blank', 'width=500,height=600');
      if (!win) { setError('Le popup a été bloqué. Autorise les popups et réessaie.'); return; }
      if (connectIntervalRef.current) clearInterval(connectIntervalRef.current);
      connectIntervalRef.current = setInterval(async () => {
        try {
          if (win.closed) {
            clearInterval(connectIntervalRef.current);
            connectIntervalRef.current = null;
            const connected = await loadStatus();
            if (connected) loadEvents(currentWeekStart);
          }
        } catch {}
      }, 500);
    } catch (e) {
      setError(e.message);
    }
  }

  async function disconnect() {
    try {
      await api.delete('/calendar/disconnect');
    } finally {
      setEvents([]);
      setStatus(false);
    }
  }

  const today = new Date();
  const todayEvents = events
    .filter(ev => {
      const d = ev.start?.dateTime || ev.start?.date;
      if (!d) return false;
      const date = d.includes('T') ? parseISO(d) : parseISO(d + 'T00:00:00');
      return isSameDay(date, today);
    })
    .sort((a, b) => {
      const aT = a.start?.dateTime || a.start?.date || '';
      const bT = b.start?.dateTime || b.start?.date || '';
      return aT.localeCompare(bT);
    });

  const weekLabel = `${format(currentWeekStart, 'd MMM', { locale: fr })} – ${format(addDays(currentWeekStart, 6), 'd MMM yyyy', { locale: fr })}`;

  return (
    <div className="calendar-layout">
      <div className="calendar-main">
        <div className="page-header">
          <div className="cal-title-row">
            <h1 className="page-title">Calendrier</h1>
            <div className="week-nav">
              <button className="btn btn-ghost week-nav-btn" onClick={goToPrevWeek}>‹</button>
              <span className="week-label">{weekLabel}</span>
              <button className="btn btn-ghost week-nav-btn" onClick={goToNextWeek}>›</button>
              <button className="btn btn-ghost" onClick={goToToday}>Aujourd'hui</button>
            </div>
          </div>
          {status === true && (
            <button className="btn btn-ghost" onClick={disconnect}>Déconnecter</button>
          )}
        </div>

        {status === false && (
          <div className="card connect-card">
            <div className="connect-icon">◷</div>
            <div className="connect-text">
              <strong>Connecter Google Agenda</strong>
              <p>Affiche tes événements dans une vue semaine interactive.</p>
            </div>
            <button className="btn btn-primary" onClick={connect}>Connecter</button>
          </div>
        )}

        {status === null && <div className="empty-state">Chargement…</div>}
        {status === true && loading && <div className="empty-state">Chargement des événements…</div>}
        {status === true && error && (
          <div className="empty-state" style={{ color: 'var(--red)' }}>Erreur : {error}</div>
        )}
        {status === true && !loading && !error && (
          <WeekGrid weekStart={currentWeekStart} events={events} />
        )}
      </div>

      {status === true && (
        <aside className="calendar-sidebar">
          <MiniMonth
            currentWeekStart={currentWeekStart}
            onDayClick={handleDayClick}
            viewingMonth={viewingMonth}
            onMonthChange={handleMonthChange}
          />
          <div className="day-summary card">
            <div className="day-summary-title">
              {format(today, 'EEEE d MMMM', { locale: fr })}
            </div>
            {todayEvents.length === 0 ? (
              <div className="day-summary-empty">Aucun événement aujourd'hui</div>
            ) : (
              <ul className="day-summary-list">
                {todayEvents.map(ev => (
                  <li key={ev.id} className="day-summary-item">
                    <div className="day-summary-dot" />
                    <div>
                      <div className="day-summary-name">{ev.summary || '(Sans titre)'}</div>
                      <div className="day-summary-time">{formatEventTime(ev)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
