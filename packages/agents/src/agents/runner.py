import asyncio
import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any, cast

from langchain_core.runnables import RunnableConfig

from agents.config import AgentSettings
from agents.devlog import devlog, secs
from agents.events import plan_event
from agents.graph import build_graph
from agents.result import to_result
from agents.runtime import AgentRuntime
from agents.schemas import JDAnalysis, Section, StructuredResume
from agents.state import GraphState
from agents.tracing import agent_tracer
from agents.usage import UsageCollector, UsageRecord

logger = logging.getLogger(__name__)

# Receives every LLM/embedding call of a run once the run ends, however it ends.
UsageSink = Callable[[list[UsageRecord]], Awaitable[None]]


class ResumeAgents:
    """Entry point for the API: build once at startup, call `stream_*` per request."""

    def __init__(self, settings: AgentSettings) -> None:
        self.runtime = AgentRuntime(settings)
        self.graph = build_graph(self.runtime)

    def stream_customize(
        self,
        *,
        jd_text: str,
        resume_text: str,
        sections: list[Section],
        usage_sink: UsageSink | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        state: GraphState = {
            "task": "customize",
            "jd_text": jd_text,
            "resume_text": resume_text,
            "selected_sections": sections,
        }
        return self._stream(state, usage_sink)

    def stream_cover_letter(
        self,
        *,
        jd_text: str,
        customized_resume: StructuredResume,
        jd_analysis: JDAnalysis | None = None,
        usage_sink: UsageSink | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        state: GraphState = {
            "task": "cover_letter",
            "jd_text": jd_text,
            "customized_resume": customized_resume,
        }
        if jd_analysis is not None:
            state["jd_analysis"] = jd_analysis  # the run already analyzed it: skip that call
        return self._stream(state, usage_sink)

    async def _stream(
        self, state: GraphState, usage_sink: UsageSink | None
    ) -> AsyncIterator[dict[str, Any]]:
        """Yield `progress`, `token` and `token_reset` events, then one final `result` event."""
        usage = UsageCollector()
        tracer = agent_tracer(self.runtime.settings)
        config: RunnableConfig = {
            "callbacks": [usage, tracer] if tracer is not None else [usage],
            "configurable": {"usage": usage},
            "tags": [state["task"]],
            "metadata": {"task": state["task"]},
            "recursion_limit": 100,
        }
        final: GraphState = state
        started = time.perf_counter()
        devlog(
            "AGENT",
            f"run started: {state['task']}",
            sections=",".join(state.get("selected_sections", [])) or None,
            jd_chars=len(state.get("jd_text", "")),
            resume_chars=len(state.get("resume_text", "")) or None,
        )
        try:
            # Tell the UI every step up front, so it can show what is done and what is left.
            yield plan_event(state["task"], state)
            async for mode, chunk in self.graph.astream(
                state, config=config, stream_mode=["custom", "values"]
            ):
                if mode == "custom":
                    yield cast(dict[str, Any], chunk)
                else:
                    final = cast(GraphState, chunk)
            result = to_result(final)
            devlog(
                "AGENT",
                "run finished",
                status=result.status,
                errors=len(result.errors) or None,
                took=secs(time.perf_counter() - started),
            )
            yield {"type": "result", "result": result}
        finally:
            # Tokens were spent even if the client left or a step crashed, so always report them.
            if usage_sink is not None and usage.records:
                try:
                    await asyncio.shield(usage_sink(list(usage.records)))
                except Exception:
                    logger.exception("Usage sink failed")
