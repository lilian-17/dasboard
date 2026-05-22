import { useState, useEffect } from 'react';
import './Settings.css';

const ACCENTS = [
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Violet', value: '#a855f7' },
  { label: 'Rose', value: '#ec4899' },
  { label: 'Rouge', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Vert', value: '#22c55e' },
  { label: 'Cyan', value: '#06b6d4' },
];

const INTERVALS = [
  { label: '30 s', value: 30000 },
  { label: '1 min', value: 60000 },
  { label: '2 min', value: 120000 },
  { label: '5 min', value: 300000 },
  { label: '10 min', value: 600000 },
];

export default function Settings({ theme, setTheme, accent, setAccent }) {
  const [photoInterval, setPhotoInterval] = useState(
    () => parseInt(localStorage.getItem('photo-interval') || '120000')
  );
  const [photos, setPhotos] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [spotifyStatus, setSpotifyStatus] = useState(null);

  useEffect(() => {
    fetch('/api/photos')
      .then(r => r.json())
      .then(setPhotos)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/spotify/status')
      .then(r => r.json())
      .then(d => setSpotifyStatus(d.connected))
      .catch(() => setSpotifyStatus(false));
  }, []);

  function handleInterval(value) {
    setPhotoInterval(value);
    localStorage.setItem('photo-interval', String(value));
    window.dispatchEvent(new CustomEvent('photo-interval-change'));
  }

  async function handleDelete(id) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/photos/${id}`, { method: 'DELETE' });
      if (res.ok) setPhotos(p => p.filter(ph => ph.id !== id));
    } finally {
      setDeleting(null);
    }
  }

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

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1 className="page-title">Paramètres</h1>
      </div>

      <div className="settings-section card">
        <h2 className="settings-section-title">Apparence</h2>

        <div className="settings-row">
          <span className="settings-label">Thème</span>
          <div className="theme-options">
            <button
              className={`theme-btn${theme === 'dark' ? ' active' : ''}`}
              onClick={() => setTheme('dark')}
            >
              <span className="theme-preview theme-preview-dark" />
              Sombre
            </button>
            <button
              className={`theme-btn${theme === 'light' ? ' active' : ''}`}
              onClick={() => setTheme('light')}
            >
              <span className="theme-preview theme-preview-light" />
              Clair
            </button>
          </div>
        </div>

        <div className="settings-row">
          <span className="settings-label">Couleur d'accentuation</span>
          <div className="accent-options">
            {ACCENTS.map(({ label, value }) => (
              <button
                key={value}
                className={`accent-swatch${accent === value ? ' active' : ''}`}
                style={{ background: value }}
                title={label}
                onClick={() => setAccent(value)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="settings-section card" style={{ marginTop: 16 }}>
        <h2 className="settings-section-title">Widget photo</h2>

        <div className="settings-row">
          <span className="settings-label">Intervalle du diaporama</span>
          <div className="interval-options">
            {INTERVALS.map(({ label, value }) => (
              <button
                key={value}
                className={`interval-btn${photoInterval === value ? ' active' : ''}`}
                onClick={() => handleInterval(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-gallery-label">
          Galerie ({photos.length} photo{photos.length !== 1 ? 's' : ''})
        </div>
        {photos.length === 0 ? (
          <p className="settings-gallery-empty">Aucune photo ajoutée</p>
        ) : (
          <div className="settings-gallery">
            {photos.map(photo => (
              <div key={photo.id} className="gallery-item">
                <img src={photo.url} alt="" className="gallery-thumb" />
                <button
                  className="gallery-delete"
                  onClick={() => handleDelete(photo.id)}
                  disabled={deleting === photo.id}
                  aria-label="Supprimer"
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

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
    </div>
  );
}
