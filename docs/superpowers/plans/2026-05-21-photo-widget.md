# Photo Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un widget de photos sous les raccourcis dans la sidebar de la page d'accueil — diaporama automatique toutes les 2 min, ajout/suppression via menu clic-droit.

**Architecture:** Photos stockées sur disque dans `backend/data/photos/`, métadonnées dans SQLite. Backend Express + multer pour l'upload. Composant React `PhotoWidget` monté dans la sidebar de `Today.jsx`.

**Tech Stack:** Express, multer, better-sqlite3, React (hooks), CSS animations

---

## File Map

| Fichier | Action |
|---|---|
| `backend/routes/photos.js` | Cree - 4 routes CRUD |
| `backend/db.js` | Modifie - ajout table `photos` |
| `backend/server.js` | Modifie - montage route `/api/photos` |
| `frontend/src/pages/Today.jsx` | Modifie - ajout composant `PhotoWidget` |
| `frontend/src/pages/Today.css` | Modifie - styles du widget |

---

## Task 1: DB table + installer multer

**Files:**
- Modify: `backend/db.js`
- Modify: `backend/package.json` (via npm install)

- [ ] **Step 1: Installer multer**

```bash
cd /home/verso/dashboard/backend && npm install multer
```

Expected output: `added 1 package` (ou similaire, pas d'erreur)

- [ ] **Step 2: Ajouter la table `photos` dans `backend/db.js`**

Dans `db.js`, ajouter a la fin du bloc `db.exec(...)`, juste avant le backtick fermant (apres la table `ideas`) :

```js
  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
```

Le bloc `db.exec` doit finir ainsi :

```js
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
```

- [ ] **Step 3: Verifier que la DB se cree sans erreur**

```bash
cd /home/verso/dashboard/backend && node -e "require('./db'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd /home/verso/dashboard && git add backend/db.js backend/package.json backend/package-lock.json
git commit -m "feat(photos): add photos table and install multer"
```

---

## Task 2: Routes backend `/api/photos`

**Files:**
- Create: `backend/routes/photos.js`
- Modify: `backend/server.js`

- [ ] **Step 1: Creer `backend/routes/photos.js`**

```js
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

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
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
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  res.json({ ok: true });
});

module.exports = router;
```

- [ ] **Step 2: Monter la route dans `backend/server.js`**

Ajouter cette ligne apres les autres `app.use('/api/...')`, avant `app.get('/api/health', ...)` :

```js
app.use('/api/photos', require('./routes/photos'));
```

- [ ] **Step 3: Redemarrer le backend**

Tuer le processus existant sur le port 3001 puis relancer :

```bash
kill $(lsof -ti:3001) 2>/dev/null; cd /home/verso/dashboard/backend && node server.js &
sleep 1
```

- [ ] **Step 4: Tester `GET /api/photos` (liste vide)**

```bash
curl -s http://localhost:3001/api/photos
```

Expected: `[]`

- [ ] **Step 5: Tester `POST /api/photos` (upload)**

```bash
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82' > /tmp/test.png

curl -s -X POST http://localhost:3001/api/photos \
  -F "photo=@/tmp/test.png;type=image/png"
```

Expected: `{"id":1,"url":"/api/photos/files/TIMESTAMP-RANDOM.png"}`

- [ ] **Step 6: Tester `GET /api/photos` apres upload**

```bash
curl -s http://localhost:3001/api/photos
```

Expected: `[{"id":1,"url":"/api/photos/files/..."}]`

- [ ] **Step 7: Tester `DELETE /api/photos/1`**

```bash
curl -s -X DELETE http://localhost:3001/api/photos/1
```

Expected: `{"ok":true}`

```bash
curl -s http://localhost:3001/api/photos
```

Expected: `[]`

- [ ] **Step 8: Commit**

```bash
cd /home/verso/dashboard && git add backend/routes/photos.js backend/server.js
git commit -m "feat(photos): add photos API routes (list, upload, delete, serve)"
```

---

## Task 3: Composant `PhotoWidget` + styles

**Files:**
- Modify: `frontend/src/pages/Today.jsx`
- Modify: `frontend/src/pages/Today.css`

- [ ] **Step 1: Ajouter le composant `PhotoWidget` dans `Today.jsx`**

Ajouter ce composant juste avant la ligne `export default function Today()` :

```jsx
function PhotoWidget() {
  const [photos, setPhotos] = useState([]);
  const [index, setIndex] = useState(0);
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const intervalRef = useRef(null);

  const loadPhotos = useCallback(async () => {
    try {
      const res = await fetch('/api/photos');
      const data = await res.json();
      setPhotos(data);
    } catch {}
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

  function handleContextMenu(e) {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }

  async function handleAdd(e) {
    const file = e.target.files[0];
    if (!file) return;
    setMenu(null);
    const form = new FormData();
    form.append('photo', file);
    try {
      const res = await fetch('/api/photos', { method: 'POST', body: form });
      if (!res.ok) throw new Error();
      await loadPhotos();
      setIndex(0);
    } catch {
      setError("Erreur lors de l'upload");
      setTimeout(() => setError(null), 2000);
    }
    e.target.value = '';
  }

  async function handleDelete() {
    if (!photos[index]) return;
    setMenu(null);
    const id = photos[index].id;
    try {
      await fetch(`/api/photos/${id}`, { method: 'DELETE' });
      await loadPhotos();
      setIndex(i => Math.max(0, i - 1));
    } catch {
      setError('Erreur lors de la suppression');
      setTimeout(() => setError(null), 2000);
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
        style={{ display: 'none' }}
        onChange={handleAdd}
      />
    </div>
  );
}
```

- [ ] **Step 2: Monter `PhotoWidget` dans la sidebar**

Trouver `</div>` qui ferme `.shortcuts-list` dans `Today.jsx` et ajouter `<PhotoWidget />` juste apres, avant `</aside>` :

```jsx
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
```

- [ ] **Step 3: Ajouter les styles dans `Today.css`**

Ajouter a la fin de `frontend/src/pages/Today.css` :

```css
/* Photo Widget */
.photo-widget {
  margin-top: 16px;
  position: relative;
}

.photo-widget-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  aspect-ratio: 4/3;
  background: var(--bg-1);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  gap: 6px;
  cursor: context-menu;
}

.photo-widget-icon {
  font-size: 20px;
  opacity: 0.3;
}

.photo-widget-hint {
  font-size: 10px;
  color: var(--text-3);
  text-align: center;
}

.photo-widget-frame {
  position: relative;
  aspect-ratio: 4/3;
  border-radius: var(--radius);
  overflow: hidden;
  cursor: context-menu;
  background: var(--bg-1);
}

.photo-widget-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: photo-fade-in 0.6s ease;
}

@keyframes photo-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.photo-widget-counter {
  position: absolute;
  bottom: 6px;
  right: 8px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(0, 0, 0, 0.3);
  padding: 1px 5px;
  border-radius: 10px;
}

.photo-widget-error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  color: var(--red);
  font-size: 11px;
  text-align: center;
  padding: 8px;
}

.photo-ctx-menu {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  min-width: 160px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  overflow: hidden;
}

.photo-ctx-item {
  display: block;
  width: 100%;
  padding: 9px 14px;
  font-size: 12px;
  color: var(--text-1);
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
}

.photo-ctx-item:hover:not(:disabled) {
  background: var(--bg-3);
}

.photo-ctx-item + .photo-ctx-item {
  border-top: 1px solid var(--border);
}

.photo-ctx-delete {
  color: var(--red);
}

.photo-ctx-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 4: Verifier dans le navigateur**

Ouvrir http://localhost:5173, aller sur la page d'accueil :
- La sidebar affiche le widget vide avec l'icone et le texte "Clic droit pour ajouter"
- Clic droit sur le widget -> menu avec "Ajouter une photo" et "Supprimer cette photo" (grise)
- Clic ailleurs -> menu se ferme

- [ ] **Step 5: Tester l'ajout et la suppression**

- Clic droit -> "Ajouter une photo" -> selectionner une image
- La photo s'affiche avec un fade-in
- Clic droit -> "Supprimer cette photo" -> retour a l'etat vide

- [ ] **Step 6: Commit final**

```bash
cd /home/verso/dashboard && git add frontend/src/pages/Today.jsx frontend/src/pages/Today.css
git commit -m "feat(photos): add PhotoWidget with slideshow and context menu"
```
