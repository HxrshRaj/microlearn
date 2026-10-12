const bcrypt = require('bcryptjs');
const { z } = require('zod');
const User = require('../models/User');
const HttpError = require('../lib/httpError');
const config = require('../config');
const { signAccess, signRefresh, verifyRefresh, hashToken } = require('../lib/tokens');

const schemas = {
  register: z.object({
    username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'letters, numbers, underscore only'),
    email: z.string().trim().email(),
    password: z.string().min(8).max(128),
  }),
  login: z.object({ identifier: z.string().trim().min(1), password: z.string().min(1) }),
};

const COOKIE = 'refresh_token';
const cookieOpts = {
  httpOnly: true,
  sameSite: config.isProd ? 'none' : 'lax',
  secure: config.isProd,
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const publicUser = (u) => ({ id: u.id, username: u.username, email: u.email });

// Issue a new access + refresh pair and remember the refresh token's hash (rotation).
async function issueTokens(user, res) {
  const refresh = signRefresh(user.id);
  user.refreshTokenHash = hashToken(refresh);
  await user.save();
  res.cookie(COOKIE, refresh, cookieOpts);
  return { accessToken: signAccess(user.id), user: publicUser(user) };
}

async function register(req, res) {
  const { username, email, password } = req.body;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = new User({ username, email, passwordHash });
  try {
    await user.save();
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, 'That username or email is already registered.');
    throw err;
  }
  res.status(201).json(await issueTokens(user, res));
}

async function login(req, res) {
  const { identifier, password } = req.body;
  const id = identifier.toLowerCase();
  const user = await User.findOne({ $or: [{ username: id }, { email: id }] });
  // Same message whether the account or the password was wrong: don't leak which.
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new HttpError(401, 'Invalid credentials.');
  res.json(await issueTokens(user, res));
}

// Exchanges a valid refresh cookie for a fresh pair. A refresh token that is
// validly signed but no longer the current one (already rotated => likely
// stolen/replayed) revokes the session entirely.
async function refresh(req, res) {
  const token = req.cookies?.[COOKIE];
  if (!token) throw new HttpError(401, 'No session.');
  let payload;
  try {
    payload = verifyRefresh(token);
  } catch {
    throw new HttpError(401, 'Session expired.');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw new HttpError(401, 'Session expired.');
  if (user.refreshTokenHash !== hashToken(token)) {
    user.refreshTokenHash = null;
    await user.save();
    res.clearCookie(COOKIE, { ...cookieOpts, maxAge: undefined });
    throw new HttpError(401, 'Refresh token reuse detected. Please sign in again.');
  }
  res.json(await issueTokens(user, res));
}

async function logout(req, res) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const { sub } = verifyRefresh(token);
      await User.updateOne({ _id: sub }, { $set: { refreshTokenHash: null } });
    } catch {
      /* already invalid: nothing to revoke */
    }
  }
  res.clearCookie(COOKIE, { ...cookieOpts, maxAge: undefined });
  res.json({ ok: true });
}

const me = (req, res) => res.json({ user: publicUser(req.user) });

module.exports = { schemas, register, login, refresh, logout, me };
