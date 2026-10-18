from collections.abc import Mapping
from typing import Any

from langgraph.config import get_stream_writer

WORKER_LABELS = {
    "supervisor": "Planning next step",
    "jd_analyzer": "Analyzing the job description",
    "resume_structurer": "Reading your resume",
    "match_scorer": "Scoring the match",
    "section_customizer": "Customizing resume sections",
    "guardrail": "Fact-checking the customized resume",
    "resolver": "Restoring unsupported lines",
    "evaluator": "Checking keywords and ATS fit",
    "cover_letter": "Writing the cover letter",
    "letter_check": "Fact-checking the cover letter",
}


# The user-facing steps of a run. A worker can map to different steps (the match score runs
# before and after customizing; a revision re-runs the customizer and the fact-check).
STEP_LABELS = {
    "jd": "Analyzing the job description",
    "resume": "Reading your resume",
    "customize": "Customizing resume sections",
    "fact_check": "Fact-checking the changes",
    "revise": "Revising the flagged lines",
    "recheck": "Re-checking the revision",
    "restore": "Restoring unsupported lines",
    "evaluate": "Checking keywords and ATS fit",
    "match_after": "Scoring the match",
    "cover_letter": "Writing the cover letter",
    "letter_check": "Fact-checking the cover letter",
    "letter_revise": "Rewriting the flagged claims",
    "letter_recheck": "Re-checking the cover letter",
}

# The steps a run is expected to take, announced up front so the UI can list them all.
# "revise", "recheck", "restore", "letter_revise" and "letter_recheck" are not planned: they
# only appear if a fact-check flags something.
PLANS = {
    "customize": [
        "jd",
        "resume",
        "customize",
        "fact_check",
        "evaluate",
        "match_after",
    ],
    "cover_letter": ["jd", "cover_letter", "letter_check"],
}


def plan_event(task: str, state: Mapping[str, Any]) -> dict[str, Any]:
    """The steps this run will take. The JD analysis is left out when the caller already has it."""
    steps = [step for step in PLANS[task] if not (step == "jd" and "jd_analysis" in state)]
    return {
        "type": "plan",
        "steps": [{"id": step, "label": STEP_LABELS[step]} for step in steps],
    }


def emit(event: dict[str, Any]) -> None:
    """Send a custom event to the caller of `graph.astream(stream_mode="custom")`."""
    get_stream_writer()(event)


def emit_progress(
    worker: str,
    status: str,
    message: str | None = None,
    *,
    step: str | None = None,
    **extra: Any,
) -> None:
    label = STEP_LABELS.get(step, "") if step else ""
    emit(
        {
            "type": "progress",
            "worker": worker,
            "step": step,
            "status": status,
            "label": label or WORKER_LABELS.get(worker, worker),
            "message": message,
            **extra,
        }
    )


def emit_token(worker: str, text: str) -> None:
    emit({"type": "token", "worker": worker, "text": text})


def emit_token_reset(worker: str) -> None:
    """Tell the UI to discard the tokens streamed so far (a retry is starting)."""
    emit({"type": "token_reset", "worker": worker})
