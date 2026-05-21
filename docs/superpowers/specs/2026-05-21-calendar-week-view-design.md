# Calendar — Vue semaine (design spec)

**Date :** 2026-05-21  
**Statut :** approuvé

## Contexte

La page Calendrier affiche actuellement une liste verticale d'événements Google Calendar pour les 14 prochains jours. L'objectif est de la remplacer par une vue semaine horizontale (style Google Agenda) combinée à un widget mois carré interactif.

## Layout

**Disposition C** — deux panneaux côte à côte :

- **Gauche (flex: 1)** — `WeekGrid` : vue semaine avec grille horaire
- **Droite (largeur fixe ~220px)** — `MiniMonth` + résumé du jour

## Composants

Tous dans `frontend/src/pages/Calendar.jsx` et `Calendar.css`. Aucun nouveau fichier.

### `CalendarPage` (composant principal)

État :
- `currentWeekStart` — Date du lundi de la semaine affichée (initialisé à `startOfWeek(today, { weekStartsOn: 1 })`)
- `events` — tableau d'événements pour la semaine affichée
- `status` — connexion Google Calendar (`null` | `true` | `false`)
- `loading`, `error`

Comportement :
- `useEffect` sur `currentWeekStart` → fetch `GET /api/calendar/events?timeMin=...&timeMax=...` pour `[lundi 00:00, dimanche 23:59]`
- Si non connecté : affiche la carte de connexion (inchangée)

### `MiniMonth`

Props : `currentWeekStart`, `onDayClick`, `viewingMonth` (Date), `onMonthChange`

- Grille 7×6 (L M M J V S D), affiche le mois `viewingMonth`
- Navigation `‹` / `›` pour changer `viewingMonth` (état local dans `CalendarPage`)
- Chaque jour cliquable → `onDayClick(date)` → parent calcule `startOfWeek(date, { weekStartsOn: 1 })` et met à jour `currentWeekStart`
- Semaine courante : fond subtil (`--accent-dim`) sur les 7 cases
- Aujourd'hui : cercle accent
- Jours hors du mois affiché : couleur atténuée

### `WeekGrid`

Props : `weekStart`, `events`

- En-tête : 7 colonnes avec jour abrégé + numéro. Colonne aujourd'hui avec fond ou texte mis en valeur.
- Bandeaux all-day au-dessus de la grille (une rangée dédiée)
- Grille horaire : 7h–22h, soit 15 créneaux d'1h. Colonne de gauche avec les heures (`7h`, `8h`…)
- Ligne "heure actuelle" : trait rouge horizontal, visible uniquement si la semaine affichée est la semaine en cours
- Colonnes week-end légèrement plus sombres (`--bg-2` vs `--bg`)

### `EventBlock`

Props : `event`, `hourStart` (7), `totalHours` (15)

Positionnement absolu dans sa colonne :
- `top` = `((heureDebut - hourStart) / totalHours) * 100%`
- `height` = `(duree_en_heures / totalHours) * 100%`
- Couleur : `--accent` avec opacité 0.2 fond, bordure gauche 3px pleine
- Contenu : titre (`font-weight: 500`) + heure (`font-size: 11px, color: --text-2`), tronqués si bloc trop petit

### Résumé du jour

Sous le `MiniMonth`, liste compacte des événements du jour sélectionné (ou aujourd'hui par défaut). Titre + heure, icône dot colorée.

## Backend

**Fichier :** `backend/routes/calendar.js`  
**Endpoint :** `GET /api/calendar/events`

Ajout de la lecture de `req.query.timeMin` et `req.query.timeMax` :
- Si les deux sont présents et sont des ISO strings valides → les utiliser dans `calendar.events.list`
- Sinon → fallback sur le comportement actuel (`now` + 14 jours)

Aucun autre fichier backend ne change.

## Dépendances frontend

- `date-fns` déjà installé : `startOfWeek`, `endOfWeek`, `addWeeks`, `isSameDay`, `isSameMonth`, `getHours`, `getMinutes`, `differenceInMinutes`, `startOfMonth`, `endOfMonth`, `eachDayOfInterval`
- `date-fns/locale/fr` déjà utilisé dans `Today.jsx`

## Ce qui ne change pas

- Logique OAuth / connect / disconnect : inchangée
- Routes backend autres que l'ajout des query params
- Design system (variables CSS, `.card`, `.btn`, etc.)
