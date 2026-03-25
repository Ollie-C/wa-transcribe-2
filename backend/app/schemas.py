from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TextRequest(BaseModel):
    text: str = Field(min_length=1)
    instructions: str = Field(min_length=1)
    context: str | None = None


class TextResponse(BaseModel):
    text: str
    model: str


ReadinessState = Literal['ready', 'offline', 'missing', 'unavailable']
OverallReadinessState = Literal['ready', 'degraded']


class DependencyReadiness(BaseModel):
    ready: bool
    status: ReadinessState
    detail: str


class ReadinessResponse(BaseModel):
    status: OverallReadinessState
    api: DependencyReadiness
    ollama: DependencyReadiness
    llm_model: DependencyReadiness
    whisper: DependencyReadiness
