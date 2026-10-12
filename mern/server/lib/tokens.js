const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

const signAccess = (userId) => jwt.sign({ sub: String(userId) }, config.jwtAccessSecret, { expiresIn: config.accessTtl });
const signRefresh = (userId) =>
  // jti makes every refresh token unique even when issued in the same second.
  jwt.sign({ sub: String(userId), jti: crypto.randomUUID() }, config.jwtRefreshSecret, { expiresIn: config.refreshTtl });

const verifyAccess = (t) => jwt.verify(t, config.jwtAccessSecret);
const verifyRefresh = (t) => jwt.verify(t, config.jwtRefreshSecret);
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh, hashToken };
