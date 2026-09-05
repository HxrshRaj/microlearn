// Pure(-ish) auth building blocks: password hashing and input validation.
// Deliberately dependency-light and DB-free so this is straightforward to
// unit test (see tests/unit/auth.test.js) without spinning up a database.
const bcrypt = require('bcryptjs');

// bcryptjs is a pure-JS implementation (no native compile step), matching
// this project's existing "installs cleanly on any Node host" philosophy
// (see server/db.js's original comment). It's slower than native bcrypt or
// argon2, but for an app this size that tradeoff is worth the zero-build-step
// deploy story.
//
// The cost factor is deliberately lower under test (Jest sets NODE_ENV=test
// automatically): 12 rounds is real, load-bearing security in production,
// but the test suite hashes/verifies passwords dozens of times across two
// full auth flows per test, and bcrypt's cost is *designed* to be slow --
// running production rounds there just risks flaky CI timeouts on a slower
// runner for zero extra test confidence (verifyPassword works identically
// regardless of the cost factor used at hash time; it's embedded in the hash).
const SALT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

async function verifyPassword(plainPassword, passwordHash) {
  if (!passwordHash) return false;
  return bcrypt.compare(plainPassword, passwordHash);
}

// Deliberately conservative charset (not the full RFC 5322 grammar) — this
// is a signup form, not an email-parsing library, and keeping it narrow
// means a stray '<', '"', etc. in the input can never reach a template.
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}$/;

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_RE.test(email);
}

// 3-20 chars, letters/numbers/underscore/hyphen, must start with a letter or number.
const USERNAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,19}$/;

function validateUsername(username) {
  if (typeof username !== 'string') return { valid: false, reason: 'Username is required.' };
  if (!USERNAME_RE.test(username)) {
    return {
      valid: false,
      reason: 'Username must be 3-20 characters and contain only letters, numbers, underscores, or hyphens.',
    };
  }
  return { valid: true };
}

// At least 8 characters, at least one letter and one number. Intentionally
// not requiring symbols/mixed-case: length is a stronger predictor of actual
// crack resistance than symbol requirements that push people toward "P@ss1".
function validatePassword(password) {
  if (typeof password !== 'string') return { valid: false, reason: 'Password is required.' };
  if (password.length < 8) return { valid: false, reason: 'Password must be at least 8 characters.' };
  if (password.length > 72) return { valid: false, reason: 'Password must be 72 characters or fewer.' };
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one letter and one number.' };
  }
  return { valid: true };
}

module.exports = {
  hashPassword,
  verifyPassword,
  isValidEmail,
  validateUsername,
  validatePassword,
};
