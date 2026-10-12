const { Router } = require('express');
const c = require('../controllers/authController');
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/auth');
const authRateLimit = require('../middleware/rateLimit');

const r = Router();
r.post('/register', authRateLimit, validate(c.schemas.register), c.register);
r.post('/login', authRateLimit, validate(c.schemas.login), c.login);
r.post('/refresh', c.refresh);
r.post('/logout', c.logout);
r.get('/me', requireAuth, c.me);
module.exports = r;
