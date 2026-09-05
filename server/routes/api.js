const express = require('express');
const { scoreQuiz, computeXp } = require('../lib/scoring');
const { todayISO, applyActivity } = require('../lib/streak');

/** @param {import('knex').Knex} knex */
module.exports = function createApiRouter(knex) {
  const router = express.Router();

  // GET /api/categories — distinct lesson categories, for dashboard filtering
  router.get('/categories', async (req, res) => {
    const rows = await knex('lessons').distinct('category').orderBy('category');
    res.json(rows.map((r) => r.category));
  });

  // GET /api/lessons — list all lessons, with per-user completion status
  router.get('/lessons', async (req, res) => {
    const { category } = req.query;

    let query = knex('lessons').select('id', 'title', 'category', 'summary', 'xp_reward').orderBy('sort_order');
    if (category) query = query.where({ category });
    const lessons = await query;

    const completedIds = new Set(
      (await knex('progress').where({ user_id: req.user.id }).distinct('lesson_id')).map((r) => r.lesson_id),
    );

    res.json(lessons.map((l) => ({ ...l, completed: completedIds.has(l.id) })));
  });

  // GET /api/lessons/:id — a single lesson with its questions (no answers leaked)
  router.get('/lessons/:id', async (req, res) => {
    const lesson = await knex('lessons').where({ id: req.params.id }).first();
    if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });

    const questions = await knex('questions')
      .where({ lesson_id: lesson.id })
      .orderBy('sort_order')
      .select('id', 'prompt', 'options');

    res.json({ ...lesson, questions });
  });

  // POST /api/lessons/:id/submit — { answers: { questionId: selectedIndex } }
  router.post('/lessons/:id/submit', async (req, res) => {
    const lesson = await knex('lessons').where({ id: req.params.id }).first();
    if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });

    const questions = await knex('questions').where({ lesson_id: lesson.id }).select('id', 'correct_index');
    const answers = req.body.answers || {};

    const { score, results } = scoreQuiz(questions, answers);
    const xpEarned = computeXp(score, lesson.xp_reward);
    const userId = req.user.id;

    const stats = await knex.transaction(async (trx) => {
      await trx('progress').insert({
        user_id: userId,
        lesson_id: lesson.id,
        score,
        xp_earned: xpEarned,
      });

      // Row is guaranteed to exist — created at signup — but lock it for
      // update so two concurrent submits from the same user can't race on
      // the streak calculation.
      const current = await trx('user_stats').where({ user_id: userId }).forUpdate().first();

      const updated = applyActivity(
        {
          currentStreak: current.current_streak,
          longestStreak: current.longest_streak,
          lastActivityDate: current.last_activity_date,
        },
        todayISO(),
      );

      // Coerce: some drivers (and pg-mem, used in tests) hand back integer
      // columns as strings, and `string + number` silently concatenates
      // instead of adding.
      const totalXp = Number(current.total_xp) + xpEarned;

      await trx('user_stats').where({ user_id: userId }).update({
        total_xp: totalXp,
        current_streak: updated.currentStreak,
        longest_streak: updated.longestStreak,
        last_activity_date: updated.lastActivityDate,
        updated_at: trx.fn.now(),
      });

      return {
        total_xp: totalXp,
        current_streak: updated.currentStreak,
        longest_streak: updated.longestStreak,
      };
    });

    res.json({ score, xpEarned, results, stats });
  });

  // GET /api/stats — dashboard summary for the logged-in user
  router.get('/stats', async (req, res) => {
    const userId = req.user.id;
    const stats = await knex('user_stats').where({ user_id: userId }).first();
    const [{ count: lessonsCompleted }] = await knex('progress')
      .where({ user_id: userId })
      .countDistinct('lesson_id as count');
    const [{ count: totalLessons }] = await knex('lessons').count('id as count');

    res.json({
      total_xp: Number(stats.total_xp),
      current_streak: Number(stats.current_streak),
      longest_streak: Number(stats.longest_streak),
      last_activity_date: stats.last_activity_date,
      lessonsCompleted: Number(lessonsCompleted),
      totalLessons: Number(totalLessons),
    });
  });

  // GET /api/history — every past attempt for the logged-in user, newest first.
  // Optional ?lessonId= to scope to one lesson (score-over-time for that lesson).
  router.get('/history', async (req, res) => {
    const userId = req.user.id;
    let query = knex('progress')
      .join('lessons', 'lessons.id', 'progress.lesson_id')
      .where('progress.user_id', userId)
      .select(
        'progress.id',
        'progress.lesson_id',
        'lessons.title as lesson_title',
        'lessons.category as lesson_category',
        'progress.score',
        'progress.xp_earned',
        'progress.completed_at',
      )
      .orderBy('progress.completed_at', 'desc');

    if (req.query.lessonId) {
      query = query.where('progress.lesson_id', req.query.lessonId);
    }

    res.json(await query);
  });

  // GET /api/profile — account info + lifetime stats for the logged-in user
  router.get('/profile', async (req, res) => {
    const userId = req.user.id;
    const stats = await knex('user_stats').where({ user_id: userId }).first();
    const [{ count: lessonsCompleted }] = await knex('progress')
      .where({ user_id: userId })
      .countDistinct('lesson_id as count');
    const [{ count: totalAttempts }] = await knex('progress').where({ user_id: userId }).count('id as count');

    res.json({
      username: req.user.username,
      email: req.user.email,
      joinDate: req.user.created_at,
      totalXp: Number(stats.total_xp),
      currentStreak: Number(stats.current_streak),
      longestStreak: Number(stats.longest_streak),
      lessonsCompleted: Number(lessonsCompleted),
      totalAttempts: Number(totalAttempts),
    });
  });

  // GET /api/leaderboard — top users by XP, ranked (ties share a rank).
  // The aggregation/sort (the interesting part of this query) happens in
  // SQL; rank numbers are assigned in JS afterwards rather than via a SQL
  // window function (`RANK() OVER (...)`) so the same code path works
  // identically against every SQL engine this project touches, including
  // the in-memory one the test suite runs against — cheap to do here since
  // the result set is already capped at 20 rows.
  router.get('/leaderboard', async (req, res) => {
    const rows = await knex('user_stats')
      .join('users', 'users.id', 'user_stats.user_id')
      .select('users.username', 'user_stats.total_xp', 'user_stats.longest_streak')
      .orderBy('user_stats.total_xp', 'desc')
      .orderBy('users.username', 'asc')
      .limit(20);

    let rank = 0;
    let lastXp = null;
    const leaderboard = rows.map((r, i) => {
      const totalXp = Number(r.total_xp);
      if (totalXp !== lastXp) {
        rank = i + 1;
        lastXp = totalXp;
      }
      return {
        rank,
        username: r.username,
        totalXp,
        longestStreak: Number(r.longest_streak),
        isYou: r.username === req.user.username,
      };
    });

    res.json(leaderboard);
  });

  return router;
};
