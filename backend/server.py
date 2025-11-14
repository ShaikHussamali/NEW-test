from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
import uvicorn
import asyncio
import json

app = FastAPI()

# In case you want to serve frontend build from backend later
app.mount("/static", StaticFiles(directory="./static"), name="static")

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
        self.player_states: dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        # initialize default player state
        self.player_states[client_id] = {"id": client_id, "x": 400, "y": 300, "angle": 0}
        # broadcast join
        await self.broadcast({"type": "join", "payload": self.player_states[client_id]})
        # send snapshot to the newly connected client
        try:
            await websocket.send_text(json.dumps({"type": "snapshot", "payload": list(self.player_states.values())}))
        except Exception:
            pass

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.player_states:
            # remove state and notify others
            del self.player_states[client_id]
            # best-effort notify (async)
            asyncio.create_task(self.broadcast({"type": "leave", "payload": {"id": client_id}}))

    async def broadcast(self, message: dict):
        data = json.dumps(message)
        to_remove = []
        for cid, ws in self.active_connections.items():
            try:
                await ws.send_text(data)
            except Exception:
                to_remove.append(cid)
        for cid in to_remove:
            self.disconnect(cid)

manager = ConnectionManager()

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    print(f"Client connected: {client_id}")
    try:
        while True:
            text = await websocket.receive_text()
            try:
                message = json.loads(text)
            except Exception:
                # ignore invalid json
                continue
            # For now, simply echo game-state updates to all clients
            if message.get("type") == "update":
                # message should contain client_id, x, y, angle, action
                payload = message.get("payload") or {}
                cid = payload.get("id")
                if cid:
                    # update stored state
                    self_state = manager.player_states.get(cid, {})
                    self_state.update({k: payload.get(k, self_state.get(k)) for k in ("x","y","angle")})
                    manager.player_states[cid] = self_state
                    await manager.broadcast({"type": "state", "payload": self_state})
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        print(f"Client disconnected: {client_id}")


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
