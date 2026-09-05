// Builds a fresh app + database for each integration test file.
//
// Uses pg-mem (an in-memory Postgres-compatible engine) instead of a live
// Postgres server, running the REAL migration and seed files from
// server/db/migrations and server/db/seeds -- so this exercises the actual
// schema and application code, just without a real network/DB process.
// See the "Testing" section of the README for why, and what this does and
// doesn't cover.
const { newDb } = require('pg-mem');
const createApp = require('../../server/app');

async function buildTestApp() {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.registerFunction({
    name: 'current_database',
    implementation: () => 'microlearn_test',
    impure: true,
  });

  const path = require('path');
  const knex = db.adapters.createKnex(0, {
    // Absolute paths: knex resolves relative migration/seed directories
    // against process.cwd(), which is reliable via `npm test` but not
    // guaranteed for every test runner/IDE integration.
    migrations: { directory: path.join(__dirname, '..', '..', 'server', 'db', 'migrations') },
    seeds: { directory: path.join(__dirname, '..', '..', 'server', 'db', 'seeds') },
  });

  await knex.migrate.latest();
  await knex.seed.run();

  const app = createApp(knex);
  return { app, knex };
}

module.exports = { buildTestApp };
