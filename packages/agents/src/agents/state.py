from operator import add
from typing import Annotated, TypedDict

from agents.schemas import (
    ATSReport,
    CustomizedSections,
    GuardrailIssue,
    JDAnalysis,
    KeywordGap,
    Section,
    StructuredResume,
    Task,
    WorkerError,
)


class GraphState(TypedDict, total=False):
    # Inputs
    task: Task
    jd_text: str
    resume_text: str
    selected_sections: list[Section]

    # Worker outputs
    jd_analysis: JDAnalysis
    structured_resume: StructuredResume
    match_before: float
    match_after: float
    customized_sections: CustomizedSections
    customized_resume: StructuredResume
    highlighted_skills: list[str]
    guardrail_issues: list[GuardrailIssue]
    keyword_gap: KeywordGap
    ats_report: ATSReport
    cover_letter: str

    # Versioning: every customizer run bumps `customization_version`; the checks below record
    # which version they evaluated so the supervisor knows when they are stale.
    customization_version: int
    revision_count: int
    guardrail_version: int
    evaluation_version: int
    match_after_version: int
    revision_decided: bool  # the supervisor has already ruled on a revision

    # Supervisor bookkeeping
    steps: int
    next_worker: str
    completed: Annotated[list[str], add]
    failed: Annotated[list[str], add]
    errors: Annotated[list[WorkerError], add]
