const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const router = express.Router();

const PHOTOS_DIR = path.join(__dirname, '../data/photos');
if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PHOTOS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif']);

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype.startsWith('image/') && ALLOWED_EXTS.has(ext)) cb(null, true);
    else cb(new Error('Images uniquement'));
  },
});

router.get('/files/:filename', (req, res) => {
  const filepath = path.join(PHOTOS_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(filepath)) return res.status(404).end();
  res.sendFile(filepath);
});

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT id, filename FROM photos ORDER BY created_at DESC').all();
  res.json(rows.map(r => ({ id: r.id, url: `/api/photos/files/${r.filename}` })));
});

router.post('/', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });
  const { lastInsertRowid } = db
    .prepare('INSERT INTO photos (filename) VALUES (?)')
    .run(req.file.filename);
  res.json({ id: lastInsertRowid, url: `/api/photos/files/${req.file.filename}` });
});

router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT filename FROM photos WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM photos WHERE id = ?').run(req.params.id);
  const filepath = path.join(PHOTOS_DIR, row.filename);
  try { fs.unlinkSync(filepath); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  res.json({ ok: true });
});

router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large' });
  res.status(400).json({ error: err.message });
});

module.exports = router;
