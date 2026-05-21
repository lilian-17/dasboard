import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import './Ideas.css';

const TAGS = ['général', 'projet', 'dashboard', 'santé', 'dev'];

const TAG_COLORS = {
  'général':   { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8' },
  'projet':    { bg: 'rgba(234,179,8,0.12)',   text: '#eab308' },
  'dashboard': { bg: 'rgba(20,184,166,0.12)',  text: '#2dd4bf' },
  'santé':     { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80' },
  'dev':       { bg: 'rgba(249,115,22,0.12)',  text: '#fb923c' },
};

function TagBadge({ tag }) {
  const c = TAG_COLORS[tag] || TAG_COLORS['général'];
  return (
    <span className="idea-tag" style={{ background: c.bg, color: c.text }}>
      {tag}
    </span>
  );
}

export default function Ideas() {
  const [ideas, setIdeas] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', tag: 'général' });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [filterTag, setFilterTag] = useState('all');

  const load = useCallback(async () => {
    setIdeas(await api.get('/ideas'));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addIdea(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    await api.post('/ideas', form);
    setForm({ title: '', body: '', tag: 'général' });
    setShowForm(false);
    load();
  }

  async function saveEdit(id) {
    await api.patch(`/ideas/${id}`, editForm);
    setEditId(null);
    load();
  }

  async function deleteIdea(id) {
    await api.delete(`/ideas/${id}`);
    load();
  }

  const visible = filterTag === 'all' ? ideas : ideas.filter(i => i.tag === filterTag);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Idées</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>+ Nouvelle idée</button>
      </div>

      {showForm && (
        <form className="card idea-form" onSubmit={addIdea}>
          <input
            className="input big-input"
            placeholder="Titre de l'idée…"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            autoFocus
          />
          <textarea
            className="input idea-textarea"
            placeholder="Description, notes, détails…"
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            rows={4}
          />
          <div className="form-row">
            <select className="input" value={form.tag} onChange={e => setForm(f => ({ ...f, tag: e.target.value }))}>
              {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button className="btn btn-primary" type="submit">Ajouter</button>
            <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </form>
      )}

      <div className="filter-tabs">
        <button className={`filter-tab${filterTag === 'all' ? ' active' : ''}`} onClick={() => setFilterTag('all')}>
          Toutes
        </button>
        {TAGS.map(t => (
          <button key={t} className={`filter-tab${filterTag === t ? ' active' : ''}`} onClick={() => setFilterTag(t)}>
            {t}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">Aucune idée ici. Lance-toi !</div>
      ) : (
        <div className="ideas-grid">
          {visible.map(idea => {
            if (editId === idea.id) {
              return (
                <div key={idea.id} className="card idea-edit-card">
                  <input
                    className="input big-input"
                    value={editForm.title}
                    onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                    autoFocus
                  />
                  <textarea
                    className="input idea-textarea"
                    value={editForm.body || ''}
                    onChange={e => setEditForm(f => ({ ...f, body: e.target.value }))}
                    rows={4}
                  />
                  <div className="form-row">
                    <select className="input" value={editForm.tag} onChange={e => setEditForm(f => ({ ...f, tag: e.target.value }))}>
                      {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button className="btn btn-primary" onClick={() => saveEdit(idea.id)}>Sauvegarder</button>
                    <button className="btn btn-ghost" onClick={() => setEditId(null)}>Annuler</button>
                  </div>
                </div>
              );
            }
            return (
              <div key={idea.id} className="card idea-card" onClick={() => { setEditId(idea.id); setEditForm({ title: idea.title, body: idea.body || '', tag: idea.tag }); }}>
                <div className="idea-card-header">
                  <TagBadge tag={idea.tag} />
                  <button
                    className="btn btn-ghost btn-sm idea-del"
                    onClick={e => { e.stopPropagation(); deleteIdea(idea.id); }}
                  >✕</button>
                </div>
                <h3 className="idea-title">{idea.title}</h3>
                {idea.body && <p className="idea-body">{idea.body}</p>}
                <p className="idea-date">
                  {format(parseISO(idea.created_at), "d MMM yyyy", { locale: fr })}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
