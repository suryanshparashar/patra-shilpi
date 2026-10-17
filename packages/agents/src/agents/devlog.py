"""A readable step-by-step trail in the dev console.

    10:42:07.406 [WORKER]     jd_analyzer started  step=jd
    10:42:08.911 [LLM]        call ok  agent=jd_analyzer model=gemini-x in=812 out=244 took=1.5s

Off unless `configure_devlog(True)` is called (the API does this in development). Never log
secrets or user content: passwords, tokens, the job description or resume text. Log lengths,
counts, ids and usernames instead.
"""

import logging
import os
import sys
from datetime import datetime
from typing import Any, Literal

Tag = Literal[
    "API", "SERVICE", "AGENT", "WORKER", "LLM", "EMBEDDINGS", "STREAM", "DB", "AUTH", "GUEST"
]

# ANSI colour per tag (only used when the console supports it).
_COLOURS: dict[str, str] = {
    "API": "36",  # cyan
    "SERVICE": "34",  # blue
    "AGENT": "35",  # magenta
    "WORKER": "32",  # green
    "LLM": "33",  # yellow
    "EMBEDDINGS": "96",  # bright cyan
    "STREAM": "94",  # bright blue
    "DB": "90",  # grey
    "AUTH": "95",  # bright magenta
    "GUEST": "93",  # bright yellow
}
_TAG_WIDTH = max(len(tag) for tag in _COLOURS) + 2  # "[EMBEDDINGS]"

_logger = logging.getLogger("devlog")
_logger.propagate = False  # our own format, not uvicorn's
_enabled = False


def configure_devlog(enabled: bool) -> None:
    """Turn the trail on or off. Safe to call more than once."""
    global _enabled
    _enabled = enabled
    if enabled and not _logger.handlers:
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(logging.Formatter("%(message)s"))
        _logger.addHandler(handler)
        _logger.setLevel(logging.INFO)


def secs(seconds: float) -> str:
    """A compact duration: "850ms" or "1.5s"."""
    return f"{seconds * 1000:.0f}ms" if seconds < 1 else f"{seconds:.1f}s"


def _use_colour() -> bool:
    return sys.stderr.isatty() and "NO_COLOR" not in os.environ


def devlog(tag: Tag, message: str, **fields: Any) -> None:
    """Log one step. Fields whose value is None are left out."""
    if not _enabled:
        return
    stamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    label = f"[{tag}]".ljust(_TAG_WIDTH)
    if _use_colour():
        label = f"\x1b[{_COLOURS[tag]}m{label}\x1b[0m"
    extras = "  ".join(f"{key}={value}" for key, value in fields.items() if value is not None)
    _logger.info(f"{stamp} {label} {message}" + (f"  {extras}" if extras else ""))
