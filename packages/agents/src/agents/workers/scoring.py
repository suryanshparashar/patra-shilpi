"""Match scorer: embedding cosine similarity between the resume and the job description."""

import math
import time
from typing import Any

from langchain_core.runnables import RunnableConfig

from agents.devlog import devlog, secs
from agents.rendering import resume_to_text
from agents.retry import error_code, with_retry
from agents.runtime import AgentRuntime
from agents.state import GraphState
from agents.usage import UsageCollector
from agents.workers.base import WorkerFn


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0


def make_match_scorer(rt: AgentRuntime) -> WorkerFn:
    """Score = raw cosine similarity x 100, clamped to 0-100 (no rescaling).

    One embedding request covers the original resume, the tailored resume and the job
    description, and yields both the starting and the final match.
    """

    limit = rt.settings.embedding_max_chars

    async def run(state: GraphState, config: RunnableConfig) -> dict[str, Any]:
        original = state["resume_text"][:limit]
        tailored = resume_to_text(state["customized_resume"])[:limit]
        job = state["jd_text"][:limit]

        started = time.perf_counter()
        devlog(
            "EMBEDDINGS",
            "embedding original resume + tailored resume + job",
            model=rt.settings.gemini_embedding_model,
            resume_chars=len(original),
            tailored_chars=len(tailored),
            jd_chars=len(job),
        )
        try:
            vectors = await with_retry(
                lambda: rt.embeddings.aembed_documents([original, tailored, job]),
                rt.settings,
                label="embeddings",
            )
        except Exception as exc:
            devlog(
                "EMBEDDINGS",
                "embedding failed",
                code=error_code(exc),
                took=secs(time.perf_counter() - started),
            )
            raise
        usage = config.get("configurable", {}).get("usage")
        if isinstance(usage, UsageCollector):
            usage.record_embedding("match_scorer", rt.settings.gemini_embedding_model)

        def score(a: list[float], b: list[float]) -> float:
            return round(max(0.0, min(1.0, cosine_similarity(a, b))) * 100, 1)

        before, after = score(vectors[0], vectors[2]), score(vectors[1], vectors[2])
        devlog(
            "EMBEDDINGS",
            "match score",
            before=f"{before}%",
            after=f"{after}%",
            took=secs(time.perf_counter() - started),
        )
        return {
            "match_before": before,
            "match_after": after,
            "match_after_version": state.get("customization_version", 0),
        }

    return run
