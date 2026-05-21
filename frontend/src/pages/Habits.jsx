import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import {
  format, subDays, eachDayOfInterval, getDay,
  startOfWeek, endOfWeek, isFuture, isToday, parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import './Habits.css';

// ── Constants ────────────────────────────────────────────────────────────────

const COLORS = ['#6366f1','#22c55e','#f59e0b','#ec4899','#14b8a6','#f97316','#8b5cf6'];

const TYPE_META = {
  binary:    { label: 'Binaire',   defaultTarget: 1,  defaultUnit: '' },
  frequency: { label: 'Fréquence', defaultTarget: 3,  defaultUnit: 'fois/sem' },
  duration:  { label: 'Durée',     defaultTarget: 20, defaultUnit: 'min' },
  quantity:  { label: 'Quantité',  defaultTarget: 10, defaultUnit: 'reps' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
}

function shortVal(value, unit) {
  const n = Number.isInteger(value) ? value : parseFloat(value.toFixed(1));
  if (unit === 'min') {
    if (value >= 60) {
      const h = Math.floor(value / 60);
      const m = Math.round(value % 60);
      return m ? `${h}h${m}` : `${h}h`;
    }
    return `${n}m`;
  }
  return String(n);
}

function wkBounds(date) {
  return {
    start: format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    end:   format(endOfWeek(date,   { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  };
}

// logs: [{ date, value }]
function calcStreak(logs, type, target) {
  if (!logs.length) return 0;
  const tgt = target ?? 1;
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  if (type === 'frequency') {
    let streak = 0;
    let wkStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    for (let i = 0; i < 104; i++) {
      const { start, end } = wkBounds(wkStart);
      const count = logs.filter(l => l.date >= start && l.date <= end).length;
      if (count >= tgt) { streak++; wkStart = subDays(wkStart, 7); }
      else break;
    }
    return streak;
  }

  if (type === 'binary') {
    const set = new Set(logs.map(l => l.date));
    if (!set.has(today) && !set.has(yesterday)) return 0;
    let streak = 0;
    let cur = set.has(today) ? new Date() : subDays(new Date(), 1);
    while (set.has(format(cur, 'yyyy-MM-dd'))) { streak++; cur = subDays(cur, 1); }
    return streak;
  }

  // duration / quantity: days where value >= target
  const dayVal = {};
  for (const { date, value } of logs) dayVal[date] = (dayVal[date] || 0) + value;
  const todayOk = (dayVal[today] || 0) >= tgt;
  const yesterdayOk = (dayVal[yesterday] || 0) >= tgt;
  if (!todayOk && !yesterdayOk) return 0;
  let streak = 0;
  let cur = todayOk ? new Date() : subDays(new Date(), 1);
  while ((dayVal[format(cur, 'yyyy-MM-dd')] || 0) >= tgt) { streak++; cur = subDays(cur, 1); }
  return streak;
}

function isDone(logs, type, target) {
  const tgt = target ?? 1;
  const today = format(new Date(), 'yyyy-MM-dd');
  if (type === 'binary') return logs.some(l => l.date === today);
  if (type === 'frequency') {
    const { start, end } = wkBounds(new Date());
    return logs.filter(l => l.date >= start && l.date <= end).length >= tgt;
  }
  const v = logs.filter(l => l.date === today).reduce((s, l) => s + l.value, 0);
  return v >= tgt;
}

function cellIntensity(dateStr, logs, type, target) {
  const tgt = target ?? 1;
  if (type === 'binary') return logs.some(l => l.date === dateStr) ? 1 : 0;
  if (type === 'frequency') {
    const { start, end } = wkBounds(parseISO(dateStr));
    const count = logs.filter(l => l.date >= start && l.date <= end).length;
    return Math.min(1, count / tgt);
  }
  const v = logs.filter(l => l.date === dateStr).reduce((s, l) => s + l.value, 0);
  return Math.min(1, v / tgt);
}

// ── HeatmapCalendar ──────────────────────────────────────────────────────────

function HeatmapCalendar({ logs, color, type, target }) {
  const today = new Date();
  const days = eachDayOfInterval({ start: subDays(today, 364), end: today });
  const padding = (getDay(days[0]) + 6) % 7;
  const allCells = [...Array(padding).fill(null), ...days];
  const weeks = [];
  for (let i = 0; i < allCells.length; i += 7) weeks.push(allCells.slice(i, i + 7));

  const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const monthLabels = [];
  let lastMonth = -1;
  weeks.forEach((wk, i) => {
    const first = wk.find(Boolean);
    if (first) {
      const m = first.getMonth();
      if (m !== lastMonth) { monthLabels.push({ i, label: MONTHS[m] }); lastMonth = m; }
    }
  });

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-body">
        <div className="heatmap-day-labels">
          {['L','','','J','','','D'].map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="heatmap-right">
          <div className="heatmap-months">
            {monthLabels.map(({ i, label }) => (
              <span key={i} style={{ gridColumnStart: i + 1 }}>{label}</span>
            ))}
          </div>
          <div className="heatmap-grid">
            {weeks.map((wk, wi) => (
              <div key={wi} className="heatmap-col">
                {wk.map((day, di) => {
                  if (!day) return <div key={di} className="heatmap-cell empty" />;
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const intensity = cellIntensity(dateStr, logs, type, target);
                  const todayCell = isToday(day);
                  return (
                    <div
                      key={di}
                      className={`heatmap-cell${todayCell ? ' today' : ''}`}
                      style={intensity > 0
                        ? { background: hexToRgba(color, 0.15 + intensity * 0.85) }
                        : undefined
                      }
                      title={format(day, 'd MMM yyyy', { locale: fr })}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── WeekView ─────────────────────────────────────────────────────────────────

function WeekView({ habit, logs, onLog }) {
  const [editingDay, setEditingDay] = useState(null);
  const [editVal, setEditVal] = useState('');
  const editRef = useRef(null);

  const type = habit.type || 'binary';
  const target = habit.target ?? 1;
  const today = format(new Date(), 'yyyy-MM-dd');
  const days = eachDayOfInterval({
    start: startOfWeek(new Date(), { weekStartsOn: 1 }),
    end:   endOfWeek(new Date(),   { weekStartsOn: 1 }),
  });
  const DAY_LETTERS = ['L','M','M','J','V','S','D'];

  const logMap = {};
  for (const l of logs) logMap[l.date] = l.value;

  const { start: wkStart, end: wkEnd } = wkBounds(new Date());
  const weekCount = logs.filter(l => l.date >= wkStart && l.date <= wkEnd).length;

  function openEdit(dateStr) {
    setEditingDay(dateStr);
    setEditVal(logMap[dateStr] ? String(logMap[dateStr]) : '');
    setTimeout(() => editRef.current?.focus(), 0);
  }

  function confirmEdit() {
    if (!editingDay) return;
    const v = parseFloat(editVal);
    if (!isNaN(v)) onLog(editingDay, v);
    setEditingDay(null);
    setEditVal('');
  }

  function handleCellClick(dateStr, future) {
    if (future) return;
    if (type === 'binary' || type === 'frequency') {
      onLog(dateStr, logMap[dateStr] ? 0 : 1);
    } else {
      openEdit(dateStr);
    }
  }

  return (
    <div className="week-view">
      <div className="week-row">
        {days.map((day, i) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const future = isFuture(day) && !isToday(day);
          const todayCell = isToday(day);
          const value = logMap[dateStr];
          const intensity = cellIntensity(dateStr, logs, type, target);
          const isEditing = editingDay === dateStr;

          return (
            <button
              key={dateStr}
              className={`week-cell${value ? ' checked' : ''}${todayCell ? ' today' : ''}${future ? ' future' : ''}${isEditing ? ' editing' : ''}`}
              style={intensity > 0
                ? { background: hexToRgba(habit.color, 0.18 + intensity * 0.82), borderColor: hexToRgba(habit.color, 0.5) }
                : undefined
              }
              disabled={future}
              onClick={() => handleCellClick(dateStr, future)}
              title={format(day, 'EEEE d MMM', { locale: fr })}
            >
              <span className="week-letter">{DAY_LETTERS[i]}</span>
              <span className="week-num">{format(day, 'd')}</span>
              {(type === 'duration' || type === 'quantity') && value > 0 && (
                <span className="week-val">{shortVal(value, habit.unit)}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Frequency weekly progress */}
      {type === 'frequency' && (
        <div className={`week-freq-summary${weekCount >= target ? ' done' : ''}`}>
          {weekCount}/{target} {habit.unit}
        </div>
      )}

      {/* Inline editor for duration / quantity */}
      {editingDay && (
        <div className="week-edit-row">
          <span className="week-edit-label">
            {format(parseISO(editingDay), 'EEE d MMM', { locale: fr })} :
          </span>
          <input
            ref={editRef}
            type="number"
            className="input week-edit-input"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') confirmEdit();
              if (e.key === 'Escape') { setEditingDay(null); setEditVal(''); }
            }}
            min="0"
            placeholder={String(target)}
          />
          <span className="week-edit-unit">{habit.unit}</span>
          <button className="btn btn-primary btn-sm" onClick={confirmEdit}>✓</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setEditingDay(null); setEditVal(''); }}>✕</button>
          {logMap[editingDay] > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => { onLog(editingDay, 0); setEditingDay(null); }}>
              Effacer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── CheckInControls ───────────────────────────────────────────────────────────

function CheckInControls({ habit, logs, onLog }) {
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef(null);
  const type = habit.type || 'binary';
  const target = habit.target ?? 1;
  const today = format(new Date(), 'yyyy-MM-dd');

  const todayLogs = logs.filter(l => l.date === today);
  const todayValue = todayLogs.reduce((s, l) => s + l.value, 0);
  const todayChecked = todayLogs.length > 0;
  const { start: wkStart, end: wkEnd } = wkBounds(new Date());
  const weekCount = logs.filter(l => l.date >= wkStart && l.date <= wkEnd).length;

  function save() {
    const v = parseFloat(inputVal);
    if (!isNaN(v) && v > 0) { onLog(today, v); setInputVal(''); }
  }

  if (type === 'binary') {
    return (
      <button
        className={`btn check-btn${todayChecked ? ' done' : ''}`}
        onClick={() => onLog(today, todayChecked ? 0 : 1)}
      >
        {todayChecked ? '✓ Fait' : 'Valider'}
      </button>
    );
  }

  if (type === 'frequency') {
    const weekDone = weekCount >= target;
    return (
      <div className="checkin-row">
        <span className={`week-progress${weekDone ? ' done' : ''}`}>
          {weekCount}/{target} {habit.unit}
        </span>
        <button
          className={`btn check-btn btn-sm${todayChecked ? ' done' : ''}`}
          onClick={() => onLog(today, todayChecked ? 0 : 1)}
        >
          {todayChecked ? '✓' : '+1'}
        </button>
      </div>
    );
  }

  // duration / quantity
  const dayDone = todayValue >= target;
  return (
    <div className="checkin-row">
      {dayDone
        ? <span className="done-chip">✓ {shortVal(todayValue, habit.unit)}</span>
        : todayValue > 0
          ? <span className="partial-chip">{shortVal(todayValue, habit.unit)}/{shortVal(target, habit.unit)}</span>
          : null
      }
      <input
        ref={inputRef}
        type="number"
        className="input measure-input"
        placeholder={String(target)}
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && save()}
        min="0"
      />
      <span className="measure-unit">{habit.unit}</span>
      <button className="btn btn-sm btn-primary" onClick={save}>✓</button>
      {todayValue > 0 && (
        <button className="btn btn-ghost btn-sm" onClick={() => onLog(today, 0)} title="Effacer">×</button>
      )}
    </div>
  );
}

// ── Shared habit form (add & edit) ───────────────────────────────────────────

function HabitForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);

  function setType(t) {
    const meta = TYPE_META[t];
    setForm(f => ({ ...f, type: t, target: meta.defaultTarget, unit: meta.defaultUnit }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await onSubmit(form);
  }

  const needsTarget = form.type !== 'binary';
  const needsUnit   = form.type === 'duration' || form.type === 'quantity';

  return (
    <form className="card add-habit-form" onSubmit={submit}>
      <input
        className="input"
        placeholder="Nom de l'habitude"
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        autoFocus
      />

      <div className="type-selector">
        {Object.entries(TYPE_META).map(([t, meta]) => (
          <button
            key={t} type="button"
            className={`type-btn${form.type === t ? ' active' : ''}`}
            onClick={() => setType(t)}
          >
            {meta.label}
          </button>
        ))}
      </div>

      {needsTarget && (
        <div className="form-row">
          <span className="form-label">Objectif</span>
          <input
            type="number"
            className="input target-input"
            value={form.target}
            min="1"
            onChange={e => setForm(f => ({ ...f, target: parseFloat(e.target.value) || 1 }))}
          />
          {needsUnit
            ? <input
                className="input unit-input"
                placeholder="unité (ex: min)"
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              />
            : <span className="unit-display">{TYPE_META[form.type].defaultUnit}</span>
          }
        </div>
      )}

      <div className="color-row">
        {COLORS.map(c => (
          <button
            type="button" key={c}
            className={`color-dot${form.color === c ? ' selected' : ''}`}
            style={{ background: c }}
            onClick={() => setForm(f => ({ ...f, color: c }))}
          />
        ))}
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" type="submit">{submitLabel}</button>
        <button className="btn btn-ghost" type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Habits() {
  const [habits, setHabits]     = useState([]);
  const [allLogs, setAllLogs]   = useState({});
  const [adding, setAdding]     = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [view, setView]         = useState('week');

  const load = useCallback(async () => {
    const [hs, rawLogs] = await Promise.all([
      api.get('/habits'),
      api.get('/habits/logs/all'),
    ]);
    setHabits(hs);
    const map = {};
    for (const h of hs) map[h.id] = [];
    for (const l of rawLogs) { if (map[l.habit_id]) map[l.habit_id].push({ date: l.date, value: l.value }); }
    setAllLogs(map);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addHabit(form) {
    await api.post('/habits', form);
    setAdding(false);
    load();
  }

  async function editHabit(id, form) {
    await api.patch(`/habits/${id}`, form);
    setEditingId(null);
    load();
  }

  async function log(habitId, date, value) {
    await api.post(`/habits/${habitId}/toggle`, { date, value });
    load();
  }

  async function deleteHabit(id) {
    await api.delete(`/habits/${id}`);
    load();
  }

  // Summary
  const doneCount = habits.filter(h => isDone(allLogs[h.id] || [], h.type || 'binary', h.target ?? 1)).length;
  const bestStreak = habits.reduce((best, h) => {
    const s = calcStreak(allLogs[h.id] || [], h.type || 'binary', h.target ?? 1);
    return s > best ? s : best;
  }, 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Habitudes</h1>
        <div className="habits-header-actions">
          <div className="view-toggle">
            <button className={`view-btn${view === 'week' ? ' active' : ''}`} onClick={() => setView('week')}>Semaine</button>
            <button className={`view-btn${view === 'year' ? ' active' : ''}`} onClick={() => setView('year')}>Année</button>
          </div>
          <button className="btn btn-primary" onClick={() => setAdding(a => !a)}>+ Ajouter</button>
        </div>
      </div>

      {habits.length > 0 && (
        <div className="habits-summary">
          <div className="summary-item">
            <span className="summary-val">{doneCount}/{habits.length}</span>
            <span className="summary-lbl">aujourd'hui</span>
          </div>
          {bestStreak > 0 && (
            <>
              <div className="summary-sep" />
              <div className="summary-item">
                <span className="summary-val">🔥 {bestStreak}{habits.find(h => (h.type || 'binary') === 'frequency') ? 'sem' : 'j'}</span>
                <span className="summary-lbl">meilleur streak</span>
              </div>
            </>
          )}
        </div>
      )}

      {adding && (
        <HabitForm
          initial={{ name: '', color: COLORS[0], type: 'binary', target: 1, unit: '' }}
          submitLabel="Créer"
          onSubmit={addHabit}
          onCancel={() => setAdding(false)}
        />
      )}

      {habits.length === 0 && !adding && (
        <div className="empty-state">Aucune habitude. Commence par en ajouter une.</div>
      )}

      <div className="habits-list">
        {habits.map(h => {
          const logs = allLogs[h.id] || [];
          const type = h.type || 'binary';
          const target = h.target ?? 1;
          const streak = calcStreak(logs, type, target);
          const done = isDone(logs, type, target);

          if (editingId === h.id) {
            return (
              <HabitForm
                key={h.id}
                initial={{ name: h.name, color: h.color, type: h.type || 'binary', target: h.target ?? 1, unit: h.unit || '' }}
                submitLabel="Sauvegarder"
                onSubmit={form => editHabit(h.id, form)}
                onCancel={() => setEditingId(null)}
              />
            );
          }

          return (
            <div key={h.id} className={`card habit-card${done ? ' done-today' : ''}`}>
              <div className="habit-header">
                <div className="habit-title-row">
                  <span className="habit-dot" style={{ background: h.color }} />
                  <span className="habit-name">{h.name}</span>
                  {streak > 0 && (
                    <span className="streak-badge">
                      🔥 {streak}{type === 'frequency' ? 'sem' : 'j'}
                    </span>
                  )}
                  {done && <span className="done-badge">✓ fait</span>}
                </div>
                <div className="habit-actions">
                  <CheckInControls
                    habit={h}
                    logs={logs}
                    onLog={(date, value) => log(h.id, date, value)}
                  />
                  <button
                    className="btn btn-ghost"
                    onClick={() => setEditingId(h.id)}
                    title="Modifier l'habitude"
                  >✎</button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => deleteHabit(h.id)}
                    title="Supprimer l'habitude"
                  >✕</button>
                </div>
              </div>

              {view === 'week'
                ? <WeekView
                    habit={h}
                    logs={logs}
                    onLog={(date, value) => log(h.id, date, value)}
                  />
                : <HeatmapCalendar logs={logs} color={h.color} type={type} target={target} />
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}
