const { z } = require('zod');
const Lesson = require('../models/Lesson');
const Attempt = require('../models/Attempt');
const User = require('../models/User');
const HttpError = require('../lib/httpError');
const { scoreQuiz, computeXp } = require('../lib/scoring');
const { todayISO, applyActivity } = require('../lib/streak');

const submitSchema = z.object({ answers: z.record(z.string(), z.number().int().min(0).max(20)).default({}) });

async function categories(req, res) {
  res.json((await Lesson.distinct('category')).sort());
}

async function list(req, res) {
  const filter = req.query.category ? { category: String(req.query.category) } : {};
  const lessons = await Lesson.find(filter).sort({ sortOrder: 1 }).select('title category summary xpReward');
  const done = new Set((await Attempt.distinct('lesson', { user: req.user._id })).map(String));
  res.json(lessons.map((l) => ({ id: l.id, title: l.title, category: l.category, summary: l.summary, xpReward: l.xpReward, completed: done.has(l.id) })));
}

async function getOne(req, res) {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) throw new HttpError(404, 'Lesson not found.');
  res.json({
    id: lesson.id,
    title: lesson.title,
    category: lesson.category,
    summary: lesson.summary,
    xpReward: lesson.xpReward,
    // correctIndex is deliberately never sent before submission.
    questions: lesson.questions.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options })),
  });
}

// XP is added with $inc (atomic per document, so concurrent submissions can't lose
// updates). The streak is "claimed" once per calendar day: the filter
// lastActivityDate != today lets exactly one request through to run the
// streak calculation (from the document as it was *before* its update);
// every other same-day request only increments XP.
async function applyStats(userId, xpEarned) {
  const today = todayISO();
  const before = await User.findOneAndUpdate(
    { _id: userId, 'stats.lastActivityDate': { $ne: today } },
    { $set: { 'stats.lastActivityDate': today }, $inc: { 'stats.totalXp': xpEarned } },
    { returnDocument: 'before' },
  );
  if (before) {
    const next = applyActivity(
      { currentStreak: before.stats.currentStreak, longestStreak: before.stats.longestStreak, lastActivityDate: before.stats.lastActivityDate },
      today,
    );
    await User.updateOne({ _id: userId }, { $set: { 'stats.currentStreak': next.currentStreak, 'stats.longestStreak': next.longestStreak } });
  } else {
    await User.updateOne({ _id: userId }, { $inc: { 'stats.totalXp': xpEarned } });
  }
  const { stats } = await User.findById(userId).select('stats').lean();
  return { totalXp: stats.totalXp, currentStreak: stats.currentStreak, longestStreak: stats.longestStreak };
}

async function submit(req, res) {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) throw new HttpError(404, 'Lesson not found.');
  const { answers } = submitSchema.parse(req.body ?? {});

  const { score, results } = scoreQuiz(
    lesson.questions.map((q) => ({ id: q.id, correct_index: q.correctIndex })),
    answers,
  );
  const xpEarned = computeXp(score, lesson.xpReward);

  const attempt = await Attempt.create({ user: req.user._id, lesson: lesson._id, score, xpEarned });
  let stats;
  try {
    stats = await applyStats(req.user._id, xpEarned);
  } catch (err) {
    await Attempt.deleteOne({ _id: attempt._id }); // don't leave an attempt whose XP never landed
    throw err;
  }
  res.json({ score, xpEarned, results, stats });
}

async function history(req, res) {
  const filter = { user: req.user._id };
  if (req.query.lessonId) filter.lesson = String(req.query.lessonId);
  const attempts = await Attempt.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  const lessons = await Lesson.find({ _id: { $in: [...new Set(attempts.map((a) => String(a.lesson)))] } })
    .select('title category')
    .lean();
  const byId = new Map(lessons.map((l) => [String(l._id), l]));
  res.json(
    attempts.map((a) => ({
      id: String(a._id),
      lessonId: String(a.lesson),
      lessonTitle: byId.get(String(a.lesson))?.title,
      lessonCategory: byId.get(String(a.lesson))?.category,
      score: a.score,
      xpEarned: a.xpEarned,
      completedAt: a.createdAt,
    })),
  );
}

async function stats(req, res) {
  const s = req.user.stats;
  res.json({
    totalXp: s.totalXp,
    currentStreak: s.currentStreak,
    longestStreak: s.longestStreak,
    lastActivityDate: s.lastActivityDate,
    lessonsCompleted: (await Attempt.distinct('lesson', { user: req.user._id })).length,
    totalLessons: await Lesson.countDocuments(),
  });
}

async function leaderboard(req, res) {
  const users = await User.find().sort({ 'stats.totalXp': -1, username: 1 }).limit(20).select('username stats').lean();
  let rank = 0;
  let last = null;
  res.json(
    users.map((u, i) => {
      if (u.stats.totalXp !== last) {
        rank = i + 1;
        last = u.stats.totalXp;
      }
      return { rank, username: u.username, totalXp: u.stats.totalXp, longestStreak: u.stats.longestStreak, isYou: String(u._id) === req.user.id };
    }),
  );
}

module.exports = { categories, list, getOne, submit, history, stats, leaderboard };
