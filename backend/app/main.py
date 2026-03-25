from __future__ import annotations

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import httpx

from .llm import complete_text
from .schemas import DependencyReadiness, ReadinessResponse, TextRequest, TextResponse
from .settings import settings
from .transcription import get_whisper_model, transcribe_file

app = FastAPI(title="WA Transcribe 2 Local API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


def _dependency_status(*, ready: bool, status: str, detail: str) -> DependencyReadiness:
    return DependencyReadiness(ready=ready, status=status, detail=detail)


def _llm_unavailable_message() -> str:
    return f'Ollama is unavailable at {settings.llm_base_url}. Start Ollama and retry.'


def _model_missing_message() -> str:
    return f'Ollama model "{settings.llm_model}" is not installed. Run `ollama pull {settings.llm_model}` and retry.'


def _whisper_error_message(error: Exception) -> str:
    detail = str(error).strip()
    lowered = detail.lower()

    if 'faster-whisper' in lowered or 'module named' in lowered:
        return 'Whisper is unavailable because faster-whisper is not installed. Reinstall backend requirements and restart the API.'

    if 'model' in lowered and ('not found' in lowered or 'does not exist' in lowered or 'invalid' in lowered):
        return f'Whisper model "{settings.whisper_model}" could not be loaded. Check WHISPER_MODEL in backend/.env and retry.'

    return detail or f'Whisper is unavailable. Check backend/.env and the model setting "{settings.whisper_model}".'


async def _fetch_ollama_tags() -> list[str]:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(f"{settings.llm_base_url}/api/tags")
        response.raise_for_status()
        payload = response.json()

    return [
        str(model.get("name", "")).strip()
        for model in payload.get("models", [])
        if str(model.get("name", "")).strip()
    ]


async def _collect_readiness() -> ReadinessResponse:
    api_status = _dependency_status(ready=True, status='ready', detail='API is reachable.')

    try:
        installed_models = await _fetch_ollama_tags()
        ollama_status = _dependency_status(
            ready=True,
            status='ready',
            detail=f'Ollama is reachable at {settings.llm_base_url}.',
        )
    except httpx.RequestError:
        installed_models = []
        ollama_status = _dependency_status(
            ready=False,
            status='offline',
            detail=_llm_unavailable_message(),
        )
    except httpx.HTTPStatusError as exc:
        installed_models = []
        ollama_status = _dependency_status(
            ready=False,
            status='offline',
            detail=f'Ollama returned {exc.response.status_code}. Check the Ollama service and retry.',
        )

    if ollama_status.ready and settings.llm_model in installed_models:
        llm_model_status = _dependency_status(
            ready=True,
            status='ready',
            detail=f'Ollama model "{settings.llm_model}" is installed.',
        )
    elif ollama_status.ready:
        llm_model_status = _dependency_status(
            ready=False,
            status='missing',
            detail=_model_missing_message(),
        )
    else:
        llm_model_status = _dependency_status(
            ready=False,
            status='offline',
            detail='The Ollama model cannot be checked until Ollama is running.',
        )

    try:
        await get_whisper_model()
        whisper_status = _dependency_status(
            ready=True,
            status='ready',
            detail=f'Whisper model "{settings.whisper_model}" is ready.',
        )
    except Exception as exc:
        whisper_status = _dependency_status(
            ready=False,
            status='unavailable',
            detail=_whisper_error_message(exc),
        )

    overall_ready = ollama_status.ready and llm_model_status.ready and whisper_status.ready
    return ReadinessResponse(
        status='ready' if overall_ready else 'degraded',
        api=api_status,
        ollama=ollama_status,
        llm_model=llm_model_status,
        whisper=whisper_status,
    )


@app.get("/health/readiness", response_model=ReadinessResponse)
async def readiness() -> ReadinessResponse:
    return await _collect_readiness()


@app.get("/health/llm")
async def llm_health() -> dict[str, str]:
    try:
        installed_models = await _fetch_ollama_tags()
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=_llm_unavailable_message()) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f'Ollama returned {exc.response.status_code}. Check the Ollama service and retry.') from exc

    if settings.llm_model not in installed_models:
        raise HTTPException(status_code=502, detail=_model_missing_message())

    return {"status": "ok"}


@app.get("/health/whisper")
async def whisper_health() -> dict[str, str]:
    try:
        await get_whisper_model()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=_whisper_error_message(exc)) from exc

    return {"status": "ok"}


@app.post("/api/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: str = Form("english"),
) -> dict[str, object]:
    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")

        suffix = ".webm"
        if file.filename and "." in file.filename:
            suffix = f".{file.filename.rsplit('.', 1)[1]}"

        whisper_language = "en" if language.lower().startswith("english") else language
        result = await transcribe_file(contents, suffix, whisper_language)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Transcription failed: {_whisper_error_message(exc)}') from exc

    return result


@app.post("/api/refine", response_model=TextResponse)
async def refine(payload: TextRequest) -> TextResponse:
    try:
        text = await complete_text(
            text=payload.text,
            instructions=payload.instructions,
            context=payload.context,
        )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=_llm_unavailable_message()) from exc
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(status_code=502, detail=_model_missing_message()) from exc

        detail = exc.response.text.strip() or str(exc)
        raise HTTPException(status_code=502, detail=f"LLM request failed: {detail}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'LLM request failed: {exc}') from exc

    return TextResponse(text=text, model=settings.llm_model)


@app.post("/api/translate", response_model=TextResponse)
async def translate(payload: TextRequest) -> TextResponse:
    try:
        text = await complete_text(
            text=payload.text,
            instructions=payload.instructions,
            context=payload.context,
        )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=_llm_unavailable_message()) from exc
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(status_code=502, detail=_model_missing_message()) from exc

        detail = exc.response.text.strip() or str(exc)
        raise HTTPException(status_code=502, detail=f"LLM request failed: {detail}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'LLM request failed: {exc}') from exc

    return TextResponse(text=text, model=settings.llm_model)
