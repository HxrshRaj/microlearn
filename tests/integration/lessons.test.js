const request = require('supertest');
const { buildTestApp } = require('./setup');

async function signup(app, username) {
  const agent = request.agent(app);
  await agent.post('/api/auth/signup').send({ username, email: `${username}@example.com`, password: 'password1' });
  return agent;
}

describe('lessons + progress (per-user isolation)', () => {
  let app;
  let knex;

  beforeEach(async () => {
    ({ app, knex } = await buildTestApp());
  });

  afterEach(async () => {
    await knex.destroy();
  });

  test('lesson list does not leak correct answers', async () => {
    const agent = await signup(app, 'alice');
    const lessons = await agent.get('/api/lessons');
    const lesson = await agent.get(`/api/lessons/${lessons.body[0].id}`);
    expect(lesson.body.questions[0]).not.toHaveProperty('correct_index');
    expect(Array.isArray(lesson.body.questions[0].options)).toBe(true);
  });

  test('two users completing the same lesson do not affect each other\'s progress or stats', async () => {
    const alice = await signup(app, 'alice');
    const bob = await signup(app, 'bob');

    const lessonsRes = await alice.get('/api/lessons');
    const lessonId = lessonsRes.body[0].id;
    const questions = await knex('questions').where({ lesson_id: lessonId });
    const perfectAnswers = {};
    questions.forEach((q) => { perfectAnswers[q.id] = q.correct_index; });

    await alice.post(`/api/lessons/${lessonId}/submit`).send({ answers: perfectAnswers });

    const aliceStats = await alice.get('/api/stats');
    const bobStats = await bob.get('/api/stats');

    expect(aliceStats.body.total_xp).toBeGreaterThan(0);
    expect(aliceStats.body.lessonsCompleted).toBe(1);

    expect(bobStats.body.total_xp).toBe(0);
    expect(bobStats.body.lessonsCompleted).toBe(0);

    const bobLessons = await bob.get('/api/lessons');
    expect(bobLessons.body.find((l) => l.id === lessonId).completed).toBe(false);

    const aliceLessons = await alice.get('/api/lessons');
    expect(aliceLessons.body.find((l) => l.id === lessonId).completed).toBe(true);
  });

  test('submitting a quiz records a progress row and returns per-question results', async () => {
    const agent = await signup(app, 'carol');
    const lessonsRes = await agent.get('/api/lessons');
    const lessonId = lessonsRes.body[0].id;
    const questions = await knex('questions').where({ lesson_id: lessonId });
    const wrongAnswers = {};
    questions.forEach((q) => { wrongAnswers[q.id] = (q.correct_index + 1) % 4; });

    const res = await agent.post(`/api/lessons/${lessonId}/submit`).send({ answers: wrongAnswers });
    expect(res.status).toBe(200);
    expect(res.body.score).toBe(0);
    expect(res.body.xpEarned).toBe(0);
    expect(res.body.results).toHaveLength(questions.length);

    const history = await agent.get('/api/history');
    expect(history.body).toHaveLength(1);
    expect(history.body[0].lesson_id).toBe(lessonId);
    expect(history.body[0].score).toBe(0);
  });

  test('history accumulates every attempt, not just the latest', async () => {
    const agent = await signup(app, 'dave');
    const lessonsRes = await agent.get('/api/lessons');
    const lessonId = lessonsRes.body[0].id;
    const questions = await knex('questions').where({ lesson_id: lessonId });
    const perfectAnswers = {};
    questions.forEach((q) => { perfectAnswers[q.id] = q.correct_index; });

    await agent.post(`/api/lessons/${lessonId}/submit`).send({ answers: perfectAnswers });
    await agent.post(`/api/lessons/${lessonId}/submit`).send({ answers: perfectAnswers });

    const history = await agent.get('/api/history');
    expect(history.body).toHaveLength(2);

    const scoped = await agent.get(`/api/history?lessonId=${lessonId}`);
    expect(scoped.body).toHaveLength(2);
  });

  test('category filter narrows the lesson list', async () => {
    const agent = await signup(app, 'erin');
    const categories = await agent.get('/api/categories');
    expect(categories.body.length).toBeGreaterThan(1);

    const targetCategory = categories.body[0];
    const filtered = await agent.get(`/api/lessons?category=${encodeURIComponent(targetCategory)}`);
    expect(filtered.body.length).toBeGreaterThan(0);
    expect(filtered.body.every((l) => l.category === targetCategory)).toBe(true);
  });

  test('profile reflects lifetime stats for the logged-in user only', async () => {
    const agent = await signup(app, 'frank');
    const lessonsRes = await agent.get('/api/lessons');
    const lessonId = lessonsRes.body[0].id;
    const questions = await knex('questions').where({ lesson_id: lessonId });
    const perfectAnswers = {};
    questions.forEach((q) => { perfectAnswers[q.id] = q.correct_index; });
    await agent.post(`/api/lessons/${lessonId}/submit`).send({ answers: perfectAnswers });

    const profile = await agent.get('/api/profile');
    expect(profile.body.username).toBe('frank');
    expect(profile.body.lessonsCompleted).toBe(1);
    expect(profile.body.totalAttempts).toBe(1);
    expect(profile.body.currentStreak).toBe(1);
  });

  test('leaderboard ranks users by XP and flags the requesting user', async () => {
    const alice = await signup(app, 'alice');
    const bob = await signup(app, 'bob');

    const lessonsRes = await alice.get('/api/lessons');
    const lessons = lessonsRes.body;
    const questionsFor = async (id) => knex('questions').where({ lesson_id: id });

    // alice completes two lessons, bob completes one -> alice should rank #1
    for (const lesson of lessons.slice(0, 2)) {
      const qs = await questionsFor(lesson.id);
      const answers = {};
      qs.forEach((q) => { answers[q.id] = q.correct_index; });
      await alice.post(`/api/lessons/${lesson.id}/submit`).send({ answers });
    }
    const bobQs = await questionsFor(lessons[0].id);
    const bobAnswers = {};
    bobQs.forEach((q) => { bobAnswers[q.id] = q.correct_index; });
    await bob.post(`/api/lessons/${lessons[0].id}/submit`).send({ answers: bobAnswers });

    const leaderboard = await alice.get('/api/leaderboard');
    expect(leaderboard.body[0].username).toBe('alice');
    expect(leaderboard.body[0].rank).toBe(1);
    expect(leaderboard.body[0].isYou).toBe(true);

    const bobView = await bob.get('/api/leaderboard');
    const bobRow = bobView.body.find((r) => r.username === 'bob');
    expect(bobRow.isYou).toBe(true);
    expect(bobRow.rank).toBeGreaterThan(1);
  });

  test('submitting to a nonexistent lesson returns 404', async () => {
    const agent = await signup(app, 'grace');
    const res = await agent.post('/api/lessons/999999/submit').send({ answers: {} });
    expect(res.status).toBe(404);
  });
});
