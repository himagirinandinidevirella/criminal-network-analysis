"""
Real-time alert WebSocket manager.

Maintains the set of connected clients and broadcasts alert payloads to them.
Each connection authenticates with a JWT passed as a query parameter and may
subscribe to specific criminal IDs for targeted notifications.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import WebSocket

from app.api.middleware.auth_middleware import decode_token

logger = logging.getLogger("crimenet.websocket")


class AlertConnectionManager:
    """Tracks active WebSocket clients and fans out alert events."""

    def __init__(self) -> None:
        # websocket -> subscription context
        self._active: dict[WebSocket, dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, token: Optional[str]) -> Optional[dict[str, Any]]:
        """
        Authenticate and accept a WebSocket connection.

        Returns the decoded user payload, or None if authentication failed
        (in which case the socket is closed with 4401).
        """
        user: Optional[dict[str, Any]] = None
        if token:
            try:
                user = decode_token(token)
            except Exception as exc:  # noqa: BLE001
                logger.warning("WebSocket auth failed: %s", exc)
        if user is None:
            await websocket.close(code=4401)
            return None
        await websocket.accept()
        self._active[websocket] = {
            "user": user,
            "subscriptions": set(),
        }
        logger.info("WebSocket client connected: %s", user.get("sub"))
        return user

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a client on disconnect."""
        self._active.pop(websocket, None)

    def subscribe(self, websocket: WebSocket, criminal_ids: list[str]) -> None:
        """Subscribe a client to alerts about specific criminal IDs."""
        entry = self._active.get(websocket)
        if entry is not None:
            entry["subscriptions"].update(criminal_ids)

    def unsubscribe(self, websocket: WebSocket, criminal_ids: list[str]) -> None:
        """Unsubscribe a client from specific criminal IDs."""
        entry = self._active.get(websocket)
        if entry is not None:
            entry["subscriptions"].difference_update(criminal_ids)

    async def send_personal(self, message: dict[str, Any], websocket: WebSocket) -> None:
        """Send a message to a single client."""
        await websocket.send_json(message)

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Broadcast a message to all connected clients."""
        dead: list[WebSocket] = []
        for ws in list(self._active):
            try:
                await ws.send_json(message)
            except Exception:  # noqa: BLE001 - client vanished
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def notify_alert(self, alert: dict[str, Any]) -> None:
        """
        Fan out an alert to every client, and also to clients subscribed to
        the alert's subject criminal ID.
        """
        subject_id = alert.get("criminal_id")
        for ws, entry in list(self._active.items()):
            if subject_id and subject_id in entry.get("subscriptions", set()):
                try:
                    await ws.send_json({"type": "alert.subscription", "data": alert})
                except Exception:  # noqa: BLE001
                    self.disconnect(ws)
        await self.broadcast({"type": "alert.new", "data": alert})

    @property
    def active_connections(self) -> int:
        """Number of currently connected clients."""
        return len(self._active)


# Singleton manager used by the alert service and WebSocket endpoint.
manager = AlertConnectionManager()
