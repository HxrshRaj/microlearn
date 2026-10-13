from django.contrib import admin

from .models import Attempt, Category, Lesson, Profile, Question


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 0


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "xp_reward")
    list_select_related = ("category",)
    inlines = [QuestionInline]


admin.site.register([Category, Profile])


@admin.register(Attempt)
class AttemptAdmin(admin.ModelAdmin):
    list_display = ("user", "lesson", "score", "total", "xp_awarded", "created_at")
    list_select_related = ("user", "lesson")
