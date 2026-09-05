const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const { attachUser, requireAuth } = require('./middleware/requireAuth');
const { authRateLimit } = require('./middleware/rateLimit');
const createAuthRouter = require('./routes/auth');
const createApiRouter = require('./routes/api');

/**
 * Builds the Express app. Takes a Knex instance rather than importing the
 * shared singleton directly, so tests can pass in a pg-mem-backed instance
 * instead of connecting to a real database.
 * @param {import('knex').Knex} knex
 */
function createApp(knex) {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());
  app.use(attachUser(knex));

  app.use('/api/auth', authRateLimit, createAuthRouter(knex));
  app.use('/api', requireAuth, createApiRouter(knex));

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  // Fallback error handler: never leak stack traces to the client.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}

module.exports = createApp;
