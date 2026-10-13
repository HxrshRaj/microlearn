"""Business logic, kept out of the views so it can be tested without HTTP."""
from __future__ import annotations

import datetime as dt

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.db.models import F

from .models import Attempt, Lesson, Profile

GROUP = "leaderboard"


class SubmissionError(ValueError):
    pass


def leaderboard(limit: int = 10) -> list[dict]:
    rows = Profile.objects.select_related("user").order_by("-total_xp", "user_id")[:limit]
    return [{"rank": i, "username": p.user.username, "total_xp": p.total_xp, "streak": p.current_streak}
            for i, p in enumerate(rows, start=1)]


def _broadcast_leaderboard():
    layer = get_channel_layer()
    if layer is not None:
        async_to_sync(layer.group_send)(GROUP, {"type": "leaderboard.update", "rows": leaderboard()})


def _next_streak(profile: Profile, today: dt.date) -> tuple[int, int]:
    """Returns (current, longest) after activity today. Same day: unchanged; yesterday: +1; else reset."""
    if profile.last_active == today:
        return profile.current_streak, profile.longest_streak
    current = profile.current_streak + 1 if profile.last_active == today - dt.timedelta(days=1) else 1
    return current, max(profile.longest_streak, current)


def grade(lesson: Lesson, answers: list) -> tuple[int, int]:
    questions = list(lesson.questions.all())
    if len(answers) != len(questions):
        raise SubmissionError(f"expected {len(questions)} answers, got {len(answers)}")
    score = 0
    for q, a in zip(questions, answers):
        if isinstance(a, bool) or not isinstance(a, int) or not 0 <= a < len(q.options):
            raise SubmissionError("each answer must be a valid option index")
        score += int(a == q.correct_index)
    return score, len(questions)


def submit_attempt(user, lesson: Lesson, answers: list, today: dt.date | None = None) -> dict:
    """Grade, record the attempt, award only *improvement* XP, update the streak atomically."""
    today = today or dt.date.today()
    score, total = grade(lesson, answers)
    if total == 0:
        raise SubmissionError("lesson has no questions")
    earned = round(lesson.xp_reward * score / total)

    with transaction.atomic():
        profile, _ = Profile.objects.select_for_update().get_or_create(user=user)
        # xp_awarded stores XP granted by that attempt; the best *total* earned so far is their sum.
        earned_before = (Attempt.objects.filter(user=user, lesson=lesson)
                         .values_list("xp_awarded", flat=True))
        gained = max(0, earned - sum(earned_before))
        current, longest = _next_streak(profile, today)
        Profile.objects.filter(pk=profile.pk).update(
            total_xp=F("total_xp") + gained, current_streak=current, longest_streak=longest, last_active=today)
        attempt = Attempt.objects.create(user=user, lesson=lesson, score=score, total=total, xp_awarded=gained)
        profile.refresh_from_db()
        transaction.on_commit(_broadcast_leaderboard)  # only announce once the data is really committed
    return {"attempt_id": attempt.id, "score": score, "total": total, "xp_awarded": gained,
            "total_xp": profile.total_xp, "current_streak": profile.current_streak,
            "longest_streak": profile.longest_streak, "perfect": score == total}
