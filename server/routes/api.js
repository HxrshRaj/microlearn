const express = require('express');
const { load, save } = require('../db');

const router = express.Router();

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

// GET /api/lessons — list all lessons with completion status
router.get('/lessons', (req, res) => {
  const data = load();
  const completedIds = new Set(data.progress.map((p) => p.lesson_id));
  const lessons = data.lessons.map(({ questions, ...lesson }) => ({
    ...lesson,
    completed: completedIds.has(lesson.id),
  }));
  res.json(lessons);
});

// GET /api/lessons/:id — a single lesson with its questions (no answers leaked)
router.get('/lessons/:id', (req, res) => {
  const data = load();
  const lesson = data.lessons.find((l) => l.id === Number(req.params.id));
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

  const { questions, ...rest } = lesson;
  res.json({
    ...rest,
    questions: questions.map(({ correct_index, ...q }) => q),
  });
});

// POST /api/lessons/:id/submit — { answers: { questionId: selectedIndex } }
router.post('/lessons/:id/submit', (req, res) => {
  const data = load();
  const lesson = data.lessons.find((l) => l.id === Number(req.params.id));
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

  const answers = req.body.answers || {};

  let correct = 0;
  const results = lesson.questions.map((q) => {
    const selected = answers[q.id];
    const isCorrect = selected === q.correct_index;
    if (isCorrect) correct += 1;
    return { questionId: q.id, correct: isCorrect, correctIndex: q.correct_index };
  });

  const score = Math.round((correct / lesson.questions.length) * 100);
  const xpEarned = Math.round((score / 100) * lesson.xp_reward);

  const nextProgressId = data.progress.length
    ? Math.max(...data.progress.map((p) => p.id)) + 1
    : 1;

  data.progress.push({
    id: nextProgressId,
    lesson_id: lesson.id,
    completed_at: new Date().toISOString(),
    score,
    xp_earned: xpEarned,
  });

  // Update streak + XP
  const today = todayISO();
  let { current_streak, longest_streak, last_activity_date, total_xp } = data.stats;

  if (last_activity_date !== today) {
    const gap = last_activity_date ? daysBetween(last_activity_date, today) : null;
    current_streak = gap === 1 ? current_streak + 1 : 1;
    last_activity_date = today;
  }

  longest_streak = Math.max(longest_streak, current_streak);
  total_xp += xpEarned;

  data.stats = { total_xp, current_streak, longest_streak, last_activity_date };
  save(data);

  res.json({
    score,
    xpEarned,
    results,
    stats: { total_xp, current_streak, longest_streak },
  });
});

// GET /api/stats — dashboard summary
router.get('/stats', (req, res) => {
  const data = load();
  const lessonsCompleted = new Set(data.progress.map((p) => p.lesson_id)).size;
  res.json({
    ...data.stats,
    lessonsCompleted,
    totalLessons: data.lessons.length,
  });
});

module.exports = router;
