# Python WebSocket Server

A minimal Python WebSocket backend for the React chat client.

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate
pip install -r requirements.txt
```

## Run

```powershell
python ws_server.py
```

The client should connect to:

```ts
const WS_URL = "ws://127.0.0.1:8000/ws";
```

Once the server is running, open the app in two browsers and use different usernames to chat.

## Deploying to Render

This server is ready to deploy on Render as a Web Service. A `Procfile` is included with a simple start command.

Steps:

1. Push the repository to GitHub (already done).
2. In Render dashboard, create a new "Web Service" and connect your repo.
3. Set the start command (Render will read `Procfile` automatically) or use:

```
python ws_server.py
```

4. Set environment variables if needed:
- `PORT` (Render will provide one automatically)
- `HOST` (defaults to `0.0.0.0`)

After deployment you will have a public URL like `https://your-service.onrender.com` — use `wss://your-service.onrender.com/ws` as the frontend `VITE_WS_URL`.

## Local environment example

Copy `server/.env.example` to `server/.env` if you want to use a local environment file for `HOST` and `PORT`.

Note: Render supports WebSockets and will terminate TLS for `wss://` connections automatically.
