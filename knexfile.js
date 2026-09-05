// Knex CLI configuration (`npx knex migrate:latest`, `npx knex seed:run`, etc.)
// and the config consumed by server/db/knex.js at runtime.
require('dotenv').config();

const connection = process.env.DATABASE_URL || 'postgres://microlearn:microlearn@localhost:5432/microlearn';

/** @type {import('knex').Knex.Config} */
const base = {
  client: 'pg',
  connection,
  migrations: {
    directory: './server/db/migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './server/db/seeds',
  },
};

module.exports = {
  development: base,
  production: base,
  // Used only by the automated test suite (tests/integration), which runs the
  // real migrations against pg-mem — an in-memory Postgres-compatible engine —
  // instead of a live server. See tests/integration/setup.js.
  test: base,
};
