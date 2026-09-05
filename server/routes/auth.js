const express = require('express');
const { z } = require('zod');
const {
  hashPassword,
  verifyPassword,
  isValidEmail,
  validateUsername,
  validatePassword,
} = require('../lib/auth');
const { SESSION_COOKIE_NAME, SESSION_TTL_MS, createSession, destroySession } = require('../lib/session');

const signupSchema = z.object({
  username: z.string(),
  email: z.string(),
  password: z.string(),
});

const loginSchema = z.object({
  email: z.string(),
  password: z.string(),
});

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/',
  };
}

function publicUser(user) {
  return { id: user.id, username: user.username, email: user.email, createdAt: user.created_at };
}

/** @param {import('knex').Knex} knex */
module.exports = function createAuthRouter(knex) {
  const router = express.Router();

  router.post('/signup', async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'username, email, and password are required.' });
    }
    const { username, email, password } = parsed.data;

    const usernameCheck = validateUsername(username);
    if (!usernameCheck.valid) return res.status(400).json({ error: usernameCheck.reason });

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) return res.status(400).json({ error: passwordCheck.reason });

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await knex('users')
      .where({ email: normalizedEmail })
      .orWhere({ username })
      .first();
    if (existing) {
      return res.status(409).json({ error: 'An account with that email or username already exists.' });
    }

    const passwordHash = await hashPassword(password);

    const user = await knex.transaction(async (trx) => {
      const [created] = await trx('users')
        .insert({ username, email: normalizedEmail, password_hash: passwordHash })
        .returning(['id', 'username', 'email', 'created_at']);
      await trx('user_stats').insert({ user_id: created.id });
      return created;
    });

    const { token } = await createSession(knex, user.id, { userAgent: req.get('user-agent') });
    res.cookie(SESSION_COOKIE_NAME, token, cookieOptions());
    res.status(201).json({ user: publicUser(user) });
  });

  router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'email and password are required.' });
    }
    const { email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Same error message whether the email doesn't exist or the password is
    // wrong -- don't help an attacker enumerate registered accounts.
    const genericError = { error: 'Invalid email or password.' };

    const user = await knex('users').where({ email: normalizedEmail }).first();
    if (!user) return res.status(401).json(genericError);

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return res.status(401).json(genericError);

    const { token } = await createSession(knex, user.id, { userAgent: req.get('user-agent') });
    res.cookie(SESSION_COOKIE_NAME, token, cookieOptions());
    res.json({ user: publicUser(user) });
  });

  router.post('/logout', async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    await destroySession(knex, token);
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.status(204).end();
  });

  router.get('/me', async (req, res) => {
    res.json({ user: req.user ? publicUser({ ...req.user, created_at: req.user.created_at }) : null });
  });

  return router;
};
