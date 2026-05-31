import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import './PhotoWidget.css';

export default function PhotoWidget() {
  const [photos, setPhotos] = useState([]);
  const [index, setIndex] = useState(0);
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState(null);
  const [slideInterval, setSlideInterval] = useState(
    () => parseInt(localStorage.getItem('photo-interval') || '120000')
  );
  const fileInputRef = useRef(null);
  const intervalRef = useRef(null);
  const errorTimerRef = useRef(null);

  useEffect(() => {
    const handler = () => setSlideInterval(
      parseInt(localStorage.getItem('photo-interval') || '120000')
    );
    window.addEventListener('photo-interval-change', handler);
    return () => window.removeEventListener('photo-interval-change', handler);
  }, []);

  const loadPhotos = useCallback(async () => {
    try {
      const data = await api.get('/photos');
      setPhotos(data);
    } catch {
      setError('Impossible de charger les photos');
    }
  }, []);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (photos.length > 1) {
      intervalRef.current = setInterval(() => {
        setIndex(i => (i + 1) % photos.length);
      }, slideInterval);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [photos, slideInterval]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  useEffect(() => () => { if (errorTimerRef.current) clearTimeout(errorTimerRef.current); }, []);

  function showError(msg) {
    setError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(null), 2000);
  }

  function handleContextMenu(e) {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }

  async function handleAdd(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setMenu(null);
    let failed = 0;
    for (const file of files) {
      const form = new FormData();
      form.append('photo', file);
      try {
        await api.upload('/photos', form);
      } catch {
        failed++;
      }
    }
    await loadPhotos();
    setIndex(0);
    if (failed > 0) showError(`${failed} photo(s) n'ont pas pu être uploadées`);
    e.target.value = '';
  }

  async function handleDelete() {
    if (!photos[index]) return;
    setMenu(null);
    try {
      await api.delete(`/photos/${photos[index].id}`);
      await loadPhotos();
      setIndex(i => Math.max(0, i - 1));
    } catch {
      showError('Erreur lors de la suppression');
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
            <img key={current.id} src={current.url} alt="" className="photo-widget-img" />
          )}
          {photos.length > 1 && (
            <button
              className="photo-widget-next"
              onClick={e => { e.stopPropagation(); setIndex(i => (i + 1) % photos.length); }}
              aria-label="Photo suivante"
            >›</button>
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
          <button className="photo-ctx-item" onClick={() => { setMenu(null); fileInputRef.current.click(); }}>
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
        multiple
        style={{ display: 'none' }}
        onChange={handleAdd}
      />
    </div>
  );
}
