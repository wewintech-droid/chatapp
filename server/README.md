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
