# Backend setup

The backend is a FastAPI service for transcription, refinement, and translation.
It is designed to run locally with your own Ollama and Whisper stack.

## Prerequisites

Install:

- Python 3.10+
- Ollama ([official download](https://ollama.com/download))

## 1) Create a virtual environment

From the repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## 2) Start Ollama and pull a model

```bash
ollama serve
ollama pull llama3.1:8b
```

Ollama runs at `http://127.0.0.1:11434` by default.

If you want to use a different model, update `LLM_MODEL` in `.env`.

## 3) Start the FastAPI server

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

The backend also uses local Whisper via `faster-whisper`.
Default transcription and model settings are in `.env.example`.

## 4) Verify health endpoints

In a new terminal:

```bash
curl http://127.0.0.1:8001/health
curl http://127.0.0.1:8001/health/llm
curl http://127.0.0.1:8001/health/whisper
```

## 5) Start the frontend

From the repository root:

```bash
pnpm install
pnpm dev
```

Or run everything together from the root:

```bash
pnpm dev:local
```

## Notes

- For local development, CORS allows `localhost` and `127.0.0.1` origins.
- To target a different backend URL in the frontend, set `VITE_API_BASE_URL`.
- If you change backend CORS settings in `.env`, restart `uvicorn`.
