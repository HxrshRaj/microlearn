// DB-backed session management.
//
// Why sessions instead of a JWT: revocation is a single DELETE (logout, or
// an admin killing a compromised session) instead of needing a token
// blacklist or living with "it's valid until it expires no matter what".
// This app is a single Express process with a database already in the
// request path, so JWT's main selling point -- avoiding a DB read per
// request -- doesn't buy much here.
//
// The token that goes in the browser's cookie is a random opaque value.
// Only its SHA-256 hash is ever stored in the `sessions` table, so a leaked
// database read (backup, SQL injection elsewhere, etc.) doesn't hand over
// usable session tokens -- same principle as not storing plaintext passwords.
const crypto = require('crypto');

const SESSION_COOKIE_NAME = 'ml_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * @param {import('knex').Knex} knex
 * @param {number} userId
 * @param {{userAgent?: string}} [opts]
 * @returns {Promise<{token: string, expiresAt: Date}>}
 */
async function createSession(knex, userId, opts = {}) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await knex('sessions').insert({
    id: hashToken(token),
    user_id: userId,
    expires_at: expiresAt,
    user_agent: opts.userAgent || null,
  });

  return { token, expiresAt };
}

/**
 * Resolves a raw cookie token to its user, or null if the session doesn't
 * exist or has expired. Expired sessions are lazily cleaned up here.
 * @param {import('knex').Knex} knex
 * @param {string} token
 */
async function getUserForToken(knex, token) {
  if (!token) return null;
  const id = hashToken(token);

  const row = await knex('sessions')
    .join('users', 'users.id', 'sessions.user_id')
    .where('sessions.id', id)
    .select(
      'users.id',
      'users.username',
      'users.email',
      'users.created_at',
      'sessions.expires_at',
    )
    .first();

  if (!row) return null;

  if (new Date(row.expires_at) <= new Date()) {
    await knex('sessions').where({ id }).del();
    return null;
  }

  const { expires_at: _expiresAt, ...user } = row;
  return user;
}

async function destroySession(knex, token) {
  if (!token) return;
  await knex('sessions').where({ id: hashToken(token) }).del();
}

module.exports = {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  createSession,
  getUserForToken,
  destroySession,
};
