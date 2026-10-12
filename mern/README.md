# MicroLearn — MERN edition

A MongoDB / Express / React / Node implementation of the MicroLearn gamified-learning API (lessons, quizzes, XP, streaks, leaderboard), with the same scoring and streak logic as the PostgreSQL version in the parent directory.

| Layer | What it uses |
|---|---|
| API | Express 5 in an **MVC** layout: `models/` (Mongoose), `controllers/`, `routes/`, `middleware/` |
| Database | **MongoDB** via Mongoose; lessons embed their questions, stats live on the user document, attempts are their own collection |
| Auth | **JWT**: short-lived access token (Bearer header, kept in memory by the client) + 7-day refresh token in an `httpOnly` cookie, **rotated on every use**; a replayed (already-rotated) refresh token revokes the session |
| Validation | Zod schemas in middleware; bcrypt password hashing; rate-limited login/register |
| Client | **React** (Vite) + **Tailwind CSS v4**, React Router; silently re-authenticates on reload and retries once on an expired access token |

## Run it

```bash
cd mern
cp .env.example .env            # set MONGO_URI and the two JWT secrets
npm install && npm run build    # installs deps and builds the React client
npm start                       # API + built client on http://localhost:4000
# or, for development with hot reload:
npm run dev                     # API on :4000
npm --prefix client run dev     # client on :5173 (proxies /api to :4000)
```

## Test

```bash
MONGO_URI=mongodb://127.0.0.1:27017 npm test                      # real MongoDB
MONGO_IMPL=ferretdb MONGO_URI=mongodb://127.0.0.1:27017 npm test  # FerretDB (skips the concurrency test)
```

13 API tests (supertest) against a MongoDB-protocol server, using a throwaway database: register/login, token tampering, refresh rotation and replay revocation, logout revocation, answer secrecy, scoring, streaks, history, leaderboard ties, and 6 **concurrent** submissions from one user.

Concurrency design: XP is added with `$inc` (atomic per document in MongoDB), and the streak is "claimed" once per day with a `findOneAndUpdate` filtered on `lastActivityDate != today`, so only one of several simultaneous same-day submissions runs the streak calculation. No multi-document transactions are needed (they require a replica set).

**What has and hasn't been verified.** No `mongod` binary could be downloaded in the development sandbox, so the suite was run against [FerretDB](https://www.ferretdb.io/) 1.24 (MongoDB wire protocol on PostgreSQL) with `MONGO_IMPL=ferretdb`. There, 12 of 13 tests run and pass. The concurrent-submission test is skipped because FerretDB 1.x itself loses writes under parallel updates (a bare parallel `$inc` on one document loses increments, unrelated to this code), which real MongoDB does not. CI runs all 13 against the official `mongo:7` image; **that CI run has not happened yet**, so concurrency safety on real MongoDB is by design, not yet demonstrated. The UI flow (sign up, reload to confirm the session survives, take a quiz, leaderboard) was driven end-to-end in headless Chromium.

## Deploy

`render.yaml` (repo root) defines a single Render web service that builds the `Dockerfile` (client build + API) and serves both from one origin. Set `MONGO_URI` (e.g. a free MongoDB Atlas cluster) and `CLIENT_ORIGIN`; the JWT secrets are generated. In production the server refuses to start without both JWT secrets. **Not yet deployed** — no live URL exists until you connect the repo to Render and Atlas.
