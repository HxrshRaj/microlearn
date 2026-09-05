const rateLimit = require('express-rate-limit');

// Auth endpoints are the classic brute-force target: cap attempts per IP
// well below what a real user would ever hit, but high enough that a
// legitimate typo-prone login doesn't get someone locked out.
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

module.exports = { authRateLimit };
