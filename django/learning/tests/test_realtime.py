import pytest
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.core.management import call_command
from django.contrib.auth import get_user_model

from learning import services
from learning.models import Lesson, Profile
from learning.routing import websocket_urlpatterns

app = URLRouter(websocket_urlpatterns)
pytestmark = pytest.mark.django_db(transaction=True)


def make_user(name):
    u = get_user_model().objects.create_user(name, password="correct-horse-9")
    Profile.objects.create(user=u)
    return u


async def test_snapshot_on_connect():
    await database_sync_to_async(make_user)("first_user")
    comm = WebsocketCommunicator(app, "/ws/leaderboard/")
    ok, _ = await comm.connect()
    msg = await comm.receive_json_from()
    assert ok and msg["type"] == "snapshot" and msg["rows"][0]["username"] == "first_user"
    await comm.disconnect()


async def test_attempt_pushes_update_to_connected_clients_after_commit():
    def prep():
        call_command("seed_lessons", verbosity=0)
        return make_user("pusher"), Lesson.objects.first()
    user, lesson = await database_sync_to_async(prep)()
    a = WebsocketCommunicator(app, "/ws/leaderboard/"); b = WebsocketCommunicator(app, "/ws/leaderboard/")
    await a.connect(); await b.connect()
    await a.receive_json_from(); await b.receive_json_from()   # drain snapshots

    answers = await database_sync_to_async(lambda: [q.correct_index for q in lesson.questions.all()])()
    await database_sync_to_async(services.submit_attempt)(user, lesson, answers)

    for comm in (a, b):
        msg = await comm.receive_json_from(timeout=2)
        assert msg["type"] == "update" and msg["rows"][0]["username"] == "pusher"
        assert msg["rows"][0]["total_xp"] == lesson.xp_reward
    await a.disconnect(); await b.disconnect()


async def test_rejected_submission_does_not_broadcast():
    def prep():
        call_command("seed_lessons", verbosity=0)
        return make_user("quiet"), Lesson.objects.first()
    user, lesson = await database_sync_to_async(prep)()
    comm = WebsocketCommunicator(app, "/ws/leaderboard/")
    await comm.connect(); await comm.receive_json_from()
    with pytest.raises(services.SubmissionError):
        await database_sync_to_async(services.submit_attempt)(user, lesson, [99, 99])
    assert await comm.receive_nothing(timeout=0.3)
    await comm.disconnect()


async def test_client_messages_are_ignored_except_ping():
    comm = WebsocketCommunicator(app, "/ws/leaderboard/")
    await comm.connect(); await comm.receive_json_from()
    await comm.send_json_to({"type": "set_xp", "value": 9999})
    assert await comm.receive_nothing(timeout=0.2)
    await comm.send_json_to({"type": "ping"})
    assert (await comm.receive_json_from())["type"] == "pong"
    await comm.disconnect()


async def test_disconnected_client_leaves_the_group():
    comm = WebsocketCommunicator(app, "/ws/leaderboard/")
    await comm.connect(); await comm.receive_json_from()
    await comm.disconnect()
    layer = get_channel_layer()
    assert not any(services.GROUP in g for g in [getattr(layer, "groups", {})] if g.get(services.GROUP))
