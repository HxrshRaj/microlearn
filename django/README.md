# MicroLearn, Django edition

The MicroLearn API rebuilt on **Django 5, Django REST Framework and django-channels**, with a live WebSocket leaderboard and a small browser client. Same product as the Node editions (lessons, quizzes, XP, streaks, history, leaderboard), so the three backends can be compared directly.

## What's in it

- **DRF API** (token auth): signup/login with Django's password validators and throttling, lessons with category filter and pagination, server-side grading, history, profile, public leaderboard.
- **django-channels**: `ws/leaderboard/` sends a snapshot on connect and pushes an update to every connected client after each *committed* attempt (`transaction.on_commit`), so clients never see data that later rolls back. Uses the in-memory layer by default and Redis when `REDIS_URL` is set.
- **Query optimisation, with proof**
  - Lesson list: one annotated query (`Count`, `Exists`, `Subquery`) instead of a query per lesson; a test asserts 15 lessons cost the same number of queries as 3. Breaking `select_related` makes that test fail.
  - Indexes chosen for the real queries (`profile_leaderboard_idx`, `attempt_user_lesson_idx`); SQLite `EXPLAIN QUERY PLAN` tests assert they are used.
- **Correctness under concurrency**: attempts lock the profile row (`select_for_update`) and update XP with `F()`. A test fires 12 simultaneous submissions at PostgreSQL and asserts exactly one XP award; without the lock it fails (I checked: it awarded 175 and 200 XP instead of 25).
- **Game rules**: only *improvement* earns XP, so retaking a quiz cannot farm points; streaks are computed from dates (same day unchanged, consecutive day +1, gap resets, longest kept).
- **Tests**: 36 pytest tests (API, services, WebSocket consumer, query counts, indexes, concurrency).

## Run

```bash
cd django
pip install -r requirements-dev.txt
export DJANGO_SECRET_KEY=change-me DJANGO_DEBUG=1
python manage.py migrate && python manage.py seed_lessons
daphne -p 8000 config.asgi:application      # open http://localhost:8000
pytest                                       # SQLite
DATABASE_URL=postgres://user:pass@localhost:5432/db pytest   # PostgreSQL (runs the concurrency test)
```

Docker: `docker build -t microlearn-django django/ && docker run -p 8000:8000 -e DJANGO_SECRET_KEY=... -e DJANGO_INSECURE_COOKIES=1 microlearn-django`
(`DJANGO_INSECURE_COOKIES=1` is for plain-HTTP local use only; behind HTTPS leave it unset.)

## Honest limits

- Not deployed anywhere yet; I verified it locally (Daphne + two real browsers watching the live board) and in CI.
- The Docker image is built and smoke-tested in CI, not run in production.
- Token auth is simple on purpose (no expiry or refresh); the Express edition uses rotating refresh cookies.
- The WebSocket is read-only broadcast; there is no per-user private channel.
