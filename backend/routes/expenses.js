const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const { month } = req.query; // YYYY-MM
  let rows;
  if (month) {
    rows = db.prepare(
      "SELECT * FROM expenses WHERE strftime('%Y-%m', date) = ? ORDER BY date DESC"
    ).all(month);
  } else {
    rows = db.prepare('SELECT * FROM expenses ORDER BY date DESC LIMIT 200').all();
  }
  res.json(rows);
});

router.post('/', (req, res) => {
  const { amount, category, description, date } = req.body;
  if (!amount || !category || !date) return res.status(400).json({ error: 'amount, category, date required' });
  const result = db.prepare(
    'INSERT INTO expenses (amount, category, description, date) VALUES (?, ?, ?, ?)'
  ).run(amount, category, description || '', date);
  res.json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Monthly summary grouped by category
router.get('/summary/:month', (req, res) => {
  const rows = db.prepare(
    "SELECT category, SUM(amount) as total FROM expenses WHERE strftime('%Y-%m', date) = ? GROUP BY category"
  ).all(req.params.month);
  res.json(rows);
});

// Budgets
router.get('/budgets', (req, res) => res.json(db.prepare('SELECT * FROM budgets').all()));

router.post('/budgets', (req, res) => {
  const { category, monthly_limit } = req.body;
  if (!category || !monthly_limit) return res.status(400).json({ error: 'category and monthly_limit required' });
  db.prepare('INSERT INTO budgets (category, monthly_limit) VALUES (?, ?) ON CONFLICT(category) DO UPDATE SET monthly_limit = excluded.monthly_limit').run(category, monthly_limit);
  res.json(db.prepare('SELECT * FROM budgets WHERE category = ?').get(category));
});

router.delete('/budgets/:category', (req, res) => {
  db.prepare('DELETE FROM budgets WHERE category = ?').run(req.params.category);
  res.json({ ok: true });
});

module.exports = router;
