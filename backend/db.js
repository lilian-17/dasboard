const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'dashboard.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    created_at TEXT DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS habit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    UNIQUE(habit_id, date)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL UNIQUE,
    monthly_limit REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
    due_date TEXT,
    done INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS google_tokens (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    access_token TEXT,
    refresh_token TEXT,
    expiry_date INTEGER
  );

  CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT,
    tag TEXT DEFAULT 'general',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrations (safe to re-run — ALTER TABLE fails silently if column exists)
for (const sql of [
  "ALTER TABLE habits ADD COLUMN type TEXT DEFAULT 'binary'",
  "ALTER TABLE habits ADD COLUMN target REAL DEFAULT 1",
  "ALTER TABLE habits ADD COLUMN unit TEXT DEFAULT ''",
  "ALTER TABLE habit_logs ADD COLUMN value REAL DEFAULT 1",
]) {
  try { db.exec(sql); } catch {}
}

module.exports = db;
