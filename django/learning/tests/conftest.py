import pytest
from django.core.cache import cache
from django.core.management import call_command
from rest_framework.test import APIClient


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture()
def lessons(db):
    call_command("seed_lessons", verbosity=0)
    from learning.models import Lesson
    return list(Lesson.objects.order_by("sort_order"))


@pytest.fixture()
def api():
    return APIClient()


def signup(api, name="asha_1", password="correct-horse-9"):
    r = api.post("/api/auth/signup", {"username": name, "password": password}, format="json")
    assert r.status_code == 201, r.content
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Token {r.json()['token']}")
    return c


@pytest.fixture()
def user_client(db):
    return signup(APIClient())
