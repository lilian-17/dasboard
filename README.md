# Dashboard personnel

Application web de suivi personnel : habitudes, tâches, dépenses, idées, calendrier Google et musique Spotify.

## Stack

- **Frontend** — React + Vite
- **Backend** — Node.js / Express
- **Base de données** — SQLite (better-sqlite3)
- **Calendrier** — Google Calendar API (OAuth2)
- **Spotify** — Spotify Web API (OAuth2)

## Fonctionnalités

- **Aujourd'hui** — vue d'ensemble du jour (tâches, habitudes, agenda)
- **Habitudes** — suivi journalier avec streaks et statistiques
- **Tâches** — liste de todos
- **Dépenses** — suivi budgétaire
- **Idées** — prise de notes rapide
- **Calendrier** — synchronisation Google Calendar
- **Spotify** — widget musique en cours de lecture (widget sur la page Aujourd'hui, configuration dans Paramètres)

## Installation

```bash
# Installer les dépendances
npm run install:all

# Configurer les variables d'environnement
cp backend/.env.example backend/.env
# Remplir backend/.env avec vos credentials Google et Spotify
```

## Lancement

```bash
# Démarrer backend + frontend en une commande
./start.sh
```

- Frontend → http://localhost:5173
- Backend  → http://localhost:3001

## Variables d'environnement

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID OAuth2 Google |
| `GOOGLE_CLIENT_SECRET` | Client Secret OAuth2 Google |
| `GOOGLE_REDIRECT_URI` | URI de callback OAuth2 Google |
| `SPOTIFY_CLIENT_ID` | Client ID de l'app Spotify |
| `SPOTIFY_CLIENT_SECRET` | Client Secret de l'app Spotify |
| `SPOTIFY_REDIRECT_URI` | URI de callback OAuth2 Spotify (ex: `http://127.0.0.1:3001/api/spotify/callback`) |

Les credentials Google se créent sur [Google Cloud Console](https://console.cloud.google.com/) en activant l'API Google Calendar.

Les credentials Spotify se créent sur [Spotify Developer Dashboard](https://developer.spotify.com/dashboard). Ajouter l'URI de callback dans les **Redirect URIs** de l'app (utiliser `127.0.0.1` et non `localhost`).

## Structure

```
dashboard/
├── backend/
│   ├── routes/        # API Express (habits, todos, expenses, calendar, ideas, spotify)
│   ├── data/          # Base SQLite (ignorée par git)
│   ├── db.js          # Initialisation de la base
│   └── server.js
└── frontend/
    └── src/
        └── pages/     # React pages
```
