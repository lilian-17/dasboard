# Photo Widget — Design Spec
Date: 2026-05-21

## Objectif

Ajouter un widget de photos sous les raccourcis dans la sidebar de la page d'accueil (`Today`). L'utilisateur peut ajouter et supprimer des photos via un menu clic-droit. Les photos défilent automatiquement toutes les 2 minutes avec une transition fade.

---

## Architecture générale

Deux nouvelles pièces s'ajoutent au projet, rien d'existant n'est modifié sauf `Today.jsx` et `server.js` (montage de la route).

- `backend/routes/photos.js` — routes CRUD + serving statique
- `backend/data/photos/` — stockage des fichiers image sur disque
- Table SQLite `photos` — métadonnées (id, filename, created_at)
- `multer` — parsing multipart/form-data pour l'upload
- Composant `PhotoWidget` dans `Today.jsx` — monté sous `.shortcuts-list`

---

## Base de données

Nouvelle table dans la DB SQLite existante :

```sql
CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Ordre d'affichage : `created_at DESC` (photo la plus récente en premier).

---

## Routes API

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/photos` | Retourne `[{ id, url }]` pour toutes les photos |
| `POST` | `/api/photos` | Upload une image (multipart), retourne `{ id, url }` |
| `DELETE` | `/api/photos/:id` | Supprime le fichier disque + la ligne DB |
| `GET` | `/api/photos/files/:filename` | Sert le fichier image en statique |

Contraintes upload : `image/*` uniquement, max 10 Mo.

Les URLs retournées par `GET /api/photos` sont de la forme `/api/photos/files/<filename>`.

---

## Composant frontend — `PhotoWidget`

### Emplacement
Dans `Today.jsx`, dans l'`<aside className="shortcuts-panel">`, après `.shortcuts-list`.

### États
- **Chargement** : rien affiché (silencieux)
- **Vide (0 photos)** : placeholder avec icône et texte "Clic droit pour ajouter"
- **Diaporama actif** : photo courante affichée, compteur discret (ex. `1 / 5`)

### Diaporama
- Intervalle de 2 minutes (`setInterval` 120 000 ms)
- Transition `fade` CSS (opacity 0→1, durée 0.6s)
- Cycle circulaire : après la dernière photo, revient à la première
- L'intervalle se réinitialise quand une photo est ajoutée ou supprimée

### Menu clic-droit
- `onContextMenu` sur le conteneur du widget → `e.preventDefault()`
- Menu positionné à la position du curseur
- Deux entrées : **Ajouter une photo** / **Supprimer cette photo** (désactivée si 0 photos)
- Fermeture : clic ailleurs (listener `mousedown` sur `document`)
- Aucun contrôle permanent visible sur le widget

### Ajout d'une photo
1. `<input type="file" accept="image/*">` déclenché programmatiquement
2. `POST /api/photos` (multipart)
3. Rechargement de la liste → affichage de la photo ajoutée

### Suppression d'une photo
1. `DELETE /api/photos/:id` avec l'id de la photo courante
2. Rechargement de la liste → passage à la photo suivante (ou état vide)

---

## Gestion d'erreurs

- Upload échoué : message d'erreur affiché brièvement dans le widget (2s), pas de crash
- Suppression échouée : idem
- Photos inaccessibles (fichier manquant) : l'`<img>` affiche le broken image natif du navigateur (acceptable)

---

## Fichiers modifiés / créés

| Fichier | Action |
|---|---|
| `backend/routes/photos.js` | Créé |
| `backend/db.js` | Ajout de la création de la table `photos` au init |
| `backend/server.js` | Montage de `app.use('/api/photos', require('./routes/photos'))` |
| `frontend/src/pages/Today.jsx` | Ajout du composant `PhotoWidget` dans la sidebar |
| `frontend/src/pages/Today.css` | Styles du widget |
