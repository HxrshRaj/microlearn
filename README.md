# MicroLearn

A gamified microlearning platform — short lessons, instant quiz feedback, XP, and daily streaks. Full-stack JavaScript: Node.js/Express backend, vanilla JS frontend, Postgres persistence, real accounts.

## Why this exists

Most learning platforms either dump a wall of content on you or gamify so hard the actual learning gets lost. MicroLearn is built around one idea: small, focused lessons with a quiz that gives real, immediate feedback — and a streak system that rewards consistency, not just completion.

This started as a single-user MVP (JSON-file storage, no accounts). This phase turns it into a real multi-user product: authentication, a proper relational schema, per-user progress, history, profiles, a leaderboard, and a test suite — without touching the visual design of the original.

## Features

- **Bite-sized lessons** with a short quiz (2 questions each) across 15 lessons in 7 categories, with dashboard filtering
- **Accounts** — signup/login with hashed passwords, server-side sessions
- **Per-user everything** — each account has its own XP, streaks, and completion state; nothing is shared or global anymore
- **Learning history** — every quiz attempt is kept (not just the latest), so score-over-time per lesson is a real query
- **Profile page** — username, join date, total XP, current/longest streak, lessons completed
- **Leaderboard** — top learners ranked by total XP
- **Instant feedback** — see exactly which answers were right or wrong right after submitting
- **XP system** — partial credit based on quiz score, not all-or-nothing
- **Streak tracking** — current streak and longest streak, calculated from real activity dates (not just a counter that never resets)

## Tech stack

- **Backend**: Node.js, Express 5
- **Database**: PostgreSQL, via [Knex.js](https://knexjs.org) (query builder + migrations)
- **Auth**: bcryptjs password hashing + server-side sessions (opaque token in an httpOnly cookie)
- **Frontend**: Vanilla JavaScript (no framework/build step)
- **Tests**: Jest + Supertest
- **CI**: GitHub Actions

## Architecture decisions (and why)

**PostgreSQL over MySQL.** Window/ranking queries (used for the leaderboard) are cleaner in Postgres, `jsonb` is a natural fit for the quiz option arrays, and it's the default pairing for a Node/Express app on every major free-tier host aimed at projects like this one (Neon, Supabase, Render).

**Knex.js over an ORM.** A real CLI-driven migration system (`knex migrate:make` / `migrate:latest` / `migrate:rollback`), migration state tracked in the database itself (a `knex_migrations` table — not "did I remember to run that .sql file"), and it works identically across Postgres/MySQL/SQLite. No codegen step, which matters less for a project this size than Knex's transparency.

**Server-side sessions, not JWT.** A session is a random opaque token, sent to the browser only as an `httpOnly`, `Secure` (in production), `SameSite=Lax` cookie. The `sessions` table stores only the **SHA-256 hash** of that token, so a database read alone can't produce a usable session — same principle as never storing a plaintext password. Logout is a single `DELETE`, with no token-blacklist or expiry math to get right. JWT's usual selling point — skip a DB read per request for stateless scaling — doesn't buy much for a single Express process that already hits the database on every request; DB-backed sessions are simpler and give up nothing here. See [server/lib/session.js](server/lib/session.js).

**bcryptjs, not native bcrypt/argon2.** Pure JavaScript, no native compile step — consistent with a decision already made in this codebase before this phase (the original `db.js` avoided `better-sqlite3` for the same "installs cleanly on any Node host" reason). Slower per-hash than a native implementation, worth it for the zero-build-step deploy story at this project's scale. See [server/lib/auth.js](server/lib/auth.js).

**Input validation** happens before any database call: username shape, email format (a deliberately narrow charset — not full RFC 5322 — so nothing unexpected ever reaches a database or a template), and a password policy (8+ characters, at least one letter and one number) tuned for actual crack-resistance over "must contain a symbol" theater. **Rate limiting** (`express-rate-limit`, 20 requests/15 min/IP) sits in front of every `/api/auth/*` route to blunt trivial brute-forcing. Login returns the same error for "no such account" and "wrong password" so it can't be used to enumerate registered emails.

## Database schema

```
users            id, username (unique), email (unique), password_hash, created_at
sessions         id (sha256 of the session token), user_id → users, expires_at, user_agent
lessons          id, title, category, summary, xp_reward, sort_order
questions        id, lesson_id → lessons, prompt, options (jsonb array), correct_index, sort_order
progress         id, user_id → users, lesson_id → lessons, score, xp_earned, completed_at
user_stats       user_id → users (PK), total_xp, current_streak, longest_streak, last_activity_date
```

`progress` is **append-only** — every quiz attempt gets its own row, which is what makes the history page a real query instead of a reconstruction. `user_stats` is a denormalized per-user aggregate (mirroring the old single-user `stats` object from the JSON version), updated transactionally alongside every `progress` insert. Foreign keys cascade on delete, so removing a user cleans up their sessions/progress/stats automatically. Full detail is in [server/db/migrations](server/db/migrations).

### Migrating off the old JSON store

The MVP kept everything in `data.json` with no concept of a user — `progress` and `stats` were global. There's no correct owner to assign that old activity to, so it is **not** carried into the new per-user tables — inventing an owner for it would be worse than leaving it out. The lesson *content* (titles, questions, correct answers), however, has no user attached and is safe to keep: `npm run migrate-legacy-data` will import any lessons from `data.json` that aren't already in the database. On a fresh install you don't need this at all — `server/db/seeds/01_lessons.js` seeds the full (expanded) lesson catalog on its own. See the comment at the top of [scripts/migrate-data.js](scripts/migrate-data.js) for the full reasoning.

## Running locally

**Prerequisites:** Node 18+, and a Postgres instance. The easiest path is Docker:

```bash
docker compose up -d
```

This starts Postgres 16 on `localhost:5432` with the credentials already wired into `.env.example`. If you'd rather use a Postgres you already have running, just point `DATABASE_URL` at it instead.

```bash
npm install
cp .env.example .env        # adjust DATABASE_URL if you're not using docker-compose
npm run migrate             # creates the schema
npm run seed                # loads the 15-lesson catalog
npm start
```

Then open `http://localhost:3000`, and sign up for an account.

| Command | What it does |
|---|---|
| `npm start` | Runs the server (`server/index.js`) |
| `npm run migrate` | Applies any pending migrations |
| `npm run migrate:rollback` | Rolls back the last migration batch |
| `npm run migrate:make <name>` | Scaffolds a new migration file |
| `npm run seed` | Seeds the lesson catalog (no-ops if lessons already exist) |
| `npm run migrate-legacy-data` | One-time import of lesson content from `data.json`, if present |
| `npm test` | Runs the Jest test suite |

## Testing

```bash
npm test
```

- **Unit tests** (`tests/unit/`) cover the pure logic extracted out of the route handlers: password hashing/validation ([auth.js](server/lib/auth.js)), quiz scoring and XP math ([scoring.js](server/lib/scoring.js)), and streak calculation ([streak.js](server/lib/streak.js)) — same-day resubmission, missed-day resets, longest-streak tracking, and a couple of database-driver-shape edge cases (a `date` column coming back as a JS `Date` vs. a string).
- **Integration tests** (`tests/integration/`) run the real Express app from [server/app.js](server/app.js) against [pg-mem](https://github.com/oguimbal/pg-mem), an in-memory Postgres-compatible engine, driven through the **actual** migration and seed files — not a mock. They cover signup/login/logout, duplicate-account and weak-password rejection, and — the important one — that two different users completing the same lesson never see each other's progress, XP, streak, or completion state.

**Honest limitation:** pg-mem is not a full Postgres implementation (notably, it doesn't support `RANK() OVER (...)` window functions, which is part of why the leaderboard ranks results in application code instead — see the comment in [server/routes/api.js](server/routes/api.js)). It's a good-faith stand-in for CI and fast local iteration, not a substitute for running the real migrations against real Postgres at least once before deploying — `docker compose up -d && npm run migrate` takes about five minutes and is worth doing.

CI (`.github/workflows/ci.yml`) runs this same suite on every push and pull request.

## Project structure

```
microlearn/
├── server/
│   ├── index.js               # process entry point
│   ├── app.js                 # Express app factory (takes a Knex instance — testable)
│   ├── db/
│   │   ├── knex.js            # shared Knex singleton
│   │   ├── migrations/        # schema, one table per file
│   │   └── seeds/             # lesson catalog seed
│   ├── lib/
│   │   ├── auth.js            # password hashing + input validation (pure)
│   │   ├── session.js         # DB-backed session create/verify/destroy
│   │   ├── scoring.js         # quiz scoring + XP math (pure)
│   │   └── streak.js          # streak calculation (pure)
│   ├── middleware/
│   │   ├── requireAuth.js     # attaches req.user / rejects unauthenticated requests
│   │   └── rateLimit.js       # auth endpoint rate limiting
│   └── routes/
│       ├── auth.js            # signup, login, logout, me
│       └── api.js             # lessons, submit, stats, history, profile, leaderboard
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js                 # frontend: auth, dashboard, quiz, history, profile, leaderboard
├── scripts/
│   └── migrate-data.js        # one-time legacy data.json → DB import
├── tests/
│   ├── unit/
│   └── integration/
├── knexfile.js
├── docker-compose.yml          # local Postgres
└── .github/workflows/ci.yml
```

## API

All routes except `/api/auth/*` require a valid session (a 401 is returned otherwise).

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create an account, start a session |
| POST | `/api/auth/login` | Log in, start a session |
| POST | `/api/auth/logout` | End the current session |
| GET | `/api/auth/me` | Current user, or `null` |
| GET | `/api/categories` | Distinct lesson categories |
| GET | `/api/lessons` | Lessons with per-user completion status (`?category=` to filter) |
| GET | `/api/lessons/:id` | A lesson with its quiz questions (no answers leaked) |
| POST | `/api/lessons/:id/submit` | Submit answers, returns score + updated stats |
| GET | `/api/stats` | Current user's XP, streak, and completion totals |
| GET | `/api/history` | Every past attempt for the current user (`?lessonId=` to scope to one lesson) |
| GET | `/api/profile` | Username, join date, lifetime stats |
| GET | `/api/leaderboard` | Top 20 users by total XP |

## What's intentionally out of scope

Named here so it's a decision, not an oversight: password reset / email verification, OAuth login, and a UI for viewing or revoking other active sessions (the `sessions` table already supports multiple concurrent logins per user — there's just no screen for it yet). Full end-to-end/browser test coverage was also cut in favor of getting the unit and integration coverage right first.

## What I'd build next

- Password reset via email
- A "review missed questions" mode, using the history data that now exists
- Spaced-repetition scheduling for previously completed lessons
- A lesson-authoring UI so new content doesn't require a migration/seed change
