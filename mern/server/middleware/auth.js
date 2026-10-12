const User = require('../models/User');
const HttpError = require('../lib/httpError');
const { verifyAccess } = require('../lib/tokens');

// Verifies the `Authorization: Bearer <jwt>` header and loads the user.
module.exports = async function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(new HttpError(401, 'Authentication required.'));
  let payload;
  try {
    payload = verifyAccess(token);
  } catch {
    return next(new HttpError(401, 'Invalid or expired token.'));
  }
  const user = await User.findById(payload.sub);
  if (!user) return next(new HttpError(401, 'Account no longer exists.'));
  req.user = user;
  next();
};
