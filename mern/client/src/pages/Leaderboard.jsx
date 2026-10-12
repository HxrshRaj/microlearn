import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { api('/leaderboard').then(setRows).catch((e) => setError(e.message)); }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Leaderboard</h1>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <table className="w-full overflow-hidden rounded-xl bg-white text-sm shadow-sm ring-1 ring-slate-200">
        <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
          <tr><th className="px-4 py-2">#</th><th className="px-4 py-2">Learner</th><th className="px-4 py-2">XP</th><th className="px-4 py-2">Best streak</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.username} className={`border-t border-slate-100 ${r.isYou ? 'bg-indigo-50 font-semibold' : ''}`}>
              <td className="px-4 py-2">{r.rank}</td><td className="px-4 py-2">{r.username}{r.isYou && ' (you)'}</td><td className="px-4 py-2">{r.totalXp}</td><td className="px-4 py-2">{r.longestStreak}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
