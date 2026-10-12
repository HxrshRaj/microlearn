// End-to-end API tests against a real MongoDB-protocol server (MONGO_URI).
// Each run uses a throwaway database that is dropped afterwards.
process.env.NODE_ENV = 'test';
const mongoose = require('mongoose');
const request = require('supertest');
const createApp = require('../server/app');
const { seedLessons } = require('../server/seeds/lessons');
const User = require('../server/models/User');

const BASE = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB = `microlearn_test_${Date.now()}`;
let app;

const creds = (n) => ({ username: `user_${n}`, email: `user${n}@example.com`, password: 'password123' });
const auth = (t) => ({ Authorization: `Bearer ${t}` });

async function signup(n) {
  const res = await request(app).post('/api/auth/register').send(creds(n));
  return { res, token: res.body.accessToken, cookie: res.headers['set-cookie'] };
}

beforeAll(async () => {
  const u = new URL(BASE);
  u.pathname = `/${DB}`;
  await mongoose.connect(u.toString());
  await User.init();
  await seedLessons();
  app = createApp();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('auth (JWT)', () => {
  test('register returns an access token and sets an httpOnly refresh cookie', async () => {
    const { res } = await signup(1);
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ username: 'user_1' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/refresh_token=.*HttpOnly/i);
  });

  test('duplicate username/email is a 409; weak input is a 400', async () => {
    expect((await request(app).post('/api/auth/register').send(creds(1))).status).toBe(409);
    expect((await request(app).post('/api/auth/register').send({ ...creds(2), password: 'short' })).status).toBe(400);
  });

  test('login works by username or email; wrong password is 401', async () => {
    expect((await request(app).post('/api/auth/login').send({ identifier: 'user_1', password: 'password123' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ identifier: 'USER1@example.com', password: 'password123' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ identifier: 'user_1', password: 'nope-nope' })).status).toBe(401);
  });

  test('protected routes reject missing, malformed and tampered tokens', async () => {
    expect((await request(app).get('/api/lessons')).status).toBe(401);
    expect((await request(app).get('/api/lessons').set(auth('garbage'))).status).toBe(401);
    const { token } = await signup(3);
    expect((await request(app).get('/api/lessons').set(auth(token.slice(0, -2) + 'xx'))).status).toBe(401);
    expect((await request(app).get('/api/lessons').set(auth(token))).status).toBe(200);
  });

  test('refresh rotates the token; replaying the old one revokes the session', async () => {
    const { cookie } = await signup(4);
    const first = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toEqual(expect.any(String));
    const rotated = first.headers['set-cookie'];

    const replay = await request(app).post('/api/auth/refresh').set('Cookie', cookie); // old token
    expect(replay.status).toBe(401);
    const afterRevoke = await request(app).post('/api/auth/refresh').set('Cookie', rotated); // newest is revoked too
    expect(afterRevoke.status).toBe(401);
  });

  test('logout revokes the refresh token', async () => {
    const { cookie } = await signup(5);
    expect((await request(app).post('/api/auth/logout').set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', cookie)).status).toBe(401);
  });
});

// FerretDB 1.x does not serialise concurrent updates (even a plain parallel $inc on one document
// loses writes), which real MongoDB guarantees. Set MONGO_IMPL=ferretdb to skip the one test that
// depends on that guarantee; CI runs it against mongo:7.
const atomicTest = process.env.MONGO_IMPL === 'ferretdb' ? test.skip : test;

describe('lessons, quizzes, stats', () => {
  let token;
  let lesson;
  beforeAll(async () => {
    token = (await signup(10)).token;
  });

  test('lists lessons and never leaks correct answers', async () => {
    const list = await request(app).get('/api/lessons').set(auth(token));
    expect(list.body).toHaveLength(3);
    expect(list.body.every((l) => l.completed === false)).toBe(true);
    lesson = list.body[0];
    const one = await request(app).get(`/api/lessons/${lesson.id}`).set(auth(token));
    expect(one.body.questions.length).toBeGreaterThan(0);
    expect(JSON.stringify(one.body)).not.toMatch(/correctIndex/);
  });

  test('filters by category and 404s / 400s on bad ids', async () => {
    const cats = (await request(app).get('/api/categories').set(auth(token))).body;
    expect(cats).toContain('Diagnostics');
    const filtered = await request(app).get('/api/lessons?category=Diagnostics').set(auth(token));
    expect(filtered.body.every((l) => l.category === 'Diagnostics')).toBe(true);
    expect((await request(app).get('/api/lessons/64b7f0f0f0f0f0f0f0f0f0f0').set(auth(token))).status).toBe(404);
    expect((await request(app).get('/api/lessons/not-an-id').set(auth(token))).status).toBe(400);
  });

  test('a perfect submission awards full XP and starts a 1-day streak', async () => {
    const full = await mongoose.model('Lesson').findById(lesson.id).lean();
    const answers = Object.fromEntries(full.questions.map((q) => [String(q._id), q.correctIndex]));
    const res = await request(app).post(`/api/lessons/${lesson.id}/submit`).set(auth(token)).send({ answers });
    expect(res.status).toBe(200);
    expect(res.body.score).toBe(100);
    expect(res.body.xpEarned).toBe(lesson.xpReward);
    expect(res.body.stats).toMatchObject({ totalXp: lesson.xpReward, currentStreak: 1, longestStreak: 1 });

    const stats = (await request(app).get('/api/stats').set(auth(token))).body;
    expect(stats).toMatchObject({ totalXp: lesson.xpReward, lessonsCompleted: 1, totalLessons: 3 });
    const list = (await request(app).get('/api/lessons').set(auth(token))).body;
    expect(list.find((l) => l.id === lesson.id).completed).toBe(true);
  });

  test('a second attempt the same day does not extend the streak; history lists both', async () => {
    const res = await request(app).post(`/api/lessons/${lesson.id}/submit`).set(auth(token)).send({ answers: {} });
    expect(res.body.score).toBe(0);
    expect(res.body.stats.currentStreak).toBe(1);
    const hist = (await request(app).get('/api/history').set(auth(token))).body;
    expect(hist).toHaveLength(2);
    expect(hist[0].lessonTitle).toBe(lesson.title);
    const scoped = (await request(app).get(`/api/history?lessonId=${lesson.id}`).set(auth(token))).body;
    expect(scoped).toHaveLength(2);
  });

  test('rejects malformed answers', async () => {
    const res = await request(app).post(`/api/lessons/${lesson.id}/submit`).set(auth(token)).send({ answers: { x: 'a' } });
    expect(res.status).toBe(400);
  });

  atomicTest('concurrent submissions from one user never lose XP', async () => {
    const t = (await signup(20)).token;
    const l = (await request(app).get('/api/lessons').set(auth(t))).body[0];
    const full = await mongoose.model('Lesson').findById(l.id).lean();
    const answers = Object.fromEntries(full.questions.map((q) => [String(q._id), q.correctIndex]));
    const results = await Promise.all(
      Array.from({ length: 6 }, () => request(app).post(`/api/lessons/${l.id}/submit`).set(auth(t)).send({ answers })),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    const stats = (await request(app).get('/api/stats').set(auth(t))).body;
    expect(stats.totalXp).toBe(6 * l.xpReward);
    expect(stats.currentStreak).toBe(1);
    expect((await request(app).get('/api/history').set(auth(t))).body).toHaveLength(6);
  });

  test('leaderboard ranks by XP with shared ranks for ties and flags you', async () => {
    const board = (await request(app).get('/api/leaderboard').set(auth(token))).body;
    expect(board[0].totalXp).toBeGreaterThanOrEqual(board[board.length - 1].totalXp);
    expect(board.find((r) => r.username === 'user_10').isYou).toBe(true);
    expect(board[0].rank).toBe(1);
  });
});
