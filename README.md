# wa-transcribe-2

`wa-transcribe-2` is a local-first transcription app for short voice notes and interviews. It gives you:

- local Whisper transcription
- optional cleanup and bounded local Llama refinement
- optional English to Japanese translation
- browser-side session history and export tools

The current public release target is local-first use on your own machine.

## What This App Is

- A SvelteKit + FastAPI workflow that runs against your local Ollama and Whisper stack
- A fast way to upload or record audio, transcribe it, clean it up, and export the result
- A private local workflow where audio stays on your machine

## What This App Is Not

- Not a hosted SaaS product
- Not multi-user
- Not an authenticated cloud deployment
- Not a substitute for production hosting hardening, quotas, or abuse controls

If we later ship a hosted beta, that will be a separate product track.

## Quick Start

Install these first:

- Node.js 20+
- `pnpm`
- Python 3.10+
- Ollama: [official download](https://ollama.com/download)

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

- start Ollama if it is not already running
- pull `llama3.1:8b` if it is missing
- start the FastAPI backend on `http://127.0.0.1:8001`
- start the SvelteKit frontend

The first run can take a few minutes because local models may need to download or warm up.

## Confirm Everything Is Ready

Open the app in your browser and check the **Setup status** card at the top of the page.

You are ready for public local-first use when it shows:

- Backend: ready
- Transcription: ready
- Refinement + Translation: ready

The fastest happy path is:

1. Upload or record audio
2. Click `Transcribe`
3. Optionally add cleanup rules or refine
4. Optionally translate to Japanese
5. Export `.txt` or the full Markdown bundle

## Troubleshooting

If the app says the backend is offline:

- rerun `pnpm dev:local`
- confirm the backend is healthy with `curl http://127.0.0.1:8001/health`

If the app says Ollama is offline:

- start Ollama manually with `ollama serve`
- verify it with `curl http://127.0.0.1:11434/api/tags`

If the app says the model is missing:

- run `ollama pull llama3.1:8b`

If the app says Whisper is unavailable:

- check `backend/.env`
- confirm backend dependencies installed cleanly inside `backend/.venv`
- restart the backend after changing config

If `pnpm dev:local` fails:

- backend logs: `/tmp/wa-transcribe-backend.log`
- Ollama logs: `/tmp/wa-transcribe-ollama.log`

## Manual Setup

If you want to run each piece yourself, follow [backend/README.md](./backend/README.md).

## Configuration

Frontend:

- `VITE_API_BASE_URL` defaults to `http://127.0.0.1:8001`

Backend:

- copy `backend/.env.example` to `backend/.env`
- adjust `LLM_MODEL`, `WHISPER_MODEL`, or host/port values as needed

## Quality Checks

Frontend:

```bash
pnpm test
pnpm check
pnpm build
```

Backend:

```bash
cd backend
.venv/bin/python -m unittest discover -s tests
```
