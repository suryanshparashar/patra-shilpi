"""Deterministic rules for the order the workers run in.

The order is fixed in code, so the supervisor makes no model call to pick the next step. Its one
real judgement is whether a flagged draft deserves the single revision (`ask_revise`).
"""

from dataclasses import dataclass

from agents.config import AgentSettings
from agents.state import GraphState

WORKERS = (
    "jd_analyzer",
    "resume_structurer",
    "section_customizer",
    "guardrail",
    "resolver",
    "evaluator",
    "match_scorer",
    "cover_letter",
    "letter_check",
)
FINISH = "FINISH"

# A cover letter that the check flags is rewritten this many times, at most.
MAX_LETTER_REVISIONS = 1


@dataclass(frozen=True)
class Options:
    next: str | None  # the next worker in the fixed order, or None when the run is done
    ask_revise: bool  # the guardrail flagged the draft: let the supervisor LLM rule on a revision


def step_for(worker: str, state: GraphState) -> str:
    """The user-facing step a worker is about to perform (see `events.STEP_LABELS`)."""
    version = state.get("customization_version", 0)
    letters = state.get("letter_version", 0)
    if worker == "section_customizer":
        return "revise" if version > 0 else "customize"
    if worker == "guardrail":
        return "recheck" if version > 1 else "fact_check"
    if worker == "cover_letter":
        return "letter_revise" if letters > 0 else "cover_letter"
    if worker == "letter_check":
        return "letter_recheck" if letters > 1 else "letter_check"
    return {
        "jd_analyzer": "jd",
        "resume_structurer": "resume",
        "resolver": "restore",
        "evaluator": "evaluate",
        "match_scorer": "match_after",
    }.get(worker, worker)


def _cover_letter_options(state: GraphState, failed: set[str]) -> Options:
    letters = state.get("letter_version", 0)
    checked = state.get("letter_check_version", 0) == letters
    for worker, needed in (
        ("jd_analyzer", "jd_analysis" not in state),
        ("cover_letter", letters == 0 and "customized_resume" in state),
        ("letter_check", letters > 0 and not checked),
        (
            "cover_letter",
            letters > 0
            and checked
            and bool(state.get("letter_issues"))
            and letters <= MAX_LETTER_REVISIONS,
        ),
    ):
        if needed and worker not in failed:
            return Options(worker, ask_revise=False)
    return Options(None, ask_revise=False)


def get_options(state: GraphState, settings: AgentSettings) -> Options:
    failed = set(state.get("failed", []))

    def pending(worker: str, needed: bool) -> bool:
        return needed and worker not in failed

    if state.get("task") == "cover_letter":
        return _cover_letter_options(state, failed)

    version = state.get("customization_version", 0)
    customized = "customized_resume" in state

    for worker, needed in (
        ("jd_analyzer", "jd_analysis" not in state),
        ("resume_structurer", "structured_resume" not in state),
        (
            "section_customizer",
            version == 0 and "jd_analysis" in state and "structured_resume" in state,
        ),
        ("guardrail", customized and state.get("guardrail_version", 0) != version),
    ):
        if pending(worker, needed):
            return Options(worker, ask_revise=False)

    # What is left runs once, on the draft that is kept: put still-flagged lines back to the
    # original, then evaluate and score the result.
    can_revise = (
        customized
        and not state.get("revision_decided", False)
        and bool(state.get("guardrail_issues"))
        and state.get("revision_count", 0) < settings.max_revisions
        and "section_customizer" not in failed
    )
    flagged = bool(state.get("guardrail_issues")) and state.get("guardrail_version", 0) == version
    following = next(
        (
            worker
            for worker, needed in (
                (
                    "resolver",
                    customized and flagged and state.get("resolved_version", 0) != version,
                ),
                ("evaluator", customized and state.get("evaluation_version", 0) != version),
                ("match_scorer", customized and state.get("match_after_version", 0) != version),
            )
            if pending(worker, needed)
        ),
        None,
    )
    return Options(following, ask_revise=can_revise)
