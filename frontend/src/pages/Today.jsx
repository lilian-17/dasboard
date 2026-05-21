import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { format, parseISO, isPast, isToday, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import './Today.css';

function formatTime(event) {
  const start = event.start?.dateTime;
  const end = event.end?.dateTime;
  if (!start) return 'Toute la journée';
  const s = format(parseISO(start), 'H:mm');
  const e = end ? format(parseISO(end), 'H:mm') : null;
  return e ? `${s} – ${e}` : s;
}

function isEventToday(event) {
  const d = event.start?.dateTime || event.start?.date;
  if (!d) return false;
  const date = d.includes('T') ? parseISO(d) : parseISO(d + 'T00:00:00');
  return isToday(date);
}

function isCurrentOrFuture(event) {
  const end = event.end?.dateTime;
  if (!end) return true;
  return new Date(end) > new Date();
}

function PhotoWidget() {
  const [photos, setPhotos] = useState([]);
  const [index, setIndex] = useState(0);
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const intervalRef = useRef(null);
  const errorTimerRef = useRef(null);

  const loadPhotos = useCallback(async () => {
    try {
      const res = await fetch('/api/photos');
      const data = await res.json();
      setPhotos(data);
    } catch {
      setError('Impossible de charger les photos');
    }
  }, []);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (photos.length > 1) {
      intervalRef.current = setInterval(() => {
        setIndex(i => (i + 1) % photos.length);
      }, 120000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [photos]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  useEffect(() => () => { if (errorTimerRef.current) clearTimeout(errorTimerRef.current); }, []);

  function showError(msg) {
    setError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(null), 2000);
  }

  function handleContextMenu(e) {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }

  async function handleAdd(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setMenu(null);
    let failed = 0;
    for (const file of files) {
      const form = new FormData();
      form.append('photo', file);
      try {
        const res = await fetch('/api/photos', { method: 'POST', body: form });
        if (!res.ok) failed++;
      } catch {
        failed++;
      }
    }
    await loadPhotos();
    setIndex(0);
    if (failed > 0) showError(`${failed} photo(s) n'ont pas pu être uploadées`);
    e.target.value = '';
  }

  async function handleDelete() {
    if (!photos[index]) return;
    setMenu(null);
    const id = photos[index].id;
    try {
      const res = await fetch(`/api/photos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await loadPhotos();
      setIndex(i => Math.max(0, i - 1));
    } catch {
      showError('Erreur lors de la suppression');
    }
  }

  const current = photos[index];

  return (
    <div className="photo-widget" onContextMenu={handleContextMenu}>
      {photos.length === 0 ? (
        <div className="photo-widget-empty">
          <span className="photo-widget-icon">🖼</span>
          <span className="photo-widget-hint">Clic droit pour ajouter</span>
        </div>
      ) : (
        <div className="photo-widget-frame">
          {current && (
            <img
              key={current.id}
              src={current.url}
              alt=""
              className="photo-widget-img"
            />
          )}
          {photos.length > 1 && (
            <span className="photo-widget-counter">{index + 1} / {photos.length}</span>
          )}
          {error && <div className="photo-widget-error">{error}</div>}
        </div>
      )}

      {menu && (
        <div
          className="photo-ctx-menu"
          style={{ position: 'fixed', top: menu.y, left: menu.x }}
          onMouseDown={e => e.stopPropagation()}
        >
          <button
            className="photo-ctx-item"
            onClick={() => { setMenu(null); fileInputRef.current.click(); }}
          >
            + Ajouter une photo
          </button>
          <button
            className="photo-ctx-item photo-ctx-delete"
            onClick={handleDelete}
            disabled={photos.length === 0}
          >
            x Supprimer cette photo
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleAdd}
      />
    </div>
  );
}

export default function Today() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const dateLabel = format(new Date(), "EEEE d MMMM", { locale: fr });

  const [todos, setTodos] = useState([]);
  const [habits, setHabits] = useState([]);
  const [habitLogs, setHabitLogs] = useState({});
  const [events, setEvents] = useState([]);
  const [calStatus, setCalStatus] = useState(null);
  const [calError, setCalError] = useState(null);

  const load = useCallback(async () => {
    const [todoData, habitData, allLogs] = await Promise.all([
      api.get('/todos'),
      api.get('/habits'),
      api.get('/habits/logs/all'),
    ]);
    setTodos(todoData);
    setHabits(habitData);
    const map = {};
    for (const h of habitData) map[h.id] = [];
    for (const l of allLogs) {
      if (map[l.habit_id]) map[l.habit_id].push(l.date);
    }
    setHabitLogs(map);
  }, []);

  const loadCal = useCallback(async () => {
    try {
      const status = await api.get('/calendar/status');
      setCalStatus(status.connected);
      if (status.connected) {
        const data = await api.get('/calendar/events');
        setEvents(data.filter(ev => isEventToday(ev) && isCurrentOrFuture(ev)));
      }
    } catch (e) {
      setCalError(e.message);
    }
  }, []);

  useEffect(() => { load(); loadCal(); }, [load, loadCal]);

  async function toggleTodo(todo) {
    await api.patch(`/todos/${todo.id}`, { done: !todo.done });
    load();
  }

  async function toggleHabit(habitId) {
    await api.post(`/habits/${habitId}/toggle`, { date: today });
    load();
  }

  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

  // Tasks: not done + (due today or overdue or no due date)
  const todayTasks = todos
    .filter(t => !t.done)
    .sort((a, b) => {
      // Due today first, then overdue, then no due date
      const aToday = a.due_date === today;
      const bToday = b.due_date === today;
      const aOverdue = a.due_date && a.due_date < today;
      const bOverdue = b.due_date && b.due_date < today;
      const aPrio = PRIORITY_ORDER[a.priority] ?? 1;
      const bPrio = PRIORITY_ORDER[b.priority] ?? 1;

      if (aToday !== bToday) return bToday - aToday;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;
      return aPrio - bPrio;
    });

  // Habits not done today
  const pendingHabits = habits.filter(h => !(habitLogs[h.id] || []).includes(today));
  const doneHabits = habits.filter(h => (habitLogs[h.id] || []).includes(today));

  const todayEvents = [...events].sort((a, b) => {
    const aTime = a.start?.dateTime || a.start?.date || '';
    const bTime = b.start?.dateTime || b.start?.date || '';
    return aTime.localeCompare(bTime);
  });

const SHORTCUTS = [
  {
    label: 'YouTube',
    url: 'https://www.youtube.com',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
    color: '#ff0000',
  },
  {
    label: 'GitHub',
    url: 'https://github.com/lilian-17/',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
      </svg>
    ),
    color: '#e6e6e6',
  },
  {
    label: 'Instagram',
    url: 'https://www.instagram.com',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
    color: '#e1306c',
  },
  {
    label: 'Claude',
    url: 'https://claude.ai',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-1.385-.121-.352-.462.097-.534.293-.17 1.336.024 2.254.097 2.801.097.936.049h.655l.032-.05-.032-.12-1.09-1.03-2.442-2.388-1.774-1.8-.766-.802-.121-.729.437-.39.681.073.961.923 1.908 1.945 2.23 2.327.875.972.365.414h.097l.049-.146V11.2l-.098-1.945-.048-2.157-.024-1.848.121-1.117.146-.389.534-.146.485.196.268.802.024 1.19-.097 1.703-.195 2.802-.121 1.287v.607l.072.049.122-.049.947-1.433 1.506-2.061 1.36-1.678 1.02-1.148.729-.656.632.073.413.559-.17.632-.632.802-1.336 1.702-1.459 2.145-1.142 1.847-.413.68.073.049.729-.122.948-.56h.8l1.02.073 1.994.17 1.655.097.85.195.34.462-.073.559-.729.268-2.23-.268-1.555-.122-1.288-.072h-.558l-.05.097.465.559 1.045 1.094 1.604 1.775 1.069 1.312.389.729-.194.584-.584.122-.754-.414-2.012-2.17-1.24-1.457-1.068-1.337-.146-.049-.5.025-.049.123-.024 2.413.024 1.945-.121 1.8-.268.851-.523.244-.462-.17-.389-.68.025-1.337.17-3.094.049-2.127v-.706l-.073-.049-.097.049-.996 1.434-2.06 2.875-1.264 1.604-.413.486-.656.122-.413-.317.072-.754z"/>
      </svg>
    ),
    color: '#d97706',
  },
];

  return (
    <div className="today-layout">
      <div className="today-page">
      <div className="today-header">
        <div>
          <h1 className="page-title">Aujourd'hui</h1>
          <p className="today-date">{dateLabel}</p>
        </div>
        <div className="today-stats">
          <div className="stat-pill">
            <span className="stat-num">{todayTasks.length}</span>
            <span className="stat-label">tâches</span>
          </div>
          <div className="stat-pill">
            <span className="stat-num">{pendingHabits.length}</span>
            <span className="stat-label">habitudes</span>
          </div>
          <div className="stat-pill">
            <span className="stat-num">{todayEvents.length}</span>
            <span className="stat-label">événements</span>
          </div>
        </div>
      </div>

      <div className="today-grid">
        {/* Tasks */}
        <section className="today-section card">
          <div className="section-head">
            <span className="section-icon">◻</span>
            <h2 className="section-title">Tâches</h2>
            {todayTasks.length > 0 && <span className="section-count">{todayTasks.length}</span>}
          </div>

          {todayTasks.length === 0 ? (
            <div className="section-empty">Toutes les tâches sont terminées ✓</div>
          ) : (
            <ul className="today-list">
              {todayTasks.map(todo => {
                const overdue = todo.due_date && todo.due_date < today;
                const dueToday = todo.due_date === today;
                return (
                  <li key={todo.id} className="today-task-row">
                    <button
                      className="today-check"
                      onClick={() => toggleTodo(todo)}
                      aria-label="Marquer comme fait"
                    />
                    <div className="task-info">
                      <span className="task-name">{todo.title}</span>
                      <div className="task-meta">
                        <span className={`prio-dot prio-${todo.priority}`} />
                        {overdue && <span className="due-tag overdue">En retard</span>}
                        {dueToday && !overdue && <span className="due-tag due">Aujourd'hui</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Habits */}
        <section className="today-section card">
          <div className="section-head">
            <span className="section-icon">◎</span>
            <h2 className="section-title">Habitudes</h2>
            {habits.length > 0 && (
              <span className="section-count">{doneHabits.length}/{habits.length}</span>
            )}
          </div>

          {habits.length === 0 ? (
            <div className="section-empty">Aucune habitude configurée</div>
          ) : (
            <ul className="today-list">
              {pendingHabits.map(h => (
                <li key={h.id} className="today-habit-row pending">
                  <button
                    className="today-check"
                    onClick={() => toggleHabit(h.id)}
                    aria-label="Valider l'habitude"
                  />
                  <span className="habit-dot" style={{ background: h.color }} />
                  <span className="habit-name">{h.name}</span>
                </li>
              ))}
              {doneHabits.map(h => (
                <li key={h.id} className="today-habit-row done">
                  <button
                    className="today-check checked"
                    onClick={() => toggleHabit(h.id)}
                    aria-label="Décocher l'habitude"
                  >✓</button>
                  <span className="habit-dot" style={{ background: h.color, opacity: 0.4 }} />
                  <span className="habit-name faded">{h.name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Calendar */}
        <section className="today-section card cal-section">
          <div className="section-head">
            <span className="section-icon">◷</span>
            <h2 className="section-title">Agenda</h2>
          </div>

          {calStatus === false && (
            <div className="section-empty">
              Calendrier non connecté —{' '}
              <a href="/calendar" className="link">connecter</a>
            </div>
          )}
          {calStatus === null && !calError && (
            <div className="section-empty">Chargement…</div>
          )}
          {calError && (
            <div className="section-empty" style={{ color: 'var(--red)' }}>Erreur agenda</div>
          )}
          {calStatus === true && todayEvents.length === 0 && (
            <div className="section-empty">Aucun événement aujourd'hui</div>
          )}
          {calStatus === true && todayEvents.length > 0 && (
            <ul className="today-list">
              {todayEvents.map(ev => (
                <li key={ev.id} className="today-event-row">
                  <div className="event-time-col">{formatTime(ev)}</div>
                  <div className="event-bar-mini" />
                  <div className="event-info">
                    <span className="event-name">{ev.summary || '(Sans titre)'}</span>
                    {ev.location && <span className="event-loc">📍 {ev.location}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      </div>

      {/* Shortcuts sidebar */}
      <aside className="shortcuts-panel">
        <p className="shortcuts-title">Raccourcis</p>
        <div className="shortcuts-list">
          {SHORTCUTS.map(({ label, url, icon, color }) => (
            <a
              key={label}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="shortcut-item"
            >
              <span className="shortcut-icon" style={{ color }}>{icon}</span>
              <span className="shortcut-label">{label}</span>
            </a>
          ))}
        </div>
        <PhotoWidget />
      </aside>
    </div>
  );
}
