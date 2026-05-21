import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import './Expenses.css';

const CATEGORIES = ['Food', 'Transport', 'Housing', 'Health', 'Entertainment', 'Shopping', 'Utilities', 'Other'];
const CAT_COLORS = { Food:'#f59e0b', Transport:'#6366f1', Housing:'#22c55e', Health:'#ec4899', Entertainment:'#f97316', Shopping:'#14b8a6', Utilities:'#8b5cf6', Other:'#64748b' };

function monthKey(d) { return format(d, 'yyyy-MM'); }
function fmtMonth(mk) {
  const [y, m] = mk.split('-');
  return format(new Date(+y, +m - 1, 1), 'MMM yyyy');
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [month, setMonth] = useState(monthKey(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [form, setForm] = useState({ amount: '', category: 'Food', description: '', date: format(new Date(), 'yyyy-MM-dd') });
  const [budgetForm, setBudgetForm] = useState({ category: 'Food', monthly_limit: '' });

  const load = useCallback(async () => {
    const [exp, sum, bud] = await Promise.all([
      api.get(`/expenses?month=${month}`),
      api.get(`/expenses/summary/${month}`),
      api.get('/expenses/budgets'),
    ]);
    setExpenses(exp);
    setSummary(sum);
    setBudgets(bud);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  async function addExpense(e) {
    e.preventDefault();
    await api.post('/expenses', { ...form, amount: parseFloat(form.amount) });
    setForm(f => ({ ...f, amount: '', description: '' }));
    setShowForm(false);
    load();
  }

  async function deleteExpense(id) {
    await api.delete(`/expenses/${id}`);
    load();
  }

  async function saveBudget(e) {
    e.preventDefault();
    await api.post('/expenses/budgets', { ...budgetForm, monthly_limit: parseFloat(budgetForm.monthly_limit) });
    setBudgetForm(f => ({ ...f, monthly_limit: '' }));
    setShowBudget(false);
    load();
  }

  const budgetMap = Object.fromEntries(budgets.map(b => [b.category, b.monthly_limit]));
  const totalMonth = expenses.reduce((s, e) => s + e.amount, 0);

  const chartData = summary.map(r => ({
    name: r.category,
    total: r.total,
    budget: budgetMap[r.category] || null,
  }));

  function prevMonth() {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setMonth(monthKey(d));
  }
  function nextMonth() {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m, 1);
    if (d > new Date()) return;
    setMonth(monthKey(d));
  }

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="chart-tooltip">
        <div className="ct-cat">{d.name}</div>
        <div className="ct-row"><span>Spent</span><span>${d.total.toFixed(2)}</span></div>
        {d.budget && <div className="ct-row"><span>Budget</span><span>${d.budget.toFixed(2)}</span></div>}
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Expenses</h1>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={() => setShowBudget(s => !s)}>Budgets</button>
          <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>+ Add</button>
        </div>
      </div>

      {showForm && (
        <form className="card expense-form" onSubmit={addExpense}>
          <div className="form-row">
            <input className="input" type="number" step="0.01" placeholder="Amount" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required autoFocus />
            <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
          </div>
          <div className="form-row">
            <input className="input flex-1" placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <button className="btn btn-primary" type="submit">Add</button>
            <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {showBudget && (
        <form className="card budget-form" onSubmit={saveBudget}>
          <div className="form-row">
            <select className="input" value={budgetForm.category} onChange={e => setBudgetForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <input className="input" type="number" step="0.01" placeholder="Monthly limit" value={budgetForm.monthly_limit} onChange={e => setBudgetForm(f => ({ ...f, monthly_limit: e.target.value }))} required />
            <button className="btn btn-primary" type="submit">Save budget</button>
            <button className="btn btn-ghost" type="button" onClick={() => setShowBudget(false)}>Cancel</button>
          </div>
          {budgets.length > 0 && (
            <div className="budget-list">
              {budgets.map(b => (
                <div key={b.category} className="budget-row">
                  <span>{b.category}</span>
                  <span>${b.monthly_limit}/mo</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { api.delete(`/expenses/budgets/${b.category}`); load(); }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </form>
      )}

      <div className="month-nav">
        <button className="btn btn-ghost" onClick={prevMonth}>‹</button>
        <span className="month-label">{fmtMonth(month)}</span>
        <button className="btn btn-ghost" onClick={nextMonth}>›</button>
        <span className="month-total">Total: <strong>${totalMonth.toFixed(2)}</strong></span>
      </div>

      {chartData.length > 0 && (
        <div className="card chart-card">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-3)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={CAT_COLORS[entry.name] || '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {expenses.length === 0 ? (
        <div className="empty-state">No expenses for {fmtMonth(month)}.</div>
      ) : (
        <div className="card">
          <table className="expense-table">
            <thead>
              <tr>
                <th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id}>
                  <td className="text-muted">{e.date}</td>
                  <td><span className="cat-pill" style={{ '--c': CAT_COLORS[e.category] || '#6366f1' }}>{e.category}</span></td>
                  <td className="text-muted">{e.description || '—'}</td>
                  <td className="amount">${e.amount.toFixed(2)}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => deleteExpense(e.id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
