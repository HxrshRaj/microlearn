const request = require('supertest');
const { buildTestApp } = require('./setup');

describe('auth routes', () => {
  let app;
  let knex;

  beforeEach(async () => {
    ({ app, knex } = await buildTestApp());
  });

  afterEach(async () => {
    await knex.destroy();
  });

  test('signup creates a user, hashes the password, and starts a session', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'alice', email: 'alice@example.com', password: 'password1' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ username: 'alice', email: 'alice@example.com' });
    expect(res.headers['set-cookie'][0]).toMatch(/ml_session=/);
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/);

    const stored = await knex('users').where({ username: 'alice' }).first();
    expect(stored.password_hash).not.toBe('password1');

    const stats = await knex('user_stats').where({ user_id: stored.id }).first();
    expect(stats).toBeTruthy(); // user_stats row created alongside the user
  });

  test('signup rejects a weak password before touching the database', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'bob', email: 'bob@example.com', password: 'weak' });

    expect(res.status).toBe(400);
    const stored = await knex('users').where({ username: 'bob' }).first();
    expect(stored).toBeUndefined();
  });

  test('signup rejects a duplicate email or username', async () => {
    await request(app).post('/api/auth/signup').send({ username: 'carol', email: 'carol@example.com', password: 'password1' });

    const dupEmail = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'someoneelse', email: 'carol@example.com', password: 'password1' });
    expect(dupEmail.status).toBe(409);

    const dupUsername = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'carol', email: 'someoneelse@example.com', password: 'password1' });
    expect(dupUsername.status).toBe(409);
  });

  test('login succeeds with correct credentials and fails with incorrect ones', async () => {
    await request(app).post('/api/auth/signup').send({ username: 'dan', email: 'dan@example.com', password: 'password1' });

    const goodLogin = await request(app).post('/api/auth/login').send({ email: 'dan@example.com', password: 'password1' });
    expect(goodLogin.status).toBe(200);
    expect(goodLogin.headers['set-cookie'][0]).toMatch(/ml_session=/);

    const badPassword = await request(app).post('/api/auth/login').send({ email: 'dan@example.com', password: 'wrong-password' });
    expect(badPassword.status).toBe(401);

    const unknownEmail = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'password1' });
    expect(unknownEmail.status).toBe(401);

    // Same message for both failure modes -- don't help enumerate accounts.
    expect(badPassword.body.error).toBe(unknownEmail.body.error);
  });

  test('protected routes reject requests with no session', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(401);
  });

  test('logout invalidates the session', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({ username: 'erin', email: 'erin@example.com', password: 'password1' });

    expect((await agent.get('/api/stats')).status).toBe(200);

    await agent.post('/api/auth/logout');

    expect((await agent.get('/api/stats')).status).toBe(401);
  });

  test('GET /api/auth/me reflects the current session without requiring one', async () => {
    const anon = await request(app).get('/api/auth/me');
    expect(anon.status).toBe(200);
    expect(anon.body.user).toBeNull();

    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({ username: 'frank', email: 'frank@example.com', password: 'password1' });
    const loggedIn = await agent.get('/api/auth/me');
    expect(loggedIn.body.user.username).toBe('frank');
  });
});
