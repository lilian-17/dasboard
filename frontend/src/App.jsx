import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Today from './pages/Today';
import Habits from './pages/Habits';
import Expenses from './pages/Expenses';
import Todos from './pages/Todos';
import Calendar from './pages/Calendar';
import Ideas from './pages/Ideas';
import Settings from './pages/Settings';
import './App.css';

const NAV = [
  { to: '/', label: "Aujourd'hui", icon: '◈', end: true },
  { to: '/habits', label: 'Habitudes', icon: '◎' },
  { to: '/expenses', label: 'Dépenses', icon: '₣' },
  { to: '/todos', label: 'Tâches', icon: '◻' },
  { to: '/calendar', label: 'Calendrier', icon: '◷' },
  { to: '/ideas', label: 'Idées', icon: '◇' },
  { to: '/settings', label: 'Paramètres', icon: '◉' },
];

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export default function App() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('nav-collapsed') === 'true');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [accent, setAccent] = useState(() => localStorage.getItem('accent') || '#6366f1');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent);
    document.documentElement.style.setProperty('--accent-dim', `rgba(${hexToRgb(accent)},0.15)`);
    localStorage.setItem('accent', accent);
  }, [accent]);

  return (
    <BrowserRouter>
      <div className={`layout${collapsed ? ' nav-collapsed' : ''}`}>
        <nav className={`sidebar${collapsed ? ' collapsed' : ''}`}>
          <div className="sidebar-logo">
            {!collapsed && <span>Dashboard</span>}
            <button
              className="nav-collapse-btn"
              onClick={() => setCollapsed(c => {
              const next = !c;
              localStorage.setItem('nav-collapsed', String(next));
              return next;
            })}
              aria-label={collapsed ? 'Agrandir la navigation' : 'Réduire la navigation'}
            >
              {collapsed ? '›' : '‹'}
            </button>
          </div>
          <ul className="sidebar-nav">
            {NAV.map(({ to, label, icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
                  title={collapsed ? label : undefined}
                >
                  <span className="nav-icon">{icon}</span>
                  {!collapsed && <span>{label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main className="content">
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/habits" element={<Habits />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/todos" element={<Todos />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/ideas" element={<Ideas />} />
            <Route path="/settings" element={<Settings theme={theme} setTheme={setTheme} accent={accent} setAccent={setAccent} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
