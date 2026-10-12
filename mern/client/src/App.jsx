import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Quiz from './pages/Quiz';
import Leaderboard from './pages/Leaderboard';

const link = ({ isActive }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`;

function Protected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="p-8 text-center text-slate-500">Loading…</p>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3">
          <span className="mr-4 text-lg font-bold text-indigo-600">MicroLearn</span>
          {user && (
            <>
              <NavLink to="/" end className={link}>Lessons</NavLink>
              <NavLink to="/leaderboard" className={link}>Leaderboard</NavLink>
              <span className="ml-auto text-sm text-slate-500">{user.username}</span>
              <button onClick={logout} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200">Sign out</button>
            </>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/lessons/:id" element={<Protected><Quiz /></Protected>} />
          <Route path="/leaderboard" element={<Protected><Leaderboard /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
