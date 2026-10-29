import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from learning.models import Category, Lesson, Question

FIXTURE = Path(__file__).resolve().parents[2] / "fixtures" / "lessons.json"


class Command(BaseCommand):
    help = "Load the lesson catalogue. Idempotent: lessons are matched by title and never deleted."

    @transaction.atomic
    def handle(self, *args, **opts):
        created = 0
        for i, item in enumerate(json.loads(FIXTURE.read_text(encoding="utf-8"))):
            cat, _ = Category.objects.get_or_create(name=item["category"])
            lesson, was_new = Lesson.objects.get_or_create(
                title=item["title"],
                defaults={"category": cat, "summary": item["summary"], "xp_reward": item["xp_reward"], "sort_order": i})
            if was_new:
                created += 1
                Question.objects.bulk_create([
                    Question(lesson=lesson, prompt=q["prompt"], options=q["options"],
                             correct_index=q["correct_index"], sort_order=j)
                    for j, q in enumerate(item["questions"])])
        self.stdout.write(self.style.SUCCESS(f"{created} new lessons, {Lesson.objects.count()} total"))
