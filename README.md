# MicroLearn

A gamified microlearning platform — short lessons, instant quiz feedback, XP, and daily streaks. Built as a full-stack JavaScript project (Node.js/Express backend, vanilla JS frontend, SQLite persistence).

## Why this exists

Most learning platforms either dump a wall of content on you or gamify so hard the actual learning gets lost. MicroLearn is built around one idea: small, focused lessons with a quiz that gives real, immediate feedback — and a streak system that rewards consistency, not just completion.

## Features

- **Bite-sized lessons** with a short quiz (2 questions each) — quick to complete, quick to retain
- **Instant feedback** — see exactly which answers were right or wrong right after submitting
- **XP system** — partial credit based on quiz score, not all-or-nothing
- **Streak tracking** — current streak and longest streak, calculated from real activity dates (not just a counter that never resets)
- **Persistent progress** — SQLite-backed, so progress survives a server restart

## Tech stack

- **Backend**: Node.js, Express 5, better-sqlite3
- **Frontend**: Vanilla JavaScript (no framework/build step — keeps the project simple to run and deploy)
- **Storage**: SQLite (file-based, zero external dependencies)

## Running locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

The database is created and seeded automatically on first run — no manual setup needed.

## Project structure

```
microlearn/
├── server/
│   ├── index.js          # Express app entry point
│   ├── db.js              # SQLite schema + seed data
│   └── routes/api.js      # REST API (lessons, quiz submission, stats)
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js              # Frontend logic (dashboard, quiz, results views)
└── package.json
```

## API

| Method | Route | Description |
|---|---|---|
| GET | `/api/lessons` | List all lessons with completion status |
| GET | `/api/lessons/:id` | Get a lesson with its quiz questions |
| POST | `/api/lessons/:id/submit` | Submit quiz answers, returns score + updated stats |
| GET | `/api/stats` | Get current XP, streak, and completion totals |

## What I'd build next

- User accounts (currently single-user/local, by design, to keep the demo simple)
- Lesson authoring UI so new content doesn't require touching the seed data
- Spaced-repetition review of previously completed lessons
