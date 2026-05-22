# Spotify Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un widget "lecture en cours" Spotify en lecture seule sous le PhotoWidget dans le panneau raccourcis de la page Aujourd'hui.

**Architecture:** Backend OAuth2 (même patron que Google Calendar) — nouvelle route `backend/routes/spotify.js`, tokens stockés dans une table SQLite `spotify_tokens`, endpoint `/api/spotify/current` appelé par le frontend toutes les 5 secondes.

**Tech Stack:** Node.js/Express (backend), React (frontend), Spotify Web API, SQLite via better-sqlite3, `fetch` natif Node 18+

---

## Fichiers touchés

| Fichier | Action |
|---|---|
| `backend/db.js` | Modifier — ajouter la table `spotify_tokens` |
| `backend/routes/spotify.js` | Créer — 5 routes OAuth + current |
| `backend/server.js` | Modifier — enregistrer la route `/api/spotify` |
| `backend/.env` | Modifier — ajouter les credentials Spotify |
| `frontend/src/pages/Today.jsx` | Modifier — ajouter le composant `SpotifyWidget` |
| `frontend/src/pages/Today.css` | Modifier — styles du widget |
| `frontend/src/pages/Settings.jsx` | Modifier — section Spotify (connexion/déconnexion) |
| `frontend/src/pages/Settings.css` | Modifier — styles boutons Spotify |

---

## Prérequis utilisateur (à faire avant de commencer)

1. Aller sur [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) et créer une app (nom libre)
2. Dans les settings de l'app Spotify, ajouter `http://localhost:3001/api/spotify/callback` dans **Redirect URIs**
3. Copier le **Client ID** et le **Client Secret**

---

## Task 1 — DB : table spotify_tokens

**Files:**
- Modify: `backend/db.js`

- [ ] **Ajouter la table dans le bloc `db.exec`**

Dans `backend/db.js`, à l'intérieur du bloc `db.exec(`` ` ``...`` ` ``)`, après la table `photos` (ligne ~70), ajouter :

```sql
  CREATE TABLE IF NOT EXISTS spotify_tokens (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    access_token TEXT,
    refresh_token TEXT,
    expiry_date INTEGER
  );
```

- [ ] **Vérifier que le serveur démarre sans erreur**

```bash
cd backend && node server.js
# Attendu : "Backend running on http://localhost:3001"
# Ctrl+C pour arrêter
```

- [ ] **Commit**

```bash
git add backend/db.js
git commit -m "feat(db): add spotify_tokens table"
```

---

## Task 2 — Variables d'environnement Spotify

**Files:**
- Modify: `backend/.env`

- [ ] **Ajouter dans `backend/.env`**

```
SPOTIFY_CLIENT_ID=<ton client id>
SPOTIFY_CLIENT_SECRET=<ton client secret>
SPOTIFY_REDIRECT_URI=http://localhost:3001/api/spotify/callback
```

*(Pas de commit — ce fichier n'est pas tracké par git)*

---

## Task 3 — Backend : créer `backend/routes/spotify.js`

**Files:**
- Create: `backend/routes/spotify.js`

- [ ] **Créer le fichier**

```javascript
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const router = express.Router();

let pendingState = null;

function getStoredTokens() {
  return db.prepare('SELECT * FROM spotify_tokens WHERE id = 1').get();
}

function saveTokens({ access_token, refresh_token, expires_in }) {
  const expiry_date = Date.now() + expires_in * 1000;
  db.prepare(`
    INSERT INTO spotify_tokens (id, access_token, refresh_token, expiry_date)
    VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = COALESCE(excluded.refresh_token, refresh_token),
      expiry_date = excluded.expiry_date
  `).run(access_token, refresh_token || null, expiry_date);
}

async function refreshAccessToken(refresh_token) {
  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token }),
  });
  if (!res.ok) throw new Error('Failed to refresh Spotify token');
  return res.json();
}

async function getValidToken() {
  const tokens = getStoredTokens();
  if (!tokens || !tokens.access_token) return null;
  if (tokens.expiry_date && Date.now() > tokens.expiry_date - 60000) {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    saveTokens(refreshed);
    return refreshed.access_token;
  }
  return tokens.access_token;
}

router.get('/auth', (req, res) => {
  pendingState = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3001/api/spotify/callback',
    scope: 'user-read-currently-playing',
    state: pendingState,
  });
  res.json({ url: `https://accounts.spotify.com/authorize?${params}` });
});

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!pendingState || !state || state !== pendingState) {
    pendingState = null;
    return res.status(403).send('Invalid state parameter.');
  }
  pendingState = null;
  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');
  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3001/api/spotify/callback',
      }),
    });
    if (!tokenRes.ok) throw new Error('Token exchange failed');
    const tokenData = await tokenRes.json();
    saveTokens(tokenData);
    res.send('<script>window.close();</script><p>Spotify connecté ! Vous pouvez fermer cet onglet.</p>');
  } catch {
    res.status(500).send('Erreur OAuth Spotify.');
  }
});

router.get('/status', (req, res) => {
  const tokens = getStoredTokens();
  res.json({ connected: !!(tokens && tokens.access_token) });
});

router.delete('/disconnect', (req, res) => {
  db.prepare('DELETE FROM spotify_tokens WHERE id = 1').run();
  res.json({ ok: true });
});

router.get('/current', async (req, res) => {
  try {
    const token = await getValidToken();
    if (!token) return res.json(null);
    const spotRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (spotRes.status === 204 || spotRes.status === 404) return res.json(null);
    if (!spotRes.ok) return res.status(spotRes.status).json({ error: 'Spotify API error' });
    const data = await spotRes.json();
    if (!data || !data.item) return res.json(null);
    res.json({
      track: data.item.name,
      artist: data.item.artists.map(a => a.name).join(', '),
      album: data.item.album.name,
      art: data.item.album.images[0]?.url || null,
      progress_ms: data.progress_ms,
      duration_ms: data.item.duration_ms,
      is_playing: data.is_playing,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Vérifier les routes avec curl (redémarrer le backend d'abord)**

```bash
# Dans un terminal séparé :
cd backend && node server.js

# Status — doit retourner {"connected":false}
curl http://localhost:3001/api/spotify/status

# Auth — doit retourner {"url":"https://accounts.spotify.com/authorize?..."}
curl http://localhost:3001/api/spotify/auth

# Current sans token — doit retourner null
curl http://localhost:3001/api/spotify/current
```

- [ ] **Commit**

```bash
git add backend/routes/spotify.js
git commit -m "feat(spotify): add OAuth2 backend routes"
```

---

## Task 4 — Backend : enregistrer la route dans server.js

**Files:**
- Modify: `backend/server.js`

- [ ] **Ajouter la ligne dans `backend/server.js`** après `app.use('/api/calendar', ...)` :

```javascript
app.use('/api/spotify', require('./routes/spotify'));
```

Le bloc complet des routes devient :

```javascript
app.use('/api/habits', require('./routes/habits'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/todos', require('./routes/todos'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/spotify', require('./routes/spotify'));
app.use('/api/ideas', require('./routes/ideas'));
app.use('/api/photos', require('./routes/photos'));
```

- [ ] **Redémarrer et vérifier**

```bash
cd backend && node server.js
# Attendu : "Backend running on http://localhost:3001"
```

- [ ] **Commit**

```bash
git add backend/server.js
git commit -m "feat(spotify): register /api/spotify route"
```

---

## Task 5 — Frontend : composant SpotifyWidget

**Files:**
- Modify: `frontend/src/pages/Today.jsx`
- Modify: `frontend/src/pages/Today.css`

- [ ] **Insérer le composant `SpotifyWidget` dans `Today.jsx`**

Ajouter juste avant `export default function Today()` (après la fermeture du composant `DigitalClock`) :

```jsx
function SpotifyWidget() {
  const [status, setStatus] = useState(null);
  const [track, setTrack] = useState(null);

  useEffect(() => {
    fetch('/api/spotify/status')
      .then(r => r.json())
      .then(d => setStatus(d.connected))
      .catch(() => setStatus(false));
  }, []);

  useEffect(() => {
    if (!status) return;
    async function fetchCurrent() {
      try {
        const res = await fetch('/api/spotify/current');
        const data = await res.json();
        setTrack(data);
      } catch {
        setTrack(null);
      }
    }
    fetchCurrent();
    const id = setInterval(fetchCurrent, 5000);
    return () => clearInterval(id);
  }, [status]);

  async function handleConnect() {
    try {
      const res = await fetch('/api/spotify/auth');
      const { url } = await res.json();
      window.open(url, '_blank', 'width=500,height=700');
      const poll = setInterval(async () => {
        try {
          const r = await fetch('/api/spotify/status');
          const d = await r.json();
          if (d.connected) {
            clearInterval(poll);
            setStatus(true);
          }
        } catch {}
      }, 2000);
      setTimeout(() => clearInterval(poll), 5 * 60 * 1000);
    } catch {}
  }

  function fmtMs(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  if (status === false) {
    return (
      <div className="spotify-widget spotify-connect">
        <span className="spotify-logo">SPOTIFY</span>
        <span className="spotify-connect-text">Connecte ton compte pour voir ce qui joue</span>
        <button className="spotify-connect-btn" onClick={handleConnect}>
          Connecter Spotify
        </button>
      </div>
    );
  }

  if (status === null) return null;

  if (!track) {
    return (
      <div className="spotify-widget spotify-idle">
        <div className="spotify-idle-art">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <polygon points="10,8 16,12 10,16" fill="currentColor" />
          </svg>
        </div>
        <div className="spotify-idle-info">
          <div className="spotify-idle-line" />
          <div className="spotify-idle-line short" />
          <span className="spotify-idle-text">Rien en cours</span>
        </div>
        <span className="spotify-logo">SPOTIFY</span>
      </div>
    );
  }

  const pct = track.duration_ms > 0 ? (track.progress_ms / track.duration_ms) * 100 : 0;

  return (
    <div className="spotify-widget spotify-playing">
      <div className="spotify-top">
        {track.art
          ? <img className="spotify-art" src={track.art} alt="" />
          : <div className="spotify-art spotify-art-fallback">🎵</div>
        }
        <div className="spotify-info">
          <div className="spotify-track">{track.track}</div>
          <div className="spotify-artist">{track.artist}</div>
        </div>
        <span className="spotify-logo">SPOTIFY</span>
      </div>
      <div>
        <div className="spotify-bar-wrap">
          <div className="spotify-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="spotify-time-row">
          <span>{fmtMs(track.progress_ms)}</span>
          <span>{fmtMs(track.duration_ms)}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Ajouter `<SpotifyWidget />` dans le JSX de `Today`**

Dans la fonction `Today`, dans `<aside className="shortcuts-panel">`, ajouter `<SpotifyWidget />` après `<PhotoWidget />` :

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
  <SpotifyWidget />
</aside>
```

- [ ] **Ajouter les styles dans `Today.css`** (à la fin du fichier)

```css
/* Spotify Widget */
.spotify-widget {
  border-radius: var(--radius-lg);
  padding: 12px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  margin-top: 12px;
}

.spotify-logo {
  color: #1DB954;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .06em;
  flex-shrink: 0;
}

.spotify-playing {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.spotify-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.spotify-art {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  flex-shrink: 0;
  object-fit: cover;
}

.spotify-art-fallback {
  background: linear-gradient(135deg, #1DB954, #17a349);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.spotify-info {
  flex: 1;
  min-width: 0;
}

.spotify-track {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.spotify-artist {
  font-size: 11px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.spotify-bar-wrap {
  height: 3px;
  background: var(--border);
  border-radius: 99px;
  overflow: hidden;
}

.spotify-bar-fill {
  height: 100%;
  background: #1DB954;
  border-radius: 99px;
  transition: width .5s linear;
}

.spotify-time-row {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-3);
  margin-top: 3px;
}

.spotify-idle {
  display: flex;
  align-items: center;
  gap: 10px;
}

.spotify-idle-art {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  background: var(--bg-2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--text-3);
}

.spotify-idle-info {
  flex: 1;
  min-width: 0;
}

.spotify-idle-line {
  height: 8px;
  border-radius: 4px;
  background: var(--border);
  margin-bottom: 6px;
}

.spotify-idle-line.short {
  width: 55%;
}

.spotify-idle-text {
  font-size: 11px;
  color: var(--text-3);
}

.spotify-connect {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
}

.spotify-connect-text {
  font-size: 11px;
  color: var(--text-2);
  text-align: center;
}

.spotify-connect-btn {
  background: #1DB954;
  color: #000;
  border: none;
  border-radius: 99px;
  padding: 7px 14px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.spotify-connect-btn:hover {
  background: #1ed760;
}
```

- [ ] **Vérifier visuellement**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Ouvrir `http://localhost:5173`. Le widget Spotify doit apparaître sous le widget photo, avec le bouton "Connecter Spotify".

- [ ] **Commit**

```bash
git add frontend/src/pages/Today.jsx frontend/src/pages/Today.css
git commit -m "feat(spotify): add SpotifyWidget component"
```

---

## Task 6 — Frontend : section Spotify dans Settings

**Files:**
- Modify: `frontend/src/pages/Settings.jsx`
- Modify: `frontend/src/pages/Settings.css`

- [ ] **Ajouter l'état `spotifyStatus` dans `Settings`**

Dans la fonction `Settings`, après les déclarations d'état existantes (`photos`, `deleting`) :

```jsx
const [spotifyStatus, setSpotifyStatus] = useState(null);
```

- [ ] **Ajouter le `useEffect` de statut Spotify**

Après le `useEffect` des photos existant :

```jsx
useEffect(() => {
  fetch('/api/spotify/status')
    .then(r => r.json())
    .then(d => setSpotifyStatus(d.connected))
    .catch(() => setSpotifyStatus(false));
}, []);
```

- [ ] **Ajouter les deux handlers après `handleDelete`**

```jsx
async function handleSpotifyConnect() {
  try {
    const res = await fetch('/api/spotify/auth');
    const { url } = await res.json();
    window.open(url, '_blank', 'width=500,height=700');
    const poll = setInterval(async () => {
      try {
        const r = await fetch('/api/spotify/status');
        const d = await r.json();
        if (d.connected) {
          clearInterval(poll);
          setSpotifyStatus(true);
        }
      } catch {}
    }, 2000);
    setTimeout(() => clearInterval(poll), 5 * 60 * 1000);
  } catch {}
}

async function handleSpotifyDisconnect() {
  await fetch('/api/spotify/disconnect', { method: 'DELETE' });
  setSpotifyStatus(false);
}
```

- [ ] **Ajouter la section Spotify dans le JSX**, après la section "Widget photo" :

```jsx
<div className="settings-section card" style={{ marginTop: 16 }}>
  <h2 className="settings-section-title">Spotify</h2>
  <div className="settings-row">
    <span className="settings-label">Compte connecté</span>
    {spotifyStatus === null && (
      <span className="settings-status">Chargement…</span>
    )}
    {spotifyStatus === false && (
      <button className="spotify-connect-btn" onClick={handleSpotifyConnect}>
        Connecter Spotify
      </button>
    )}
    {spotifyStatus === true && (
      <button className="settings-btn-danger" onClick={handleSpotifyDisconnect}>
        Déconnecter
      </button>
    )}
  </div>
</div>
```

- [ ] **Ajouter les styles dans `Settings.css`** (à la fin du fichier)

```css
.settings-status {
  font-size: 13px;
  color: var(--text-3);
}

.settings-btn-danger {
  padding: 5px 12px;
  border-radius: var(--radius);
  font-size: 12px;
  font-weight: 500;
  color: var(--red);
  background: transparent;
  border: 1px solid var(--red);
  cursor: pointer;
  transition: background 0.15s;
}

.settings-btn-danger:hover {
  background: rgba(239, 68, 68, 0.1);
}
```

- [ ] **Tester le flux complet**

1. Aller sur `http://localhost:5173/settings` — la section Spotify doit apparaître avec "Connecter Spotify"
2. Cliquer "Connecter Spotify" → popup Spotify → s'authentifier → la popup se ferme automatiquement
3. Le bouton passe à "Déconnecter"
4. Aller sur Aujourd'hui → le widget affiche la piste en cours (ou "Rien en cours" si Spotify est en pause)
5. Cliquer "Déconnecter" dans Settings → le widget repasse à l'état "Connecter Spotify"

- [ ] **Commit**

```bash
git add frontend/src/pages/Settings.jsx frontend/src/pages/Settings.css
git commit -m "feat(spotify): add Spotify section to Settings page"
```
