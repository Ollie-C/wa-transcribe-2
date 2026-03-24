from __future__ import annotations

from pydantic import BaseModel, Field


class TextRequest(BaseModel):
    text: str = Field(min_length=1)
    instructions: str = Field(min_length=1)
    context: str | None = None


class TextResponse(BaseModel):
    text: str
    model: str
