import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import './SpotifyWidget.css';

function fmtMs(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function SpotifyWidget() {
  const [status, setStatus] = useState(null);
  const [track, setTrack] = useState(null);

  useEffect(() => {
    api.get('/spotify/status')
      .then(d => setStatus(d.connected))
      .catch(() => setStatus(false));
  }, []);

  useEffect(() => {
    if (!status) return;
    async function fetchCurrent() {
      try {
        const data = await api.get('/spotify/current');
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
      const { url } = await api.get('/spotify/auth');
      window.open(url, '_blank', 'width=500,height=700');
      const poll = setInterval(async () => {
        try {
          const d = await api.get('/spotify/status');
          if (d.connected) {
            clearInterval(poll);
            setStatus(true);
          }
        } catch {}
      }, 2000);
      setTimeout(() => clearInterval(poll), 5 * 60 * 1000);
    } catch {}
  }

  if (status === false) {
    return (
      <div className="spotify-widget spotify-connect">
        <span className="spotify-logo">SPOTIFY</span>
        <span className="spotify-connect-text">Connecte ton compte pour voir ce qui joue</span>
        <button className="spotify-connect-btn" onClick={handleConnect} aria-label="Connecter le compte Spotify">
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
        <div className="spotify-art-wrap">
          {track.art
            ? <img className="spotify-art" src={track.art} alt="" />
            : <div className="spotify-art spotify-art-fallback">🎵</div>
          }
          {!track.is_playing && <div className="spotify-paused-badge">⏸</div>}
        </div>
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
