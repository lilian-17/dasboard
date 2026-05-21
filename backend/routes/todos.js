const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const todos = db.prepare('SELECT * FROM todos ORDER BY done ASC, priority DESC, due_date ASC NULLS LAST, created_at DESC').all();
  res.json(todos);
});

router.post('/', (req, res) => {
  const { title, priority, due_date } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const result = db.prepare(
    'INSERT INTO todos (title, priority, due_date) VALUES (?, ?, ?)'
  ).run(title, priority || 'medium', due_date || null);
  res.json(db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/:id', (req, res) => {
  const { title, priority, due_date, done } = req.body;
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  if (!todo) return res.status(404).json({ error: 'not found' });
  db.prepare('UPDATE todos SET title = ?, priority = ?, due_date = ?, done = ? WHERE id = ?').run(
    title ?? todo.title,
    priority ?? todo.priority,
    due_date !== undefined ? due_date : todo.due_date,
    done !== undefined ? (done ? 1 : 0) : todo.done,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM todos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
