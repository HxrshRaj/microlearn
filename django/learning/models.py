from django.conf import settings
from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=80, unique=True)

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Lesson(models.Model):
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="lessons")
    title = models.CharField(max_length=160)
    summary = models.TextField()
    xp_reward = models.PositiveSmallIntegerField(default=25)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [models.UniqueConstraint(fields=["title"], name="uniq_lesson_title")]

    def __str__(self):
        return self.title


class Question(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="questions")
    prompt = models.TextField()
    options = models.JSONField()
    correct_index = models.PositiveSmallIntegerField()
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    def clean(self):
        from django.core.exceptions import ValidationError
        if not isinstance(self.options, list) or len(self.options) < 2:
            raise ValidationError("options must be a list of at least two choices")
        if not 0 <= self.correct_index < len(self.options):
            raise ValidationError("correct_index is out of range")


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    total_xp = models.PositiveIntegerField(default=0)
    current_streak = models.PositiveIntegerField(default=0)
    longest_streak = models.PositiveIntegerField(default=0)
    last_active = models.DateField(null=True, blank=True)

    class Meta:
        # Serves the leaderboard (ORDER BY total_xp DESC, then a stable tiebreak) straight from the index.
        indexes = [models.Index(fields=["-total_xp", "user"], name="profile_leaderboard_idx")]

    def __str__(self):
        return f"{self.user} ({self.total_xp} XP)"


class Attempt(models.Model):
    """Every quiz attempt is kept, so score-over-time per lesson is a real query."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="attempts")
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="attempts")
    score = models.PositiveSmallIntegerField()
    total = models.PositiveSmallIntegerField()
    xp_awarded = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["user", "lesson", "-created_at"], name="attempt_user_lesson_idx"),
            models.Index(fields=["user", "-created_at"], name="attempt_user_recent_idx"),
        ]
        constraints = [models.CheckConstraint(condition=models.Q(score__lte=models.F("total")), name="score_lte_total")]
