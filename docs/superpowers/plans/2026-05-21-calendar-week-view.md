# Calendar Week View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Calendar page list view with a Google Agenda–style week view (7h–22h time grid, 7 columns Mon–Sun) plus an interactive mini month widget on the right sidebar.

**Architecture:** Backend `/events` endpoint gains optional `timeMin`/`timeMax` query params for flexible date range fetching. Frontend `Calendar.jsx` is fully rewritten with three sub-components (`MiniMonth`, `WeekGrid`, `EventBlock`) and a `CalendarPage` orchestrator that holds shared state. All styles live in `Calendar.css`.

**Tech Stack:** React, date-fns (already installed), Google Calendar API (existing OAuth flow unchanged), Vite dev server.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `backend/routes/calendar.js` | Accept `timeMin`/`timeMax` query params |
| Rewrite | `frontend/src/pages/Calendar.jsx` | All calendar components |
| Rewrite | `frontend/src/pages/Calendar.css` | All calendar styles |

---

## Task 1: Backend — accept `timeMin`/`timeMax` query params

**Files:**
- Modify: `backend/routes/calendar.js:71-104`

- [ ] **Step 1: Replace the time range logic in the `/events` handler**

Open `backend/routes/calendar.js`. Replace the block starting at `const now = new Date();` inside the `router.get('/events', ...)` handler with:

```javascript
    const now = new Date();
    const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    let timeMin = now.toISOString();
    let timeMax = twoWeeksOut.toISOString();

    if (req.query.timeMin && req.query.timeMax) {
      const parsedMin = new Date(req.query.timeMin);
      const parsedMax = new Date(req.query.timeMax);
      if (!isNaN(parsedMin) && !isNaN(parsedMax)) {
        timeMin = parsedMin.toISOString();
        timeMax = parsedMax.toISOString();
      }
    }

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    });
```

- [ ] **Step 2: Verify the server still starts**

```bash
cd /home/verso/dashboard && npm run start 2>&1 | head -5
```

Expected: server starts without errors (or use `node backend/server.js` directly if start.sh forks both).

- [ ] **Step 3: Commit**

```bash
git add backend/routes/calendar.js
git commit -m "feat(calendar): accept timeMin/timeMax query params in /events"
```

---

## Task 2: Rewrite `Calendar.jsx` — helpers and imports

**Files:**
- Rewrite: `frontend/src/pages/Calendar.jsx`

Start by writing the file from scratch with just the imports and helper functions. This establishes the foundation for the components added in Tasks 3–5.

- [ ] **Step 1: Write the imports and helper functions**

Create `frontend/src/pages/Calendar.jsx` with the following content (components will be appended in later tasks):

```jsx
import { useState, useEffect, useCallback } from 'react';
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
  const clampedEnd = Math.max(clampedStart + 0.25, Math.min(HOUR_END, endHour));

  return {
    top: (clampedStart - HOUR_START) / TOTAL_HOURS * 100,
    height: (clampedEnd - clampedStart) / TOTAL_HOURS * 100,
  };
}
```

File ends here for now — no default export yet.

- [ ] **Step 2: Confirm no lint errors**

```bash
cd /home/verso/dashboard/frontend && npx vite build --mode development 2>&1 | grep -E "error|Error" | head -10
```

Expected: no errors (warnings about missing export are fine at this stage).

---

## Task 3: Add `EventBlock` and `WeekGrid` to `Calendar.jsx`

**Files:**
- Modify: `frontend/src/pages/Calendar.jsx` (append after helpers)

- [ ] **Step 1: Append `EventBlock` component**

Add after the `getEventPosition` function:

```jsx
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
```

- [ ] **Step 2: Append `WeekGrid` component**

Add after `EventBlock`:

```jsx
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
            key={i}
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
            <div key={i} className={`week-allday-cell${i >= 5 ? ' weekend' : ''}`}>
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
            key={i}
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
```

---

## Task 4: Add `MiniMonth` to `Calendar.jsx`

**Files:**
- Modify: `frontend/src/pages/Calendar.jsx` (append after `WeekGrid`)

- [ ] **Step 1: Append `MiniMonth` component**

```jsx
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
```

---

## Task 5: Add `CalendarPage` (default export) to `Calendar.jsx`

**Files:**
- Modify: `frontend/src/pages/Calendar.jsx` (append after `MiniMonth`)

- [ ] **Step 1: Append the `CalendarPage` default export**

```jsx
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

  const loadStatus = useCallback(async () => {
    const s = await api.get('/calendar/status');
    setStatus(s.connected);
    return s.connected;
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

  // Navigation: reload when week changes (status already true at this point)
  useEffect(() => {
    if (status === true) loadEvents(currentWeekStart);
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
    const { url } = await api.get('/calendar/auth');
    const win = window.open(url, '_blank', 'width=500,height=600');
    const interval = setInterval(async () => {
      try {
        if (win?.closed) {
          clearInterval(interval);
          const connected = await loadStatus();
          if (connected) loadEvents(currentWeekStart);
        }
      } catch {}
    }, 500);
  }

  async function disconnect() {
    await api.delete('/calendar/disconnect');
    setEvents([]);
    setStatus(false);
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
```

- [ ] **Step 2: Commit the complete Calendar.jsx**

```bash
git add frontend/src/pages/Calendar.jsx
git commit -m "feat(calendar): rewrite Calendar.jsx with WeekGrid, MiniMonth, EventBlock"
```

---

## Task 6: Rewrite `Calendar.css`

**Files:**
- Rewrite: `frontend/src/pages/Calendar.css`

- [ ] **Step 1: Write the complete new CSS**

Replace the entire file content with:

```css
/* ── Layout ─────────────────────────────────────── */
.calendar-layout {
  display: flex;
  gap: 20px;
  height: calc(100vh - 96px);
  overflow: hidden;
}

.calendar-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.calendar-sidebar {
  width: 216px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

/* ── Page header ─────────────────────────────────── */
.cal-title-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.week-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.week-nav-btn {
  padding: 4px 8px;
  font-size: 16px;
  line-height: 1;
}

.week-label {
  font-size: 13px;
  color: var(--text-2);
  min-width: 164px;
  text-align: center;
  padding: 0 4px;
}

/* ── Connect card (reused from old) ─────────────── */
.connect-card {
  display: flex;
  align-items: center;
  gap: 20px;
  max-width: 480px;
}

.connect-icon {
  font-size: 32px;
  opacity: 0.35;
  flex-shrink: 0;
}

.connect-text strong {
  display: block;
  font-size: 14px;
  margin-bottom: 3px;
}

.connect-text p {
  color: var(--text-2);
  font-size: 13px;
}

/* ── Week grid container ─────────────────────────── */
.week-grid {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--bg-1);
}

/* ── Week header (day names + numbers) ───────────── */
.week-header {
  display: grid;
  grid-template-columns: 48px repeat(7, 1fr);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--bg-1);
}

.week-time-gutter {
  border-right: 1px solid var(--border);
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 4px 6px 4px 0;
}

.week-day-header {
  padding: 8px 4px 6px;
  text-align: center;
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.week-day-header.weekend { background: var(--bg); }
.week-day-header.today   { background: var(--accent-dim); }

.week-day-name {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3);
}

.week-day-num {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-2);
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.week-day-num.today-circle {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}

/* ── All-day row ─────────────────────────────────── */
.week-allday-row {
  display: grid;
  grid-template-columns: 48px repeat(7, 1fr);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  min-height: 26px;
}

.allday-label {
  font-size: 9px;
  color: var(--text-3);
  text-align: right;
  padding: 4px 6px 0 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.week-allday-cell {
  border-left: 1px solid var(--border);
  padding: 2px 3px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.week-allday-cell.weekend { background: var(--bg); }

.allday-event {
  background: var(--accent-dim);
  color: var(--accent);
  font-size: 10px;
  font-weight: 500;
  padding: 1px 5px;
  border-radius: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Week body (scrollable time grid) ───────────── */
.week-body {
  flex: 1;
  display: grid;
  grid-template-columns: 48px repeat(7, 1fr);
  overflow-y: auto;
}

.week-time-col {
  border-right: 1px solid var(--border);
  flex-shrink: 0;
}

.week-hour-cell {
  height: 48px;
  position: relative;
  border-bottom: 1px solid var(--border);
}

.week-hour-label {
  position: absolute;
  top: -8px;
  right: 6px;
  font-size: 10px;
  color: var(--text-3);
  user-select: none;
}

.week-day-col {
  position: relative;
  border-left: 1px solid var(--border);
}

.week-day-col.weekend { background: var(--bg); }
.week-day-col.today   { background: rgba(99, 102, 241, 0.025); }

.week-hour-slot {
  height: 48px;
  border-bottom: 1px solid var(--border);
}

/* ── Event blocks ────────────────────────────────── */
.event-block {
  position: absolute;
  left: 2px;
  right: 2px;
  background: rgba(99, 102, 241, 0.18);
  border-left: 3px solid var(--accent);
  border-radius: 4px;
  padding: 2px 4px;
  overflow: hidden;
  cursor: default;
  z-index: 1;
  transition: filter 0.1s;
}

.event-block:hover { filter: brightness(1.25); }

.event-block-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.event-block-time {
  font-size: 10px;
  color: var(--text-2);
  line-height: 1.2;
}

/* ── Current time indicator ─────────────────────── */
.now-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--red);
  z-index: 2;
  pointer-events: none;
}

.now-line::before {
  content: '';
  position: absolute;
  left: -4px;
  top: -4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--red);
}

/* ── Mini month ──────────────────────────────────── */
.mini-month {
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 14px 12px;
}

.mini-month-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.mini-month-header span {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  text-transform: capitalize;
}

.mini-month-header button {
  background: none;
  border: none;
  color: var(--text-3);
  font-size: 16px;
  padding: 0 4px;
  cursor: pointer;
  line-height: 1;
  border-radius: var(--radius);
  transition: color 0.1s, background 0.1s;
}

.mini-month-header button:hover {
  color: var(--text);
  background: var(--bg-3);
}

.mini-month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  text-align: center;
}

.mini-day-label {
  font-size: 9px;
  color: var(--text-3);
  padding: 3px 0;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.mini-day {
  width: 100%;
  aspect-ratio: 1;
  font-size: 11px;
  color: var(--text-2);
  background: none;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s, color 0.1s;
  padding: 0;
}

.mini-day:hover {
  background: var(--bg-3);
  color: var(--text);
}

.mini-day.out-of-month {
  color: var(--text-3);
  opacity: 0.35;
}

.mini-day.in-week {
  background: var(--accent-dim);
  color: var(--text);
  border-radius: 2px;
}

/* Today overrides in-week if also in current week */
.mini-day.is-today {
  background: var(--accent) !important;
  color: #fff !important;
  border-radius: 50% !important;
  font-weight: 600;
}

/* ── Day summary ─────────────────────────────────── */
.day-summary {
  flex: 1;
}

.day-summary-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-2);
  text-transform: capitalize;
  margin-bottom: 10px;
}

.day-summary-empty {
  font-size: 12px;
  color: var(--text-3);
}

.day-summary-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.day-summary-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.day-summary-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
  margin-top: 4px;
}

.day-summary-name {
  font-size: 12px;
  color: var(--text);
  font-weight: 500;
  line-height: 1.3;
}

.day-summary-time {
  font-size: 11px;
  color: var(--text-3);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Calendar.css
git commit -m "feat(calendar): add week view styles and mini month widget"
```

---

## Task 7: Integration check

- [ ] **Step 1: Start the app**

```bash
cd /home/verso/dashboard && npm run start
```

Open **http://localhost:5173/calendar** in a browser.

- [ ] **Step 2: Check non-connected state**

Expected: connect card visible, sidebar absent (correct — `status !== false` guard is inverted, the sidebar only shows when connected or loading). Actually verify: with `status === false` the sidebar should NOT show.

- [ ] **Step 3: Navigate weeks without connecting**

Not applicable — the grid only renders when `status === true`. Confirm the connect card looks correct.

- [ ] **Step 4: (If Google Calendar is connected) Verify week view**

- Events appear as colored blocks in the correct time slot
- Today's column has a faint accent background and today-circle on the day number
- Red "now line" appears in today's column at the correct hour
- Navigating with `‹` / `›` changes the displayed week and refetches events
- Clicking a day in the mini month jumps to that week

- [ ] **Step 5: Verify mini month**

- Month name and year shown in French (capitalize check)
- Current week highlighted in `accent-dim` background
- Today's date has an accent circle
- `‹` / `›` buttons navigate months independently from the week view
- Clicking a day on a different month navigates the week view AND the mini month follows

- [ ] **Step 6: Commit final verification**

```bash
git add -A
git status  # should be clean (no untracked changes)
git log --oneline -5
```
