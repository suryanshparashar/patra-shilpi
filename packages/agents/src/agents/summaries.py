"""One short result line per finished step, shown under the step in the checklist so the wait
feels shorter ("4 roles, 2 projects, 18 skills", "Match 61% → 74%").

Pure functions over what the step just produced (`update`) and the state it started from. They
never call a model and never raise: `summarize` swallows any surprise and returns None.
"""

from collections.abc import Callable
from typing import Any

from agents.schemas import (
    ATSReport,
    CustomizedSections,
    JDAnalysis,
    KeywordGap,
    Section,
    StructuredResume,
)
from agents.state import GraphState


def _plural(count: int, word: str) -> str:
    return f"{count} {word}" if count == 1 else f"{count} {word}s"


def _join(items: list[str]) -> str:
    """ "a", "a and b", "a, b and c"."""
    return items[0] if len(items) == 1 else f"{', '.join(items[:-1])} and {items[-1]}"


def _pct(score: float) -> str:
    return f"{round(score)}%"


def _invented(count: int, *, still: bool = False) -> str:
    if count == 0:
        return "nothing invented"
    return f"{_plural(count, 'claim')} {'still flagged' if still else 'flagged'}"


def _jd(update: dict[str, Any], state: GraphState) -> str:
    jd: JDAnalysis = update["jd_analysis"]
    role = jd.role_title.strip()
    seniority = (jd.seniority or "").strip()
    if seniority and seniority.lower() not in role.lower():
        role = f"{seniority.capitalize()} {role}"
    return f"{role} role · {_plural(len(jd.keywords), 'keyword')} found"


def _resume(update: dict[str, Any], state: GraphState) -> str:
    resume: StructuredResume = update["structured_resume"]
    return ", ".join(
        [
            _plural(len(resume.experience), "role"),
            _plural(len(resume.projects), "project"),
            _plural(len(resume.skills), "skill"),
        ]
    )


def _customize(update: dict[str, Any], state: GraphState) -> str:
    sections: list[Section] = state.get("selected_sections", [])
    return f"Rewrote {_join(list(sections))}" if sections else "Rewrote the selected sections"


def rewritten_lines(custom: CustomizedSections, sections: list[Section]) -> int:
    """How many lines the customizer rewrote: the summary, the skills line, every bullet."""
    lines = 0
    if "summary" in sections and custom.summary:
        lines += 1
    if "skills" in sections and custom.skills:
        lines += 1
    if "experience" in sections and custom.experience:
        lines += sum(len(job.bullets) for job in custom.experience)
    if "projects" in sections and custom.projects:
        lines += sum(len(project.bullets) for project in custom.projects)
    return lines


def _fact_check(update: dict[str, Any], state: GraphState) -> str:
    issues = len(update["guardrail_issues"])
    custom = state.get("customized_sections")
    if custom is None:
        return f"Checked the changes · {_invented(issues)}"
    lines = rewritten_lines(custom, state.get("selected_sections", []))
    return f"Checked {_plural(lines, 'rewritten line')} · {_invented(issues)}"


def _revise(update: dict[str, Any], state: GraphState) -> str:
    flagged = len(state.get("guardrail_issues", []))
    return f"Reworked {_plural(flagged, 'flagged claim')}" if flagged else "Reworked the draft"


def _recheck(update: dict[str, Any], state: GraphState) -> str:
    return f"Re-checked · {_invented(len(update['guardrail_issues']), still=True)}"


def _evaluate(update: dict[str, Any], state: GraphState) -> str:
    report: ATSReport = update["ats_report"]
    gap: KeywordGap = update["keyword_gap"]
    missing = len(gap.missing_keywords)
    return (
        f"ATS {report.score}/100 · {_plural(missing, 'missing keyword')}"
        if missing
        else f"ATS {report.score}/100 · no key keywords missing"
    )


def _match_after(update: dict[str, Any], state: GraphState) -> str:
    after = update["match_after"]
    before = update.get("match_before")
    return (
        f"Match {_pct(before)} → {_pct(after)}"
        if before is not None
        else f"Final match: {_pct(after)}"
    )


def _cover_letter(update: dict[str, Any], state: GraphState) -> str:
    return f"{len(update['cover_letter'].split())}-word letter ready"


_SUMMARIES: dict[str, Callable[[dict[str, Any], GraphState], str]] = {
    "jd": _jd,
    "resume": _resume,
    "customize": _customize,
    "fact_check": _fact_check,
    "revise": _revise,
    "recheck": _recheck,
    "evaluate": _evaluate,
    "match_after": _match_after,
    "cover_letter": _cover_letter,
}


def summarize(step: str, update: dict[str, Any], state: GraphState) -> str | None:
    """The result line for a finished step, or None if there is nothing sensible to say.

    `state` is the state the step started from; for the fact-check that already includes the
    customizer's output, which is what it checked.
    """
    builder = _SUMMARIES.get(step)
    if builder is None:
        return None
    try:
        return builder(update, state)
    except Exception:
        return None
