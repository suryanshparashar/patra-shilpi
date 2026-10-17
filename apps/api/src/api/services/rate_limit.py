import time
from collections import defaultdict, deque

from api.errors import AppError


class SlidingWindowLimiter:
    """In-memory rolling-window limiter. Per process: resets on restart, not shared between
    instances (fine for a single Render instance).

    Use `check` to count every request, or `ensure_allowed` + `hit` + `clear` to count only
    failures (e.g. wrong passwords) and forgive them after a success.
    """

    def __init__(self, limit: int, window_seconds: float = 3600.0, noun: str = "requests") -> None:
        self._limit = limit
        self._window = window_seconds
        self._noun = noun
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def _recent(self, key: str) -> deque[float]:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] >= self._window:
            hits.popleft()
        return hits

    def ensure_allowed(self, key: str) -> None:
        """Raise a 429 telling the caller when to retry, if `key` is over its limit."""
        hits = self._recent(key)
        if len(hits) >= self._limit:
            retry_after = max(1, int(self._window - (time.monotonic() - hits[0])) + 1)
            raise AppError(
                429,
                "RATE_LIMITED",
                f"Too many {self._noun}. Please try again in {_human(retry_after)}.",
                {"limit": self._limit, "retry_after_seconds": retry_after},
                headers={"Retry-After": str(retry_after)},
            )

    def hit(self, key: str) -> None:
        self._recent(key).append(time.monotonic())

    def clear(self, key: str) -> None:
        self._hits.pop(key, None)

    def check(self, key: str) -> None:
        self.ensure_allowed(key)
        self.hit(key)


def _human(seconds: int) -> str:
    if seconds < 90:
        return f"{seconds} seconds"
    return f"{round(seconds / 60)} minutes"
