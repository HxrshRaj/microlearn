// End-to-end test of the NestJS port against REAL PostgreSQL (not pg-mem).
// Skipped unless E2E_DATABASE_URL is set, e.g.
//   E2E_DATABASE_URL=postgres://microlearn:microlearn@localhost:5432/microlearn_e2e npx jest tests/e2e
// The database is migrated + seeded by the test; use a throwaway database.
const request = require('supertest');
const knexLib = require('knex');
const path = require('path');

const url = process.env.E2E_DATABASE_URL;
const maybe = url ? describe : describe.skip;

maybe('NestJS API on real PostgreSQL', () => {
  let knex;
  let nestApp;

  beforeAll(async () => {
    knex = knexLib({
      client: 'pg',
      connection: url,
      migrations: { directory: path.join(__dirname, '..', '..', 'server', 'db', 'migrations') },
      seeds: { directory: path.join(__dirname, '..', '..', 'server', 'db', 'seeds') },
    });
    await knex.migrate.rollback(undefined, true);
    await knex.migrate.latest();
    await knex.seed.run();
    const { createNestApp } = require('../../nest/dist/create-app');
    nestApp = await createNestApp(knex);
  });

  afterAll(async () => {
    await nestApp.close();
    await knex.destroy();
  });

  test('signup -> list -> perfect submit -> stats -> leaderboard', async () => {
    const agent = request.agent(nestApp.getHttpServer());
    await agent.post('/api/auth/signup').send({ username: 'pgalice', email: 'pgalice@example.com', password: 'password1' }).expect(201);
    const lessons = (await agent.get('/api/lessons').expect(200)).body;
    expect(lessons.length).toBeGreaterThan(0);
    const questions = await knex('questions').where({ lesson_id: lessons[0].id });
    const answers = Object.fromEntries(questions.map((q) => [q.id, q.correct_index]));
    const res = await agent.post(`/api/lessons/${lessons[0].id}/submit`).send({ answers }).expect(200);
    expect(res.body.score).toBe(100);
    const stats = (await agent.get('/api/stats')).body;
    expect(stats.total_xp).toBe(res.body.xpEarned);
    const board = (await agent.get('/api/leaderboard')).body;
    expect(board[0]).toMatchObject({ rank: 1, username: 'pgalice', isYou: true });
  });

  test('concurrent submits from one user never lose XP (row lock on user_stats)', async () => {
    const agent = request.agent(nestApp.getHttpServer());
    await agent.post('/api/auth/signup').send({ username: 'pgbob', email: 'pgbob@example.com', password: 'password1' }).expect(201);
    const lesson = (await agent.get('/api/lessons')).body[0];
    const questions = await knex('questions').where({ lesson_id: lesson.id });
    const answers = Object.fromEntries(questions.map((q) => [q.id, q.correct_index]));
    const N = 12;
    const results = await Promise.all(Array.from({ length: N }, () => agent.post(`/api/lessons/${lesson.id}/submit`).send({ answers })));
    results.forEach((r) => expect(r.status).toBe(200));
    const stats = (await agent.get('/api/stats')).body;
    expect(stats.total_xp).toBe(N * lesson.xp_reward);
    const [{ count }] = await knex('progress').whereIn('user_id', knex('users').select('id').where({ username: 'pgbob' })).count('id as count');
    expect(Number(count)).toBe(N);
  });
});
