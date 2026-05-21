# Dashboard personnel

Application web de suivi personnel : habitudes, tâches, dépenses, idées et calendrier Google.

## Stack

- **Frontend** — React + Vite
- **Backend** — Node.js / Express
- **Base de données** — SQLite (better-sqlite3)
- **Calendrier** — Google Calendar API (OAuth2)

## Fonctionnalités

- **Aujourd'hui** — vue d'ensemble du jour (tâches, habitudes, agenda)
- **Habitudes** — suivi journalier avec streaks et statistiques
- **Tâches** — liste de todos
- **Dépenses** — suivi budgétaire
- **Idées** — prise de notes rapide
- **Calendrier** — synchronisation Google Calendar

## Installation

```bash
# Installer les dépendances
npm run install:all

# Configurer les variables d'environnement
cp backend/.env.example backend/.env
# Remplir backend/.env avec vos credentials Google
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
| `GOOGLE_REDIRECT_URI` | URI de callback OAuth2 |

Les credentials se créent sur [Google Cloud Console](https://console.cloud.google.com/) en activant l'API Google Calendar.

## Structure

```
dashboard/
├── backend/
│   ├── routes/        # API Express (habits, todos, expenses, calendar, ideas)
│   ├── data/          # Base SQLite (ignorée par git)
│   ├── db.js          # Initialisation de la base
│   └── server.js
└── frontend/
    └── src/
        └── pages/     # React pages
```
