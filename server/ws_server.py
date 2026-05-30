import asyncio
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from websockets import serve
from websockets.exceptions import ConnectionClosedOK, ConnectionClosedError

# Read host/port from environment for flexible deployment (Render, Docker, etc.)
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", os.getenv("WS_PORT", "8000")))


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: Dict[str, Any] = {}
        self.message_history: List[Dict[str, Any]] = []

    async def register(self, username: str, websocket: Any) -> None:
        existing = self.active_connections.get(username)
        if existing and existing != websocket:
            await existing.close()

        self.active_connections[username] = websocket
        await self.send_existing_users(websocket, username)
        await self.safe_send(websocket, {"type": "online_users", "payload": list(self.active_connections.keys())})
        await self.broadcast({"type": "user_online", "payload": {"username": username}}, exclude=username)

    async def unregister(self, username: str) -> None:
        if username in self.active_connections:
            self.active_connections.pop(username, None)
            await self.broadcast({"type": "user_offline", "payload": {"username": username}})

    async def send_existing_users(self, websocket: Any, username: str) -> None:
        for current_username in self.active_connections:
            if current_username == username:
                continue
            await self.safe_send(websocket, {"type": "user_online", "payload": {"username": current_username}})

    async def send_personal(self, message: dict, username: str) -> None:
        websocket = self.active_connections.get(username)
        if websocket:
            await self.safe_send(websocket, message)

    async def broadcast(self, message: dict, exclude: Optional[str] = None) -> None:
        for user, websocket in list(self.active_connections.items()):
            if user == exclude:
                continue
            await self.safe_send(websocket, message)

    async def safe_send(self, websocket: Any, message: dict) -> None:
        try:
            await websocket.send(json.dumps(message))
        except (ConnectionClosedOK, ConnectionClosedError):
            pass

    async def store_message(self, payload: dict, chat_key: str, recipients: List[str]) -> None:
        record = {
            "id": payload.get("id"),
            "chat_key": chat_key,
            "payload": payload,
            "recipients": recipients,
            "saved": payload.get("saved", False),
            "expires_at": payload.get("expiresAt"),
        }
        self.message_history.append(record)

    async def cleanup_history(self) -> None:
        while True:
            now = datetime.now(timezone.utc).timestamp()
            expired = [entry for entry in self.message_history if entry["expires_at"] and not entry["saved"] and datetime.fromisoformat(entry["expires_at"]).replace(tzinfo=timezone.utc).timestamp() <= now]
            for entry in expired:
                self.message_history.remove(entry)
                for user in entry["recipients"]:
                    await self.send_personal({
                        "type": "message_deleted",
                        "payload": {
                            "messageId": entry["id"],
                            "chatKey": entry["chat_key"],
                        }
                    }, user)
            await asyncio.sleep(60)


manager = ConnectionManager()


async def broadcast_or_personal(message: dict, payload: dict, username: str) -> None:
    if payload.get("roomId"):
        await manager.broadcast(message, exclude=username)
        return

    target = payload.get("to")
    if isinstance(target, str) and target:
        await manager.send_personal(message, target)
    else:
        await manager.broadcast(message, exclude=username)


async def handle_message(message: dict, websocket: Any, username: str) -> None:
    message_type = message.get("type")
    payload = message.get("payload", {})

    if message_type == "ping":
        await manager.safe_send(websocket, {"type": "pong"})
        return

    if message_type in {"message_sent", "room_message"}:
        if message_type == "message_sent":
            recipients = [username]
            target = payload.get("to")
            if isinstance(target, str) and target:
                recipients.append(target)
                await manager.send_personal({"type": "message", "payload": payload}, target)
                await manager.safe_send(websocket, {
                    "type": "message_delivered",
                    "payload": {
                        "messageId": payload.get("id"),
                        "chatKey": target,
                        "to": target,
                        "timestamp": payload.get("timestamp"),
                    }
                })
            else:
                await manager.safe_send(websocket, {
                    "type": "message",
                    "payload": payload
                })
                await manager.safe_send(websocket, {
                    "type": "message_delivered",
                    "payload": {
                        "messageId": payload.get("id"),
                        "chatKey": username,
                        "to": username,
                        "timestamp": payload.get("timestamp"),
                    }
                })
            await manager.store_message(payload, target or username, recipients)
            return

        if message_type == "room_message":
            await manager.broadcast({"type": "room_message", "payload": payload}, exclude=username)
            await manager.store_message(payload, payload.get("roomId"), list(manager.active_connections.keys()))
            return

    if message_type in {"typing_start", "typing_stop"}:
        await broadcast_or_personal({"type": message_type, "payload": payload}, payload, username)
        return

    if message_type in {"chat_active", "chat_inactive"}:
        await manager.broadcast({"type": message_type, "payload": payload}, exclude=username)
        return

    if message_type == "message_saved":
        for entry in manager.message_history:
            if entry["id"] == payload.get("messageId") and entry["chat_key"] == payload.get("chatKey"):
                entry["saved"] = payload.get("saved", False)
                entry["expires_at"] = None if entry["saved"] else entry.get("expires_at")
                break
        await manager.safe_send(websocket, {"type": "message_saved", "payload": payload})
        return

    if message_type == "message_read":
        target = payload.get("to")
        if isinstance(target, str) and target:
            await manager.send_personal({"type": "message_read", "payload": payload}, target)
        elif payload.get("roomId"):
            await manager.broadcast({"type": "message_read", "payload": payload}, exclude=username)
        else:
            await manager.broadcast({"type": "message_read", "payload": payload}, exclude=username)
        return

    if message_type == "privacy_update":
        await manager.broadcast({"type": "privacy_update", "payload": payload}, exclude=username)
        return

    if message_type in {"call_offer", "call_answer", "ice_candidate", "call_end"}:
        target = payload.get("to")
        call_message = {"type": message_type, "payload": payload}
        if target:
            await manager.send_personal(call_message, target)
        else:
            await manager.broadcast(call_message, exclude=username)
        return


async def ws_handler(websocket: Any) -> None:
    username: Optional[str] = None
    try:
        async for raw_message in websocket:
            try:
                message = json.loads(raw_message)
            except json.JSONDecodeError:
                continue

            if username is None:
                if message.get("type") != "auth":
                    continue

                payload = message.get("payload", {})
                username = payload.get("username")
                if not username:
                    continue

                await manager.register(username, websocket)
                continue

            await handle_message(message, websocket, username)

    except (ConnectionClosedOK, ConnectionClosedError):
        pass
    finally:
        if username:
            await manager.unregister(username)


async def main() -> None:
    print(f"Starting WebSocket server on ws://{HOST}:{PORT}/ws")
    async with serve(ws_handler, HOST, PORT):
        await asyncio.gather(asyncio.Future(), manager.cleanup_history())


if __name__ == "__main__":
    asyncio.run(main())
