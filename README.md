# NEW-test Action Game Prototype

This repository contains a minimal prototype: a Python FastAPI backend (WebSocket) and a React + Vite frontend that connects to it and renders a simple canvas-based action game.

Prerequisites
- Python 3.10+ installed
- Node.js 18+ and npm or pnpm

Run backend (PowerShell)

1. Open PowerShell in the repository root.
2. Install Python deps and run:

```powershell
cd backend
python -m venv .venv
. .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python server.py
```

This starts the backend on http://localhost:8000 and a WebSocket endpoint at ws://localhost:8000/ws/{client_id}

Run frontend (PowerShell)

1. In a new PowerShell window:

```powershell
cd frontend
npm install
npm run dev
```

Open the dev URL Vite prints (usually http://localhost:5173). The game client connects to ws://localhost:8000 by default.

Notes and next steps
- This is a prototype: the backend simply echoes state updates to all connected clients. The frontend sends local player position updates when you move (WASD / arrows) and draws other players if present.
- To serve the built frontend from the backend, build the frontend (`npm run build`) and copy the output into `backend/static` and adjust paths.
- Improvements: handle player join/leave messages, authoritative server physics, bullets, collision, input prediction, and authentication.
# NEW-test