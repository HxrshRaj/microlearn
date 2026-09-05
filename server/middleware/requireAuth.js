const { SESSION_COOKIE_NAME, getUserForToken } = require('../lib/session');

/**
 * Attaches req.user if a valid session cookie is present, but does not
 * reject the request either way. Useful for routes that behave differently
 * for logged-in vs anonymous users without requiring auth.
 */
function attachUser(knex) {
  return async (req, res, next) => {
    try {
      const token = req.cookies?.[SESSION_COOKIE_NAME];
      req.user = await getUserForToken(knex, token);
    } catch (err) {
      req.user = null;
    }
    next();
  };
}

/** Rejects the request with 401 unless attachUser has already found a user. */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  return next();
}

module.exports = { attachUser, requireAuth };
