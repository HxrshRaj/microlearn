require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';

function required(name, fallback) {
  const v = process.env[name] || fallback;
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

module.exports = {
  isProd,
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/microlearn',
  // In production a real secret is mandatory; the dev fallback exists only so
  // `npm run dev` works out of the box and is rejected when NODE_ENV=production.
  jwtAccessSecret: isProd ? required('JWT_ACCESS_SECRET') : process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
  jwtRefreshSecret: isProd ? required('JWT_REFRESH_SECRET') : process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  accessTtl: process.env.ACCESS_TTL || '15m',
  refreshTtl: process.env.REFRESH_TTL || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};
