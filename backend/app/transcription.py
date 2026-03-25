from __future__ import annotations

import asyncio
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import TYPE_CHECKING, Any

from .settings import settings

if TYPE_CHECKING:
    from faster_whisper import WhisperModel

_model: Any | None = None
_model_lock = asyncio.Lock()


def _create_whisper_model() -> 'WhisperModel':
    try:
        from faster_whisper import WhisperModel
    except ModuleNotFoundError as exc:
        raise RuntimeError('faster-whisper is not installed. Reinstall backend requirements and restart the API.') from exc

    return WhisperModel(
        settings.whisper_model,
        device=settings.whisper_device,
        compute_type=settings.whisper_compute_type,
        cpu_threads=settings.whisper_cpu_threads,
        num_workers=settings.whisper_num_workers,
    )


async def get_whisper_model() -> 'WhisperModel':
    global _model

    if _model is not None:
        return _model

    async with _model_lock:
        if _model is None:
            _model = _create_whisper_model()

    return _model


async def transcribe_file(file_bytes: bytes, suffix: str, language: str = "en") -> dict[str, object]:
    model = await get_whisper_model()

    with NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_file.write(file_bytes)
        temp_path = Path(temp_file.name)

    try:
        segments_iter, _info = model.transcribe(
            str(temp_path),
            language=language,
            task="transcribe",
            beam_size=5,
            best_of=5,
            vad_filter=True,
            condition_on_previous_text=False,
        )
        segments = list(segments_iter)
    finally:
        temp_path.unlink(missing_ok=True)

    normalized_segments = [
        {
            "text": segment.text.strip(),
            "timestamp": [float(segment.start), float(segment.end)],
        }
        for segment in segments
        if segment.text.strip()
    ]

    return {
        "text": " ".join(segment["text"] for segment in normalized_segments).strip(),
        "chunks": normalized_segments,
        "model": settings.whisper_model,
    }
