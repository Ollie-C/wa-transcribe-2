from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import httpx

from .llm import complete_text
from .schemas import DependencyReadiness, ReadinessResponse, TextRequest, TextResponse
from .settings import settings
from .transcription import get_whisper_model, transcribe_file

SUPPORTED_AUDIO_SUFFIXES = {
    ".aac",
    ".m4a",
    ".mp3",
    ".mp4",
    ".mpeg",
    ".oga",
    ".ogg",
    ".opus",
    ".wav",
    ".webm",
}

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


def _max_upload_message() -> str:
    return f"Audio uploads are limited to {settings.max_upload_mb} MB."


def _max_text_message() -> str:
    return f"Text inputs are limited to {settings.max_text_input_chars} characters."


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


def _assert_audio_upload_allowed(file: UploadFile, contents: bytes, suffix: str) -> None:
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")

    if len(contents) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail=_max_upload_message())

    content_type = (file.content_type or "").strip().lower()
    if content_type and content_type.startswith("audio/"):
        return

    if suffix.lower() in SUPPORTED_AUDIO_SUFFIXES:
        return

    raise HTTPException(
        status_code=415,
        detail="Unsupported audio upload. Use a common audio format such as webm, m4a, mp3, wav, or opus.",
    )


def _assert_text_payload_allowed(payload: TextRequest) -> None:
    if len(payload.text) > settings.max_text_input_chars:
        raise HTTPException(status_code=413, detail=_max_text_message())

    if len(payload.instructions) > settings.max_text_input_chars:
        raise HTTPException(status_code=413, detail="Instructions are too long for this deployment.")

    if payload.context and len(payload.context) > settings.max_text_input_chars:
        raise HTTPException(status_code=413, detail="Context is too long for this deployment.")


def _resolve_frontend_asset(full_path: str) -> Path | None:
    build_dir = settings.frontend_build_path
    if not build_dir.exists():
        return None

    candidate = (build_dir / full_path).resolve()
    if not candidate.is_relative_to(build_dir):
        return None

    return candidate


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

        suffix = ".webm"
        if file.filename and "." in file.filename:
            suffix = f".{file.filename.rsplit('.', 1)[1]}"

        _assert_audio_upload_allowed(file, contents, suffix)
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
        _assert_text_payload_allowed(payload)
        text = await complete_text(
            text=payload.text,
            instructions=payload.instructions,
            context=payload.context,
        )
    except HTTPException:
        raise
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
        _assert_text_payload_allowed(payload)
        text = await complete_text(
            text=payload.text,
            instructions=payload.instructions,
            context=payload.context,
        )
    except HTTPException:
        raise
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


@app.get("/", include_in_schema=False)
@app.get("/{full_path:path}", include_in_schema=False)
async def frontend(full_path: str = "") -> FileResponse:
    if full_path.startswith("api/") or full_path.startswith("health"):
        raise HTTPException(status_code=404, detail="Not found.")

    if not settings.serve_frontend_from_backend:
        raise HTTPException(status_code=404, detail="Frontend hosting is disabled for this deployment.")

    build_dir = settings.frontend_build_path
    index_file = build_dir / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=503, detail="Frontend build output was not found. Run the hosted build first.")

    if full_path:
        asset = _resolve_frontend_asset(full_path)
        if asset and asset.is_file():
            return FileResponse(asset)

    return FileResponse(index_file)
