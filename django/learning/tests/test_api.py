import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from learning.models import Attempt, Profile
from .conftest import signup


def correct(client, lesson_id):
    d = client.get(f"/api/lessons/{lesson_id}").json()
    return d, None


def answers_for(lesson, wrong=0):
    qs = list(lesson.questions.all())
    out = [q.correct_index for q in qs]
    for i in range(wrong):
        out[i] = (out[i] + 1) % len(qs[i].options)
    return out


# ---- auth ------------------------------------------------------------------- #
def test_signup_login_flow_and_token_auth(api, db):
    assert api.get("/api/me").status_code == 401
    r = api.post("/api/auth/signup", {"username": "ravi_k", "password": "correct-horse-9"}, format="json")
    assert r.status_code == 201 and Profile.objects.filter(user__username="ravi_k").exists()
    tok = api.post("/api/auth/login", {"username": "ravi_k", "password": "correct-horse-9"}, format="json").json()["token"]
    api.credentials(HTTP_AUTHORIZATION=f"Token {tok}")
    assert api.get("/api/me").json()["username"] == "ravi_k"


@pytest.mark.parametrize("payload,field", [
    ({"username": "ab", "password": "correct-horse-9"}, "username"),
    ({"username": "bad name!", "password": "correct-horse-9"}, "username"),
    ({"username": "okname", "password": "short"}, "password"),
    ({"username": "okname", "password": "12345678"}, "password"),
])
def test_signup_validation(api, db, payload, field):
    r = api.post("/api/auth/signup", payload, format="json")
    assert r.status_code == 400 and field in r.json()


def test_duplicate_username_is_case_insensitive(api, db):
    signup(api, "Priya_N")
    r = api.post("/api/auth/signup", {"username": "priya_n", "password": "correct-horse-9"}, format="json")
    assert r.status_code == 400


def test_wrong_password_rejected(api, db):
    signup(api, "dev_1")
    assert api.post("/api/auth/login", {"username": "dev_1", "password": "nope-nope-1"}, format="json").status_code == 400


def test_auth_endpoints_are_rate_limited(api, db, settings):
    from rest_framework.throttling import ScopedRateThrottle
    ScopedRateThrottle.THROTTLE_RATES = {"auth": "3/min", "submit": "60/min"}
    codes = [api.post("/api/auth/login", {"username": "x", "password": "y"}, format="json").status_code for _ in range(5)]
    ScopedRateThrottle.THROTTLE_RATES = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
    assert 429 in codes


# ---- catalogue -------------------------------------------------------------- #
def test_lessons_require_auth_and_hide_answers(api, user_client, lessons):
    assert api.get("/api/lessons").status_code == 401
    detail = user_client.get(f"/api/lessons/{lessons[0].id}").json()
    assert detail["questions"] and all("correct_index" not in q for q in detail["questions"])


def test_category_filter(user_client, lessons):
    cat = lessons[0].category.name
    rows = user_client.get("/api/lessons", {"category": cat}).json()["results"]
    assert rows and {r["category"] for r in rows} == {cat}


def test_lesson_list_query_count_is_constant(user_client, lessons):
    """The N+1 guard: 15 lessons must cost the same number of queries as 3."""
    from learning.models import Lesson
    with CaptureQueriesContext(connection) as full:
        r = user_client.get("/api/lessons")
    assert len(r.json()["results"]) == 15
    Lesson.objects.filter(id__in=[l.id for l in lessons[3:]]).delete()
    with CaptureQueriesContext(connection) as few:
        user_client.get("/api/lessons")
    assert len(full) == len(few) <= 4  # auth lookup + count + page


def test_lesson_detail_uses_constant_queries(user_client, lessons):
    with CaptureQueriesContext(connection) as ctx:
        user_client.get(f"/api/lessons/{lessons[0].id}")
    assert len(ctx) <= 4


def test_unknown_lesson_404(user_client, lessons):
    assert user_client.get("/api/lessons/99999").status_code == 404
    assert user_client.post("/api/lessons/99999/submit", {"answers": [0]}, format="json").status_code == 404


# ---- submit / XP / streaks -------------------------------------------------- #
def test_perfect_attempt_awards_full_xp_and_reveals_key(user_client, lessons):
    lesson = lessons[0]
    r = user_client.post(f"/api/lessons/{lesson.id}/submit", {"answers": answers_for(lesson)}, format="json")
    assert r.status_code == 201
    body = r.json()
    assert body["perfect"] and body["xp_awarded"] == lesson.xp_reward == body["total_xp"]
    assert [a["correct_index"] for a in body["answers"]] == answers_for(lesson)


def test_partial_credit(user_client, lessons):
    lesson = lessons[0]
    body = user_client.post(f"/api/lessons/{lesson.id}/submit", {"answers": answers_for(lesson, wrong=1)}, format="json").json()
    assert body["score"] == 1 and body["total"] == 2 and body["xp_awarded"] == round(lesson.xp_reward / 2)


def test_only_improvement_earns_xp_so_repeats_cannot_farm(user_client, lessons):
    lesson = lessons[0]
    url = f"/api/lessons/{lesson.id}/submit"
    first = user_client.post(url, {"answers": answers_for(lesson, wrong=1)}, format="json").json()
    second = user_client.post(url, {"answers": answers_for(lesson)}, format="json").json()
    again = user_client.post(url, {"answers": answers_for(lesson)}, format="json").json()
    assert first["xp_awarded"] + second["xp_awarded"] == lesson.xp_reward
    assert again["xp_awarded"] == 0 and again["total_xp"] == lesson.xp_reward
    assert Attempt.objects.count() == 3  # every attempt is kept in history


@pytest.mark.parametrize("answers", [[], [0], [0, 1, 2], ["a", "b"], [0, 99], [-1, 0], [True, False]])
def test_invalid_answers_rejected_and_nothing_recorded(user_client, lessons, answers):
    r = user_client.post(f"/api/lessons/{lessons[0].id}/submit", {"answers": answers}, format="json")
    assert r.status_code == 400
    assert Attempt.objects.count() == 0


def test_streak_rules(db, lessons):
    import datetime as dt
    from django.contrib.auth import get_user_model
    from learning import services
    u = get_user_model().objects.create_user("streaker", password="correct-horse-9")
    lesson = lessons[0]
    day = dt.date(2026, 1, 10)
    ans = answers_for(lesson)
    s = lambda d: services.submit_attempt(u, lesson, ans, today=d)  # noqa: E731
    assert s(day)["current_streak"] == 1
    assert s(day)["current_streak"] == 1                                   # same day: unchanged
    assert s(day + dt.timedelta(days=1))["current_streak"] == 2            # consecutive
    assert s(day + dt.timedelta(days=2))["current_streak"] == 3
    r = s(day + dt.timedelta(days=5))                                      # gap: reset, longest kept
    assert (r["current_streak"], r["longest_streak"]) == (1, 3)


def test_history_and_profile(user_client, lessons):
    for l in lessons[:2]:
        user_client.post(f"/api/lessons/{l.id}/submit", {"answers": answers_for(l)}, format="json")
    hist = user_client.get("/api/history").json()["results"]
    assert len(hist) == 2 and hist[0]["created_at"] >= hist[1]["created_at"]
    me = user_client.get("/api/me").json()
    assert me["lessons_completed"] == 2 and me["total_xp"] > 0
    flags = {r["id"]: r["completed"] for r in user_client.get("/api/lessons").json()["results"]}
    assert flags[lessons[0].id] and not flags[lessons[5].id]


def test_users_are_isolated(lessons, db):
    from rest_framework.test import APIClient
    a, b = signup(APIClient(), "user_a"), signup(APIClient(), "user_b")
    a.post(f"/api/lessons/{lessons[0].id}/submit", {"answers": answers_for(lessons[0])}, format="json")
    assert b.get("/api/me").json()["total_xp"] == 0 and b.get("/api/history").json()["count"] == 0


# ---- leaderboard ------------------------------------------------------------ #
def test_leaderboard_is_public_ordered_and_tiebroken(lessons, db, api):
    from rest_framework.test import APIClient
    a, b = signup(APIClient(), "low_xp"), signup(APIClient(), "high_xp")
    a.post(f"/api/lessons/{lessons[0].id}/submit", {"answers": answers_for(lessons[0], wrong=1)}, format="json")
    b.post(f"/api/lessons/{lessons[0].id}/submit", {"answers": answers_for(lessons[0])}, format="json")
    rows = api.get("/api/leaderboard").json()
    assert [r["username"] for r in rows] == ["high_xp", "low_xp"] and [r["rank"] for r in rows] == [1, 2]
    assert len(api.get("/api/leaderboard?limit=1").json()) == 1


def test_leaderboard_query_uses_the_index_on_sqlite(db):
    if connection.vendor != "sqlite":
        pytest.skip("EXPLAIN QUERY PLAN format is SQLite-specific")
    with connection.cursor() as c:
        c.execute("EXPLAIN QUERY PLAN SELECT user_id, total_xp FROM learning_profile ORDER BY total_xp DESC, user_id LIMIT 10")
        plan = " ".join(str(r[-1]) for r in c.fetchall())
    assert "profile_leaderboard_idx" in plan and "TEMP B-TREE" not in plan


def test_history_lookup_uses_attempt_index_on_sqlite(db):
    if connection.vendor != "sqlite":
        pytest.skip("SQLite-specific")
    with connection.cursor() as c:
        c.execute("EXPLAIN QUERY PLAN SELECT id FROM learning_attempt WHERE user_id = 1 AND lesson_id = 2")
        plan = " ".join(str(r[-1]) for r in c.fetchall())
    assert "attempt_user_lesson_idx" in plan


def test_seed_is_idempotent(db):
    from django.core.management import call_command
    from learning.models import Lesson, Question
    call_command("seed_lessons", verbosity=0); call_command("seed_lessons", verbosity=0)
    assert Lesson.objects.count() == 15 and Question.objects.count() == 30


@pytest.mark.django_db(transaction=True)
def test_concurrent_submissions_never_lose_xp_or_streak():
    """12 simultaneous submissions from one user must produce exactly one XP award and consistent totals."""
    import threading
    from django.core.management import call_command
    from django.contrib.auth import get_user_model
    from django.db import connections
    from learning import services
    from learning.models import Lesson
    if connection.vendor != "postgresql":
        pytest.skip("needs real row locking (PostgreSQL); SQLite serialises writers")
    call_command("seed_lessons", verbosity=0)
    lesson = Lesson.objects.first()
    user = get_user_model().objects.create_user("racer", password="correct-horse-9")
    Profile.objects.create(user=user)  # existing profile: the row lock, not the INSERT, must serialise writers
    ans = [q.correct_index for q in lesson.questions.all()]
    errors, results = [], []

    def go():
        try:
            results.append(services.submit_attempt(user, lesson, ans))
        except Exception as e:  # noqa: BLE001
            errors.append(e)
        finally:
            connections.close_all()

    ts = [threading.Thread(target=go) for _ in range(12)]
    [t.start() for t in ts]; [t.join() for t in ts]
    assert not errors, errors
    assert sum(r["xp_awarded"] for r in results) == lesson.xp_reward
    p = Profile.objects.get(user=user)
    assert p.total_xp == lesson.xp_reward and p.current_streak == 1
    assert Attempt.objects.filter(user=user).count() == 12
