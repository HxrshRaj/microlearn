import os

os.environ.setdefault("DJANGO_SECRET_KEY", "test-only-key")
from .settings import *  # noqa: E402,F401,F403

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]  # fast hashing for tests only
