# Backend setup

This FastAPI service powers:

- transcription through local `faster-whisper`
- transcript refinement through Ollama
- English to Japanese translation through Ollama
- readiness checks for the local-first frontend

## Prerequisites

- Python 3.10+
- Ollama: [official download](https://ollama.com/download)

## 1. Create the virtual environment

From the repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## 2. Start Ollama and install the configured model

```bash
ollama serve
ollama pull llama3.1:8b
```

By default the backend expects Ollama at `http://127.0.0.1:11434`.

If you change the model name, update `LLM_MODEL` in `.env`.

## 3. Start the API

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

## 4. Verify health and readiness

In another terminal:

```bash
curl http://127.0.0.1:8001/health
curl http://127.0.0.1:8001/health/llm
curl http://127.0.0.1:8001/health/whisper
curl http://127.0.0.1:8001/health/readiness
```

`/health/readiness` is the most complete local-first check. It reports:

- API reachability
- Ollama reachability
- whether the configured Ollama model is installed
- whether Whisper can load successfully

## 5. Start the frontend

From the repository root:

```bash
pnpm install
pnpm dev
```

Or use the recommended one-command flow:

```bash
pnpm dev:local
```

## Troubleshooting

If `/health/llm` fails:

- confirm Ollama is running
- confirm `LLM_BASE_URL` points to the right host
- confirm the configured model exists with `ollama list`

If `/health/whisper` fails:

- confirm `faster-whisper` installed inside `.venv`
- confirm `WHISPER_MODEL` is valid in `.env`
- restart `uvicorn` after config changes

If refinement or translation says the model is missing:

```bash
ollama pull llama3.1:8b
```

If CORS fails in local development:

- keep the frontend on `localhost` or `127.0.0.1`
- update `CORS_ORIGINS` or `CORS_ORIGIN_REGEX` in `.env`
- restart `uvicorn`

## Tests

Run the backend API tests with the standard library test runner:

```bash
.venv/bin/python -m unittest discover -s tests
```
