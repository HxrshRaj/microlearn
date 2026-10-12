import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';

export default function Quiz() {
  const { id } = useParams();
  const [lesson, setLesson] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api(`/lessons/${id}`).then(setLesson).catch((e) => setError(e.message)); }, [id]);

  const submit = async () => {
    setBusy(true);
    setError('');
    try { setResult(await api(`/lessons/${id}/submit`, { method: 'POST', body: { answers } })); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (error && !lesson) return <p role="alert" className="text-red-700">{error}</p>;
  if (!lesson) return <p className="text-slate-500">Loading…</p>;
  const verdict = (qid) => result?.results.find((r) => r.questionId === qid);

  return (
    <div className="space-y-5">
      <Link to="/" className="text-sm text-indigo-600 hover:underline">← All lessons</Link>
      <div>
        <h1 className="text-2xl font-semibold">{lesson.title}</h1>
        <p className="text-slate-600">{lesson.summary}</p>
      </div>
      {lesson.questions.map((q, i) => {
        const v = verdict(q.id);
        return (
          <fieldset key={q.id} className="space-y-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <legend className="font-medium">{i + 1}. {q.prompt}</legend>
            {q.options.map((opt, idx) => {
              const picked = answers[q.id] === idx;
              const tone = !v ? (picked ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50')
                : idx === v.correctIndex ? 'border-green-500 bg-green-50'
                : picked ? 'border-red-400 bg-red-50' : 'border-slate-200';
              return (
                <label key={idx} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${tone}`}>
                  <input type="radio" name={q.id} disabled={!!result} checked={picked} onChange={() => setAnswers({ ...answers, [q.id]: idx })} />
                  {opt}
                </label>
              );
            })}
          </fieldset>
        );
      })}
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {result ? (
        <div className="rounded-xl bg-indigo-600 p-5 text-white">
          <p className="text-lg font-semibold">Score: {result.score}% · +{result.xpEarned} XP</p>
          <p className="text-sm text-indigo-100">Total {result.stats.totalXp} XP · streak {result.stats.currentStreak} day(s)</p>
          <Link to="/" className="mt-3 inline-block rounded-md bg-white px-3 py-1.5 text-sm font-medium text-indigo-700">Back to lessons</Link>
        </div>
      ) : (
        <button onClick={submit} disabled={busy || Object.keys(answers).length === 0} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {busy ? 'Submitting…' : 'Submit answers'}
        </button>
      )}
    </div>
  );
}
