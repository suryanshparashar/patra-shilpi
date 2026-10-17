import logging
import time
from collections.abc import Awaitable, Callable
from typing import Any

from langchain_core.runnables import RunnableConfig

from agents.devlog import devlog, secs
from agents.events import emit_progress
from agents.retry import describe_error, error_code
from agents.routing import step_for
from agents.schemas import WorkerError
from agents.state import GraphState
from agents.summaries import summarize

logger = logging.getLogger(__name__)

WorkerFn = Callable[[GraphState, RunnableConfig], Awaitable[dict[str, Any]]]
NodeFn = Callable[[GraphState, RunnableConfig], Awaitable[dict[str, Any]]]


def worker_node(name: str, fn: WorkerFn) -> NodeFn:
    """Wrap a worker so it emits progress events and a failure becomes state, not a crash.

    A failed worker is recorded in `failed`/`errors`; the supervisor carries on, so the run
    ends with whatever partial results were produced. Every event names the user-facing `step`
    and, once finished, how long it took; a failure also carries the provider's error code.
    """

    async def node(state: GraphState, config: RunnableConfig) -> dict[str, Any]:
        step = step_for(name, state)
        started = time.perf_counter()
        emit_progress(name, "started", step=step)
        devlog("WORKER", f"{name} started", step=step)
        try:
            update = await fn(state, config)
        except Exception as exc:
            elapsed = time.perf_counter() - started
            logger.exception("Worker %s failed", name)
            message, code = describe_error(exc), error_code(exc)
            emit_progress(
                name,
                "failed",
                message,
                step=step,
                code=code,
                elapsed_ms=round(elapsed * 1000),
            )
            devlog("WORKER", f"{name} FAILED", step=step, code=code, took=secs(elapsed))
            return {
                "failed": [name],
                "errors": [WorkerError(worker=name, message=message, code=code)],
            }
        elapsed = time.perf_counter() - started
        summary = summarize(step, update, state)  # e.g. "4 roles, 2 projects, 18 skills"
        emit_progress(name, "done", step=step, elapsed_ms=round(elapsed * 1000), summary=summary)
        devlog("WORKER", f"{name} done", step=step, took=secs(elapsed), summary=summary)
        return {**update, "completed": [name]}

    return node
