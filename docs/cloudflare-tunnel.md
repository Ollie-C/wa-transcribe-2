# Cloudflare Tunnel + Access Runbook

This is the recommended public setup for `wa-transcribe-2` when the app is still self-hosted on your MacBook.

The final shape is:

- one public hostname such as `app.example.com`
- Cloudflare Tunnel from that hostname to `http://127.0.0.1:8001`
- Cloudflare Access in front of the hostname
- One-Time PIN login for exactly two email addresses
- FastAPI serving both the frontend and the API from one local origin

## 1. Prepare the local app

From the repo root:

```bash
pnpm install
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
cd ..
```

Ensure Ollama is installed and the configured model exists:

```bash
ollama serve
ollama pull llama3.1:8b
```

## 2. Configure hosted mode

In `backend/.env`, use or confirm:

```env
APP_HOST=127.0.0.1
APP_PORT=8001
SERVE_FRONTEND_FROM_BACKEND=true
FRONTEND_BUILD_DIR=../build
MAX_UPLOAD_MB=25
MAX_TEXT_INPUT_CHARS=16000
```

Keep the app bound to `127.0.0.1` because only `cloudflared` needs to reach it.

## 3. Start the hosted app locally

From the repo root:

```bash
pnpm serve:hosted
```

That will:

- build the frontend in hosted mode with same-origin `/api/*` requests
- start FastAPI on `127.0.0.1:8001`
- serve the frontend and API from the same origin

Confirm it works locally:

```bash
curl http://127.0.0.1:8001/health
curl http://127.0.0.1:8001/health/readiness
```

## 4. Install and create the named tunnel

Install `cloudflared` using the official Cloudflare instructions for macOS.

Then authenticate and create a named tunnel:

```bash
cloudflared tunnel login
cloudflared tunnel create wa-transcribe-2
cloudflared tunnel route dns wa-transcribe-2 app.example.com
```

This creates a credentials file in `~/.cloudflared/`.

## 5. Create the local tunnel config

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: wa-transcribe-2
credentials-file: /Users/<your-user>/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: app.example.com
    service: http://127.0.0.1:8001
  - service: http_status:404
```

Use your real tunnel credentials path.

## 6. Add Cloudflare Access before opening the app

In Cloudflare Zero Trust:

1. Go to Access > Applications
2. Add a **Self-hosted** application
3. Use `app.example.com`
4. Select **One-Time PIN** as the login method
5. Add an **Allow** policy for exactly the two email addresses that should use the app
6. Leave everyone else denied
7. Set session duration to **30 days**

Do this before you treat the app as live.

## 7. Protect the tunnel/origin

In the tunnel/public hostname setup, enable the Cloudflare Access protection path so requests that do not have valid Access authentication are rejected before they reach the origin.

The app itself should stay auth-free; Cloudflare Access is the auth layer.

## 8. Run the tunnel as a service

Install `cloudflared` as a macOS service / launch agent using the official Cloudflare instructions. That keeps the tunnel alive across shell restarts and reboots.

## 9. Add edge protections

In Cloudflare, configure simple rate limits for the app hostname:

- `POST /api/transcribe`
  - 12 requests per 10 minutes per IP
  - block for 10 minutes
- `POST /api/refine`
  - 60 requests per 10 minutes per IP
  - managed challenge or block
- `POST /api/translate`
  - 60 requests per 10 minutes per IP
  - managed challenge or block
- `/api/*`
  - 180 requests per 10 minutes per IP
  - managed challenge

These are intentionally modest protections for a tiny two-person tool, not a full production abuse system.

## 10. Daily usage

For the app to work remotely:

- your MacBook must be on and awake
- Ollama must be running
- `pnpm serve:hosted` must be running
- `cloudflared` must be running

Your partner then opens:

```text
https://app.example.com
```

Cloudflare Access will prompt for One-Time PIN occasionally, then the app loads normally.

## 11. Smoke checklist

- The public URL shows the Cloudflare Access gate first
- Your email can get through
- Your partner’s email can get through
- Any other email is denied
- The app loads after successful Access auth
- Upload/transcribe/refine/translate all work
- Large uploads fail cleanly
- Turning off the Mac or stopping `cloudflared` makes the app unavailable in an obvious way
