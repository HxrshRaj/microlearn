import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const Stat = ({ label, value }) => (
  <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-semibold">{value}</p>
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/stats'), api('/categories')]).then(([s, c]) => { setStats(s); setCategories(c); }).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    api(`/lessons${category ? `?category=${encodeURIComponent(category)}` : ''}`).then(setLessons).catch((e) => setError(e.message));
  }, [category]);

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total XP" value={stats.totalXp} />
          <Stat label="Streak" value={`${stats.currentStreak} 🔥`} />
          <Stat label="Best streak" value={stats.longestStreak} />
          <Stat label="Completed" value={`${stats.lessonsCompleted}/${stats.totalLessons}`} />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {['', ...categories].map((c) => (
          <button key={c || 'all'} onClick={() => setCategory(c)} className={`rounded-full px-3 py-1 text-sm ${category === c ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'}`}>
            {c || 'All'}
          </button>
        ))}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {lessons.map((l) => (
          <li key={l.id}>
            <Link to={`/lessons/${l.id}`} className="block h-full rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:ring-indigo-400">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{l.category}</span>
                <span>{l.completed ? '✓ Completed' : `${l.xpReward} XP`}</span>
              </div>
              <h2 className="mt-1 font-semibold">{l.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{l.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
