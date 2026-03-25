#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
BACKEND_VENV="$BACKEND_DIR/.venv"
OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"
API_URL="${VITE_API_BASE_URL:-http://127.0.0.1:8001}"
MODEL_NAME="${OLLAMA_MODEL:-llama3.1:8b}"

BACKEND_PID=""
OLLAMA_STARTED_BY_SCRIPT="0"

cleanup() {
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi

  if [[ "$OLLAMA_STARTED_BY_SCRIPT" == "1" ]]; then
    pkill -f "ollama serve" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama is not installed."
  echo "Install it first, then rerun this script."
  echo "macOS download: https://ollama.com/download/mac"
  exit 1
fi

if [[ ! -x "$BACKEND_VENV/bin/python" ]]; then
  echo "Backend virtualenv not found at $BACKEND_VENV."
  echo "Run:"
  echo "  cd backend"
  echo "  python3 -m venv .venv"
  echo "  source .venv/bin/activate"
  echo "  pip install -r requirements.txt"
  exit 1
fi

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  echo "backend/.env not found. Copying from backend/.env.example..."
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
fi

if ! curl -fsS "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
  echo "Starting Ollama..."
  echo "Ollama logs: /tmp/wa-transcribe-ollama.log"
  ollama serve >/tmp/wa-transcribe-ollama.log 2>&1 &
  OLLAMA_STARTED_BY_SCRIPT="1"
  sleep 3
fi

if ! ollama list | grep -q "^$MODEL_NAME[[:space:]]"; then
  echo "Pulling Ollama model $MODEL_NAME..."
  ollama pull "$MODEL_NAME"
fi

echo "Starting FastAPI backend..."
(
  cd "$BACKEND_DIR"
  source "$BACKEND_VENV/bin/activate"
  export PYTHONPATH="$BACKEND_DIR"
  uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
) >/tmp/wa-transcribe-backend.log 2>&1 &
BACKEND_PID=$!

sleep 2

if ! curl -fsS "$API_URL/health" >/dev/null 2>&1; then
  echo "Backend did not become healthy."
  echo "Check /tmp/wa-transcribe-backend.log"
  echo "If Ollama was started by this script, also check /tmp/wa-transcribe-ollama.log"
  exit 1
fi

echo "Backend is healthy at $API_URL"
echo "Open the app and use the Setup status card if Whisper or Ollama still need attention."
echo "Starting frontend..."
cd "$ROOT_DIR"
VITE_API_BASE_URL="$API_URL" pnpm dev
