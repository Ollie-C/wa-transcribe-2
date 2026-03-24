from __future__ import annotations

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import httpx

from .llm import complete_text
from .schemas import TextRequest, TextResponse
from .settings import settings
from .transcription import transcribe_file

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


@app.get("/health/llm")
async def llm_health() -> dict[str, str]:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(f"{settings.llm_base_url}/api/tags")
            response.raise_for_status()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM backend is unavailable: {exc}") from exc

    return {"status": "ok"}


@app.get("/health/whisper")
async def whisper_health() -> dict[str, str]:
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
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}") from exc

    return result


@app.post("/api/refine", response_model=TextResponse)
async def refine(payload: TextRequest) -> TextResponse:
    try:
        text = await complete_text(
            text=payload.text,
            instructions=payload.instructions,
            context=payload.context,
        )
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text.strip() or str(exc)
        raise HTTPException(status_code=502, detail=f"LLM request failed: {detail}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return TextResponse(text=text, model=settings.llm_model)


@app.post("/api/translate", response_model=TextResponse)
async def translate(payload: TextRequest) -> TextResponse:
    try:
        text = await complete_text(
            text=payload.text,
            instructions=payload.instructions,
            context=payload.context,
        )
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text.strip() or str(exc)
        raise HTTPException(status_code=502, detail=f"LLM request failed: {detail}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return TextResponse(text=text, model=settings.llm_model)
