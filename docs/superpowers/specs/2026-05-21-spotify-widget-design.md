# Spotify Widget — Design Spec

**Date:** 2026-05-21  
**Scope:** Widget "lecture en cours" en lecture seule, placé sous le PhotoWidget dans le panneau raccourcis de la page Aujourd'hui.

---

## Objectif

Afficher en temps réel la piste Spotify en cours de lecture directement dans le dashboard, sans contrôles de lecture.

---

## Architecture

### Backend — `backend/routes/spotify.js`

Miroir de `backend/routes/calendar.js`. 5 routes Express :

| Route | Description |
|---|---|
| `GET /api/spotify/auth` | Génère l'URL d'autorisation OAuth2 Spotify et redirige |
| `GET /api/spotify/callback` | Reçoit le `code`, échange contre des tokens, stocke en DB |
| `GET /api/spotify/status` | Retourne `{ connected: boolean }` |
| `GET /api/spotify/current` | Retourne la piste en cours ou `null` si rien ne joue |
| `DELETE /api/spotify/disconnect` | Supprime les tokens de la DB |

Le backend renouvelle automatiquement le `access_token` via le `refresh_token` avant chaque appel à l'API Spotify si le token est expiré.

### Base de données

Nouvelle table SQLite dans `backend/db.js` :

```sql
CREATE TABLE IF NOT EXISTS spotify_tokens (
  id INTEGER PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  expiry_date INTEGER
);
```

### API Spotify utilisée

- **Endpoint :** `GET https://api.spotify.com/v1/me/player/currently-playing`
- **Scope OAuth :** `user-read-currently-playing`
- **Réponse :** titre, artiste, album, URL de la pochette, progression (ms), durée (ms), état playing/paused

### Variables d'environnement requises

À ajouter dans `backend/.env` :

```
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_REDIRECT_URI=http://localhost:3001/api/spotify/callback
```

---

## Frontend — `SpotifyWidget` dans `Today.jsx`

### Placement

Dans l'`<aside className="shortcuts-panel">`, juste après `<PhotoWidget />`.

### Layout retenu : Horizontal compact

```
┌─────────────────────────────────────┐
│  [🎵]  Blinding Lights         SPOTIFY │
│        The Weeknd · After Hours       │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░   │
│  1:24                          3:20   │
└─────────────────────────────────────┘
```

- Pochette 48×48px, border-radius 6px
- Titre (bold, 13px, ellipsis) + artiste (11px, atténué)
- Logo "SPOTIFY" en vert Spotify (`#1DB954`) à droite
- Barre de progression fine (3px), remplie en vert Spotify
- Timecodes 10px, atténués

### États

| État | Rendu |
|---|---|
| **En lecture** | Pochette + titre + artiste + barre de progression |
| **Rien ne joue** | Icône lecture atténuée + "Rien en cours de lecture" |
| **Non connecté** | Logo Spotify + texte + bouton "Connecter Spotify" |

### Comportement

- Poll de `/api/spotify/current` toutes les **5 secondes** via `setInterval`
- La pochette est une `<img>` avec l'URL fournie par l'API Spotify
- Le bouton "Connecter Spotify" ouvre la page d'auth via `/api/spotify/auth` (même mécanique que le calendrier Google)
- Aucun contrôle de lecture (lecture seule)

---

## Intégration dans la page Settings

Ajouter une section "Spotify" dans `Settings.jsx` permettant de voir le statut de connexion et de se déconnecter (via `DELETE /api/spotify/disconnect`), identique à la section Google Calendar existante.

---

## Ce qui n'est PAS inclus

- Contrôles de lecture (play, pause, suivant, précédent)
- Historique d'écoute
- File d'attente
- Notifications de changement de piste

---

## Prérequis utilisateur

1. Créer une app sur [developer.spotify.com](https://developer.spotify.com)
2. Ajouter `http://localhost:3001/api/spotify/callback` dans les Redirect URIs de l'app
3. Copier le `Client ID` et `Client Secret` dans `backend/.env`
