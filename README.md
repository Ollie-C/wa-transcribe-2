# wa-transcribe-2

`wa-transcribe-2` is a local-first transcription app built with:

- SvelteKit (frontend)
- FastAPI (backend)
- local Whisper (`faster-whisper`) for speech-to-text
- Ollama + Llama for refinement and translation

The default development flow runs everything on your machine.

## Prerequisites

Install these tools before setup:

- Node.js 20+ and `pnpm`
- Python 3.10+
- Ollama ([official download](https://ollama.com/download))

## Quick start (recommended)

From the repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
cd ..
pnpm install
pnpm dev:local
```

`pnpm dev:local` will:

- start Ollama if needed
- pull `llama3.1:8b` if needed
- start the FastAPI backend
- start the SvelteKit frontend

## Manual setup

If you prefer to run each part separately, follow [`backend/README.md`](backend/README.md).

## Configuration

- Frontend API base URL defaults to `http://127.0.0.1:8001`
- Override it with `VITE_API_BASE_URL`, for example:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8001
```
