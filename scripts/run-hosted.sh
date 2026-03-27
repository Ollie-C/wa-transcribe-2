#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
BACKEND_VENV="$BACKEND_DIR/.venv"
APP_HOST="${APP_HOST:-127.0.0.1}"
APP_PORT="${APP_PORT:-8001}"
OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"
FRONTEND_BUILD_DIR="${FRONTEND_BUILD_DIR:-$ROOT_DIR/build}"

if [[ ! -x "$BACKEND_VENV/bin/python" ]]; then
  echo "Backend virtualenv not found at $BACKEND_VENV."
  echo "Create it first from the backend directory."
  exit 1
fi

if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama is not installed."
  exit 1
fi

if ! curl -fsS "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
  echo "Ollama is not reachable at $OLLAMA_URL."
  echo "Start Ollama first, then rerun this script."
  exit 1
fi

echo "Building the hosted frontend bundle..."
cd "$ROOT_DIR"
pnpm build:hosted

if [[ ! -f "$FRONTEND_BUILD_DIR/index.html" ]]; then
  echo "Hosted frontend build not found at $FRONTEND_BUILD_DIR."
  exit 1
fi

echo "Starting hosted app on http://$APP_HOST:$APP_PORT"
echo "This origin stays local; expose it through Cloudflare Tunnel."

cd "$BACKEND_DIR"
source "$BACKEND_VENV/bin/activate"
export PYTHONPATH="$BACKEND_DIR"
export SERVE_FRONTEND_FROM_BACKEND=true
export FRONTEND_BUILD_DIR="$FRONTEND_BUILD_DIR"
uvicorn app.main:app --host "$APP_HOST" --port "$APP_PORT"
