from __future__ import annotations

import os
from dataclasses import dataclass


def _split_origins(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_host: str = os.getenv("APP_HOST", "127.0.0.1")
    app_port: int = int(os.getenv("APP_PORT", "8001"))
    cors_origins: list[str] = None  # type: ignore[assignment]
    cors_origin_regex: str = os.getenv(
        "CORS_ORIGIN_REGEX",
        r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    )
    llm_base_url: str = os.getenv("LLM_BASE_URL", "http://127.0.0.1:11434")
    llm_model: str = os.getenv("LLM_MODEL", "llama3.1:8b")
    llm_timeout_seconds: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "180"))
    whisper_model: str = os.getenv("WHISPER_MODEL", "small.en")
    whisper_device: str = os.getenv("WHISPER_DEVICE", "auto")
    whisper_compute_type: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    whisper_cpu_threads: int = int(os.getenv("WHISPER_CPU_THREADS", "4"))
    whisper_num_workers: int = int(os.getenv("WHISPER_NUM_WORKERS", "1"))

    def __post_init__(self) -> None:
        origins = _split_origins(os.getenv("CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173"))
        object.__setattr__(self, "cors_origins", origins)


settings = Settings()
