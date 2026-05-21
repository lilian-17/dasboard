import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Today from './pages/Today';
import Habits from './pages/Habits';
import Expenses from './pages/Expenses';
import Todos from './pages/Todos';
import Calendar from './pages/Calendar';
import Ideas from './pages/Ideas';
import './App.css';

const NAV = [
  { to: '/', label: "Aujourd'hui", icon: '◈', end: true },
  { to: '/habits', label: 'Habitudes', icon: '◎' },
  { to: '/expenses', label: 'Dépenses', icon: '₣' },
  { to: '/todos', label: 'Tâches', icon: '◻' },
  { to: '/calendar', label: 'Calendrier', icon: '◷' },
  { to: '/ideas', label: 'Idées', icon: '◇' },
];

export default function App() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('nav-collapsed') === 'true');

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
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
