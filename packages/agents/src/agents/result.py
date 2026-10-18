from typing import Literal

from pydantic import BaseModel, Field

from agents.schemas import (
    ATSReport,
    GuardrailIssue,
    JDAnalysis,
    KeywordGap,
    RevertedLine,
    StructuredResume,
    WorkerError,
)
from agents.state import GraphState


class RunResult(BaseModel):
    """The serializable outcome of one graph run (what the API sends and stores)."""

    status: Literal["completed", "partial", "failed"]
    jd_analysis: JDAnalysis | None = None
    original_resume: StructuredResume | None = None
    customized_resume: StructuredResume | None = None
    highlighted_skills: list[str] = Field(default_factory=list)
    match_before: float | None = None
    match_after: float | None = None
    ats_report: ATSReport | None = None
    keyword_gap: KeywordGap | None = None
    guardrail_issues: list[GuardrailIssue] = Field(default_factory=list)  # left for review
    # The draft before flagged lines were put back, and those reverts, so the user can choose
    # to keep a rewrite. `customized_resume` already has every revert applied.
    rewritten_resume: StructuredResume | None = None
    reverted: list[RevertedLine] = Field(default_factory=list)
    cover_letter: str | None = None
    letter_issues: list[GuardrailIssue] = Field(default_factory=list)  # still flagged
    errors: list[WorkerError] = Field(default_factory=list)


def to_result(state: GraphState) -> RunResult:
    errors = state.get("errors", [])
    if state.get("task") == "cover_letter":
        produced = "cover_letter" in state
    else:
        produced = "customized_resume" in state
    status: Literal["completed", "partial", "failed"] = (
        "failed" if not produced else ("partial" if errors else "completed")
    )
    return RunResult(
        status=status,
        jd_analysis=state.get("jd_analysis"),
        original_resume=state.get("structured_resume"),
        customized_resume=state.get("customized_resume"),
        highlighted_skills=state.get("highlighted_skills", []),
        match_before=state.get("match_before"),
        match_after=state.get("match_after"),
        ats_report=state.get("ats_report"),
        keyword_gap=state.get("keyword_gap"),
        guardrail_issues=state.get("guardrail_issues", []),
        rewritten_resume=state.get("rewritten_resume"),
        reverted=state.get("reverted", []),
        cover_letter=state.get("cover_letter"),
        letter_issues=state.get("letter_issues", []),
        errors=errors,
    )
