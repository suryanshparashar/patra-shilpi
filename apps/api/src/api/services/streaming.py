import asyncio
import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any

from agents import devlog, secs
from agents.result import RunResult
from api.sse import format_sse

logger = logging.getLogger(__name__)

ResultHook = Callable[[RunResult], Awaitable[dict[str, Any]]]
CleanupHook = Callable[[], Awaitable[None]]


async def run_to_sse(
    source: AsyncIterator[dict[str, Any]],
    *,
    on_result: ResultHook | None = None,
    cleanup: CleanupHook | None = None,
) -> AsyncIterator[str]:
    """Turn the agents' event stream into SSE frames.

    `on_result` runs once on the final result (e.g. spend a guest's free run, save to history);
    the dict it returns is merged into the `result` event. `cleanup` always runs at the end, even
    if the client disconnected, so reservations are never left dangling.
    """
    started = time.perf_counter()
    devlog("STREAM", "stream opened")
    try:
        async for event in source:
            if event["type"] == "result":
                result: RunResult = event["result"]
                payload = {**result.model_dump(mode="json"), "run_id": None}
                if on_result is not None:
                    payload.update(await on_result(result))
                devlog(
                    "STREAM",
                    "result sent",
                    status=result.status,
                    run=payload.get("run_id"),
                    took=secs(time.perf_counter() - started),
                )
                yield format_sse("result", payload)
            else:
                yield format_sse(event["type"], event)
    except asyncio.CancelledError:
        devlog("STREAM", "client disconnected before the run finished")
        raise
    except Exception:
        logger.exception("Run stream failed")
        devlog("STREAM", "stream failed", code="INTERNAL_ERROR")
        yield format_sse(
            "error",
            {"code": "INTERNAL_ERROR", "message": "Something went wrong. Please try again."},
        )
    finally:
        if cleanup is not None:
            # Shielded so cleanup completes even when the client disconnected mid-run.
            await asyncio.shield(cleanup())
