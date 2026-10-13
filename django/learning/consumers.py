from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from . import services


class LeaderboardConsumer(AsyncJsonWebsocketConsumer):
    """Read-only live leaderboard. Clients get a snapshot on connect and a push after every committed attempt."""

    async def connect(self):
        await self.channel_layer.group_add(services.GROUP, self.channel_name)
        await self.accept()
        rows = await database_sync_to_async(services.leaderboard)()
        await self.send_json({"type": "snapshot", "rows": rows})

    async def disconnect(self, code):
        await self.channel_layer.group_discard(services.GROUP, self.channel_name)

    async def receive_json(self, content, **kwargs):
        # The socket is server-push only; ignore anything a client sends.
        if content == {"type": "ping"}:
            await self.send_json({"type": "pong"})

    async def leaderboard_update(self, event):
        await self.send_json({"type": "update", "rows": event["rows"]})
