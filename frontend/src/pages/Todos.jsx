import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { format, isPast, parseISO } from 'date-fns';
import './Todos.css';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export default function Todos() {
  const [todos, setTodos] = useState([]);
  const [form, setForm] = useState({ title: '', priority: 'medium', due_date: '' });
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('active'); // active | done | all
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const load = useCallback(async () => {
    const data = await api.get('/todos');
    setTodos(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addTodo(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    await api.post('/todos', { ...form, due_date: form.due_date || null });
    setForm({ title: '', priority: 'medium', due_date: '' });
    setShowForm(false);
    load();
  }

  async function toggleDone(todo) {
    await api.patch(`/todos/${todo.id}`, { done: !todo.done });
    load();
  }

  async function deleteTodo(id) {
    await api.delete(`/todos/${id}`);
    load();
  }

  async function saveEdit(id) {
    await api.patch(`/todos/${id}`, { ...editForm, due_date: editForm.due_date || null });
    setEditId(null);
    load();
  }

  const visible = todos.filter(t => {
    if (filter === 'active') return !t.done;
    if (filter === 'done') return t.done;
    return true;
  });

  const sorted = [...visible].sort((a, b) => {
    if (a.done !== b.done) return a.done - b.done;
    return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
  });

  const activeCount = todos.filter(t => !t.done).length;

  return (
    <div>
      <div className="page-header">
        <div className="title-group">
          <h1 className="page-title">Tasks</h1>
          {activeCount > 0 && <span className="count-badge">{activeCount}</span>}
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>+ New task</button>
      </div>

      {showForm && (
        <form className="card todo-form" onSubmit={addTodo}>
          <input className="input big-input" placeholder="Task title..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
          <div className="form-row">
            <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
            </select>
            <input className="input" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            <button className="btn btn-primary" type="submit">Add</button>
            <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="filter-tabs">
        {['active','all','done'].map(f => (
          <button key={f} className={`filter-tab${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">
          {filter === 'active' ? 'All caught up! No active tasks.' : 'Nothing here.'}
        </div>
      ) : (
        <div className="todos-list">
          {sorted.map(todo => {
            const overdue = !todo.done && todo.due_date && isPast(parseISO(todo.due_date));
            if (editId === todo.id) {
              return (
                <div key={todo.id} className="card todo-edit-card">
                  <input className="input big-input" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} autoFocus />
                  <div className="form-row">
                    <select className="input" value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    <input className="input" type="date" value={editForm.due_date || ''} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} />
                    <button className="btn btn-primary" onClick={() => saveEdit(todo.id)}>Save</button>
                    <button className="btn btn-ghost" onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                </div>
              );
            }
            return (
              <div key={todo.id} className={`todo-row${todo.done ? ' done' : ''}`}>
                <button className={`todo-check${todo.done ? ' checked' : ''}`} onClick={() => toggleDone(todo)}>
                  {todo.done ? '✓' : ''}
                </button>
                <div className="todo-body" onClick={() => { setEditId(todo.id); setEditForm({ title: todo.title, priority: todo.priority, due_date: todo.due_date || '' }); }}>
                  <span className="todo-title">{todo.title}</span>
                  <div className="todo-meta">
                    <span className={`badge badge-${todo.priority}`}>{todo.priority}</span>
                    {todo.due_date && (
                      <span className={`due-date${overdue ? ' overdue' : ''}`}>
                        {overdue ? '⚠ ' : ''}{todo.due_date}
                      </span>
                    )}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm todo-del" onClick={() => deleteTodo(todo.id)}>✕</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
