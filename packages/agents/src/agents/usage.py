import time
from dataclasses import dataclass
from typing import Any, Literal
from uuid import UUID

from langchain_core.callbacks import AsyncCallbackHandler
from langchain_core.messages import BaseMessage
from langchain_core.outputs import LLMResult

from agents.devlog import devlog, secs
from agents.retry import error_code


@dataclass
class UsageRecord:
    agent: str
    model: str
    kind: Literal["llm", "embedding"]
    input_tokens: int | None
    output_tokens: int | None


class UsageCollector(AsyncCallbackHandler):
    """Collects one record per LLM/embedding call for a single run.

    Gemini embeddings report no token counts, so those records carry `None` tokens.
    Persisting the records (the `llm_usage` collection) happens in the admin phase.
    """

    def __init__(self) -> None:
        self.records: list[UsageRecord] = []
        self._calls: dict[UUID, tuple[str, str, float]] = {}

    async def on_chat_model_start(
        self,
        serialized: dict[str, Any],
        messages: list[list[BaseMessage]],
        *,
        run_id: UUID,
        metadata: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None:
        meta = metadata or {}
        agent, model = meta.get("agent", "unknown"), meta.get("ls_model_name", "unknown")
        self._calls[run_id] = (agent, model, time.perf_counter())

    async def on_llm_end(self, response: LLMResult, *, run_id: UUID, **kwargs: Any) -> None:
        agent, model, started = self._calls.pop(run_id, ("unknown", "unknown", time.perf_counter()))
        usage = None
        for generations in response.generations:
            for generation in generations:
                message = getattr(generation, "message", None)
                usage = getattr(message, "usage_metadata", None) or usage
        self.records.append(
            UsageRecord(
                agent=agent,
                model=model,
                kind="llm",
                input_tokens=usage.get("input_tokens") if usage else None,
                output_tokens=usage.get("output_tokens") if usage else None,
            )
        )
        record = self.records[-1]
        devlog(
            "LLM",
            "call ok",
            agent=agent,
            model=model,
            tokens_in=record.input_tokens,
            tokens_out=record.output_tokens,
            took=secs(time.perf_counter() - started),
        )

    async def on_llm_error(self, error: BaseException, *, run_id: UUID, **kwargs: Any) -> None:
        agent, _, started = self._calls.pop(run_id, ("unknown", "", time.perf_counter()))
        devlog(
            "LLM",
            "call error",
            agent=agent,
            code=error_code(error),
            took=secs(time.perf_counter() - started),
        )

    def record_embedding(self, agent: str, model: str) -> None:
        self.records.append(UsageRecord(agent, model, "embedding", None, None))
