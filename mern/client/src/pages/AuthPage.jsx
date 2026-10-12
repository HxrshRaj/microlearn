import { useState } from 'react';
import { useAuth } from '../AuthContext';

const input = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ identifier: '', username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(form.identifier, form.password);
      else await register(form.username, form.email, form.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto mt-10 max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h1 className="text-xl font-semibold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
      {mode === 'login' ? (
        <input className={input} placeholder="Username or email" value={form.identifier} onChange={set('identifier')} required />
      ) : (
        <>
          <input className={input} placeholder="Username" value={form.username} onChange={set('username')} required />
          <input className={input} type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
        </>
      )}
      <input className={input} type="password" placeholder="Password (min 8 characters)" value={form.password} onChange={set('password')} required />
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded-md bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
        {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Sign up'}
      </button>
      <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} className="w-full text-sm text-indigo-600 hover:underline">
        {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
      </button>
    </form>
  );
}
