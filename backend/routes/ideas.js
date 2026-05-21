const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM ideas ORDER BY created_at DESC').all());
});

router.post('/', (req, res) => {
  const { title, body, tag } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const result = db.prepare(
    'INSERT INTO ideas (title, body, tag) VALUES (?, ?, ?)'
  ).run(title, body || null, tag || 'general');
  res.json(db.prepare('SELECT * FROM ideas WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/:id', (req, res) => {
  const { title, body, tag } = req.body;
  const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.id);
  if (!idea) return res.status(404).json({ error: 'not found' });
  db.prepare('UPDATE ideas SET title = ?, body = ?, tag = ? WHERE id = ?').run(
    title ?? idea.title,
    body !== undefined ? body : idea.body,
    tag ?? idea.tag,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM ideas WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
