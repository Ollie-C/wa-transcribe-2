from __future__ import annotations

from textwrap import dedent

import httpx

from .settings import settings


def _build_user_message(text: str, context: str | None) -> str:
    context_block = context.strip() if context else "No additional context."
    return dedent(
        f"""
        Context:
        {context_block}

        Text:
        {text.strip()}
        """
    ).strip()


async def complete_text(*, text: str, instructions: str, context: str | None = None) -> str:
    payload = {
        "model": settings.llm_model,
        "stream": False,
        "options": {
            "temperature": 0.1,
        },
        "messages": [
            {"role": "system", "content": instructions.strip()},
            {"role": "user", "content": _build_user_message(text, context)},
        ],
    }

    async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
        response = await client.post(
            f"{settings.llm_base_url}/api/chat",
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    message = data.get("message", {})
    content = message.get("content", "").strip()
    if not content:
        raise ValueError("The LLM returned an empty response.")

    return content
