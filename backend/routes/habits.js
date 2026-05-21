const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM habits ORDER BY created_at').all());
});

router.post('/', (req, res) => {
  const { name, color, type, target, unit } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const result = db.prepare(
    'INSERT INTO habits (name, color, type, target, unit) VALUES (?, ?, ?, ?, ?)'
  ).run(name, color || '#6366f1', type || 'binary', target ?? 1, unit || '');
  res.json(db.prepare('SELECT * FROM habits WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/:id', (req, res) => {
  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(req.params.id);
  if (!habit) return res.status(404).json({ error: 'not found' });
  const { name, color, type, target, unit } = req.body;
  db.prepare('UPDATE habits SET name = ?, color = ?, type = ?, target = ?, unit = ? WHERE id = ?').run(
    name  ?? habit.name,
    color ?? habit.color,
    type  ?? habit.type,
    target !== undefined ? target : habit.target,
    unit  !== undefined ? unit  : habit.unit,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM habits WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM habits WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Logs for one habit (last 365 days) — returns { date, value }
router.get('/:id/logs', (req, res) => {
  const logs = db.prepare(
    "SELECT date, value FROM habit_logs WHERE habit_id = ? AND date >= date('now', '-365 days') ORDER BY date"
  ).all(req.params.id);
  res.json(logs);
});

// Toggle / log for a given date
// binary & frequency : toggle (no value needed)
// duration & quantity: upsert with explicit value; value=0 deletes
router.post('/:id/toggle', (req, res) => {
  const { date, value } = req.body;
  const d = date || new Date().toISOString().split('T')[0];
  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(req.params.id);
  if (!habit) return res.status(404).json({ error: 'not found' });

  const existing = db.prepare(
    'SELECT id, value FROM habit_logs WHERE habit_id = ? AND date = ?'
  ).get(req.params.id, d);

  const type = habit.type || 'binary';

  if (type === 'binary' || type === 'frequency') {
    if (existing) {
      db.prepare('DELETE FROM habit_logs WHERE habit_id = ? AND date = ?').run(req.params.id, d);
      return res.json({ value: 0 });
    }
    db.prepare('INSERT INTO habit_logs (habit_id, date, value) VALUES (?, ?, 1)').run(req.params.id, d);
    return res.json({ value: 1 });
  }

  // duration / quantity
  const v = value ?? habit.target ?? 1;
  if (v <= 0) {
    if (existing) db.prepare('DELETE FROM habit_logs WHERE habit_id = ? AND date = ?').run(req.params.id, d);
    return res.json({ value: 0 });
  }
  if (existing) {
    db.prepare('UPDATE habit_logs SET value = ? WHERE habit_id = ? AND date = ?').run(v, req.params.id, d);
  } else {
    db.prepare('INSERT INTO habit_logs (habit_id, date, value) VALUES (?, ?, ?)').run(req.params.id, d, v);
  }
  return res.json({ value: v });
});

// All logs (last 365 days) for all habits — returns { habit_id, date, value }
router.get('/logs/all', (req, res) => {
  const logs = db.prepare(
    "SELECT habit_id, date, value FROM habit_logs WHERE date >= date('now', '-365 days') ORDER BY date"
  ).all();
  res.json(logs);
});

module.exports = router;
