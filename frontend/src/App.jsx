import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
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
  return (
    <BrowserRouter>
      <div className="layout">
        <nav className="sidebar">
          <div className="sidebar-logo">Dashboard</div>
          <ul className="sidebar-nav">
            {NAV.map(({ to, label, icon, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                  <span className="nav-icon">{icon}</span>
                  <span>{label}</span>
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
