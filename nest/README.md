# nest/ — NestJS (TypeScript) port of the MicroLearn API

A wire-compatible port of the Express server in `../server`: same routes, status codes, cookie, error shape
(`{ "error": "..." }`) and Postgres schema (it reuses the Knex migrations), so the existing frontend works unchanged.

```
cd nest && npm install && npm run build
DATABASE_URL=postgres://... npm start          # serves the API and ../public
```

## Structure
- `auth/`: `AuthController`/`AuthService`, DTOs validated with `class-validator`, `SessionMiddleware` (attaches
  the user from the cookie), `SessionGuard` registered as a global guard so every route is protected unless marked
  `@Public()`.
- `lessons/`, `stats/`: controllers + injectable services (`/api/lessons`, `/submit`, `/stats`, `/history`,
  `/profile`, `/leaderboard`).
- `common/`: pure scoring and streak logic ported to TypeScript, validators, a global exception filter that keeps the
  Express error shape and SPA fallback, a `@CurrentUser()` param decorator.
- `db/`: a global `DatabaseModule` that injects the Knex instance (real `pg` in production, pg-mem in tests).
- Auth endpoints keep the same rate limit (20 attempts / 15 min / IP).

## How it is verified
1. **Contract test**: the repo's existing Supertest integration suite (`tests/integration`) runs unchanged against
   either implementation: `MICROLEARN_IMPL=nest npx jest tests/integration` (15 tests). The Express server and the
   NestJS port both pass it (deleting `nest/dist` makes it fail, so it really is exercising the port).
2. **Real PostgreSQL**: `tests/e2e/postgres-nest.test.js` migrates and seeds a real Postgres 16 database and runs the
   flow end to end, including 12 concurrent quiz submits by one user that must not lose XP (this exercises the
   `SELECT ... FOR UPDATE` lock on `user_stats`, which pg-mem cannot). Needs `E2E_DATABASE_URL`; CI provides a
   Postgres service.

## Limits
- Not deployed: the live demo still runs the Express server. Auth uses DB-backed sessions (not JWT), as in the original.
- No Nest-specific unit tests yet beyond the shared contract suite; the pure scoring/streak logic is covered by the
  existing unit tests of the Express version, not re-tested in TypeScript.
