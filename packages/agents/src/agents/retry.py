import asyncio
import logging
import random
from collections.abc import Awaitable, Callable

import httpx
from langchain_core.exceptions import OutputParserException
from pydantic import ValidationError

from agents.config import AgentSettings
from agents.devlog import devlog, secs

logger = logging.getLogger(__name__)


class LLMOutputError(Exception):
    """The model returned nothing usable (empty or unparsable output)."""


def _chain(exc: BaseException) -> list[BaseException]:
    seen: list[BaseException] = []
    current: BaseException | None = exc
    while current is not None and current not in seen:
        seen.append(current)
        current = current.__cause__ or current.__context__
    return seen


def _status_code(exc: BaseException) -> int | None:
    for e in _chain(exc):
        code = getattr(e, "code", None) or getattr(e, "status_code", None)
        if isinstance(code, int):
            return code
    return None


_OUTPUT_ERRORS = (LLMOutputError, OutputParserException, ValidationError)
_TRANSPORT_ERRORS = (TimeoutError, httpx.TransportError, ConnectionError)


def is_retryable(exc: BaseException) -> bool:
    """Retry rate limits, server errors, timeouts and unusable output. Never other 4xx."""
    code = _status_code(exc)
    if code is not None:
        return code == 429 or code >= 500
    return any(isinstance(e, _OUTPUT_ERRORS + _TRANSPORT_ERRORS) for e in _chain(exc))


def error_code(exc: BaseException) -> str | None:
    """A short code for logs and the UI, e.g. "429 RESOURCE_EXHAUSTED", "503", "TIMEOUT".

    Built from the provider's HTTP code and status name only, never its message text.
    """
    for e in _chain(exc):
        code = getattr(e, "code", None) or getattr(e, "status_code", None)
        if isinstance(code, int):
            status = getattr(e, "status", None)
            return f"{code} {status}" if isinstance(status, str) and status else str(code)
    if any(isinstance(e, _TRANSPORT_ERRORS) for e in _chain(exc)):
        return "TIMEOUT"
    if any(isinstance(e, _OUTPUT_ERRORS) for e in _chain(exc)):
        return "BAD_OUTPUT"
    return None


def describe_error(exc: BaseException) -> str:
    """A safe, user-facing message for a failed LLM call (never leaks provider details)."""
    code = _status_code(exc)
    if code == 429:
        return "The AI service is rate-limiting requests right now. Please wait a minute and retry."
    if code is not None and code >= 500:
        return "The AI service is temporarily unavailable. Please try again shortly."
    if any(isinstance(e, _TRANSPORT_ERRORS) for e in _chain(exc)):
        return "The AI service took too long to respond. Please try again."
    if any(isinstance(e, _OUTPUT_ERRORS) for e in _chain(exc)):
        return "The AI returned a response we could not read. Please try again."
    return "The AI service could not complete this step."


async def with_retry[T](
    fn: Callable[[], Awaitable[T]],
    settings: AgentSettings,
    on_retry: Callable[[], None] | None = None,
    label: str | None = None,
) -> T:
    """Run `fn`, retrying retryable failures with exponential backoff (1s, 2s, 4s...) + jitter."""
    attempt = 1
    while True:
        try:
            return await fn()
        except Exception as exc:
            if attempt >= settings.llm_max_attempts or not is_retryable(exc):
                devlog(
                    "LLM",
                    "call failed, giving up",
                    agent=label,
                    code=error_code(exc),
                    attempts=attempt,
                )
                raise
            delay = settings.llm_retry_base_delay * 2 ** (attempt - 1)
            delay += random.uniform(0, settings.llm_retry_base_delay / 2)
            logger.debug("LLM call failed (%s); retry %d in %.1fs", exc, attempt, delay)
            devlog(
                "LLM",
                "call failed, retrying",
                agent=label,
                code=error_code(exc),
                attempt=f"{attempt}/{settings.llm_max_attempts}",
                wait=secs(delay),
            )
            if on_retry:
                on_retry()
            await asyncio.sleep(delay)
            attempt += 1
