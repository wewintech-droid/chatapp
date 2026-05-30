# Chat App Deployment

This repository contains a React + TypeScript frontend and a Python WebSocket backend.

- Frontend: `src/` React app built with Vite.
- Backend: `server/ws_server.py` WebSocket server using `websockets`.

## Connection behavior

The frontend connects using the first available endpoint:

1. `VITE_WS_URL` from the Netlify environment.
2. `ws://<hostname>:8000/ws` as the local default.
3. A fallback PieSocket URL if the primary endpoints fail.

That means the app is ready for production deployment with a Render backend and Netlify frontend.

## Local development

Install dependencies and run the frontend locally:

```bash
npm install
npm run dev
```

Run the Python backend locally:

```bash
cd server
python -m venv .venv
.\.venv\Scripts\Activate
pip install -r requirements.txt
python ws_server.py
```

The frontend will connect to `ws://localhost:8000/ws` by default.

## Ready for Netlify

Netlify configuration is included in `netlify.toml`.

- Build command: `npm run build`
- Publish directory: `dist`
- Environment variable: `VITE_WS_URL`

Set `VITE_WS_URL` to your deployed backend URL, for example:

```env
VITE_WS_URL=wss://your-backend.onrender.com/ws
```

## Ready for Render

The backend is configured to read `HOST` and `PORT` from the environment.

A `Procfile` is included for Render:

```text
web: python ws_server.py
```

Render will provide the `PORT` automatically. The backend is ready to accept WebSocket connections at `wss://<your-service>.onrender.com/ws`.

## Environment examples

A root `.env.example` is provided for frontend deployment.

A `server/.env.example` is provided for backend deployment.

## Professional polish

- Added `netlify.toml` for frontend deployment.
- Added `Procfile` for Render backend deployment.
- Backend now reads `HOST` and `PORT` from the environment.
- Documentation updated for deploy-ready usage.
