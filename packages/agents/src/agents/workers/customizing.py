"""Workers that write and check the customized resume."""

import logging
from typing import Any

from langchain_core.runnables import RunnableConfig

from agents.llm import invoke_structured, stream_json
from agents.prompts import load_prompt
from agents.rendering import resume_to_text
from agents.resolve import Items, resolve_flags
from agents.runtime import AgentRuntime
from agents.schemas import (
    BulletProvenance,
    CustomizedSections,
    ExperienceItem,
    GuardrailReport,
    ProjectItem,
    Provenance,
    Section,
    StructuredResume,
)
from agents.state import GraphState
from agents.workers.base import WorkerFn

logger = logging.getLogger(__name__)


def _sources(raw: list[int | None], bullets: list[str], original_count: int) -> list[int | None]:
    """One valid source index (or None) per bullet, whatever the model returned."""
    out: list[int | None] = []
    for j in range(len(bullets)):
        source = raw[j] if j < len(raw) else None
        out.append(source if isinstance(source, int) and 0 <= source < original_count else None)
    return out


def _identity(items: Items) -> list[BulletProvenance]:
    return [
        BulletProvenance(original=i, bullets=list(range(len(item.bullets))))
        for i, item in enumerate(items)
    ]


def merge_sections(
    original: StructuredResume, custom: CustomizedSections, selected: list[Section]
) -> tuple[StructuredResume, list[str], Provenance]:
    """Apply the customizer's output to the selected sections only.

    Unselected sections are never touched. A list section whose item count changed (a role or
    project was dropped or added) is rejected and the original is kept. The provenance records
    which original bullet every customized bullet came from, so a flagged line can be put back.
    """
    update: dict[str, Any] = {}
    highlighted: list[str] = []
    provenance = Provenance(
        experience=_identity(original.experience), projects=_identity(original.projects)
    )

    if "summary" in selected and custom.summary:
        update["summary"] = custom.summary.strip()
    if "skills" in selected and custom.skills:
        highlighted = custom.skills.highlighted
        merged: dict[str, str] = {}
        for skill in [*custom.skills.highlighted, *custom.skills.other]:
            merged.setdefault(skill.casefold(), skill)
        update["skills"] = list(merged.values())
    if "experience" in selected and custom.experience is not None:
        if len(custom.experience) == len(original.experience):
            # Roles stay in their original order, so role i is original role i.
            update["experience"] = [
                ExperienceItem.model_validate(job.model_dump(exclude={"bullet_sources"}))
                for job in custom.experience
            ]
            provenance.experience = [
                BulletProvenance(
                    original=i,
                    bullets=_sources(
                        job.bullet_sources, job.bullets, len(original.experience[i].bullets)
                    ),
                )
                for i, job in enumerate(custom.experience)
            ]
        else:
            logger.warning("Customizer changed the number of roles; keeping the original")
    if "projects" in selected and custom.projects is not None:
        if len(custom.projects) == len(original.projects):
            # Projects may be reordered; they keep their exact names, so match by name.
            by_name = {p.name.strip().casefold(): i for i, p in enumerate(original.projects)}
            update["projects"] = [
                ProjectItem.model_validate(p.model_dump(exclude={"bullet_sources"}))
                for p in custom.projects
            ]
            provenance.projects = []
            for project in custom.projects:
                source = by_name.get(project.name.strip().casefold())
                count = len(original.projects[source].bullets) if source is not None else 0
                provenance.projects.append(
                    BulletProvenance(
                        original=source,
                        bullets=_sources(project.bullet_sources, project.bullets, count),
                    )
                )
        else:
            logger.warning("Customizer changed the number of projects; keeping the original")
    return original.model_copy(update=update), highlighted, provenance


def make_section_customizer(rt: AgentRuntime) -> WorkerFn:
    async def run(state: GraphState, config: RunnableConfig) -> dict[str, Any]:
        version = state.get("customization_version", 0)
        selected = state["selected_sections"]
        resume = state["structured_resume"]

        human = (
            f"Sections to customize: {', '.join(selected)}\n\n"
            f"JOB DESCRIPTION ANALYSIS:\n{state['jd_analysis'].model_dump_json(indent=2)}\n\n"
            f"CANDIDATE RESUME (structured):\n{resume.model_dump_json(indent=2)}"
        )
        issues = state.get("guardrail_issues", [])
        if version > 0 and issues:
            feedback = "\n".join(f'- [{i.section}] "{i.claim}": {i.reason}' for i in issues)
            human += f"\n\nREVIEWER FEEDBACK on the previous attempt (fix every item):\n{feedback}"

        custom = await stream_json(
            rt,
            CustomizedSections,
            load_prompt("section_customizer"),
            human,
            agent="section_customizer",
            config=config,
        )
        customized, highlighted, provenance = merge_sections(resume, custom, selected)
        return {
            "customized_sections": custom,
            "customized_resume": customized,
            "highlighted_skills": highlighted,
            "provenance": provenance,
            "customization_version": version + 1,
            "revision_count": state.get("revision_count", 0) + (1 if version > 0 else 0),
        }

    return run


def make_guardrail(rt: AgentRuntime) -> WorkerFn:
    async def run(state: GraphState, config: RunnableConfig) -> dict[str, Any]:
        human = (
            f"ORIGINAL RESUME:\n{state['structured_resume'].model_dump_json(indent=2)}\n\n"
            f"CUSTOMIZED RESUME:\n{state['customized_resume'].model_dump_json(indent=2)}"
        )
        report = await invoke_structured(
            rt,
            GuardrailReport,
            load_prompt("guardrail"),
            human,
            agent="guardrail",
            config=config,
            temperature=0.0,
        )
        return {
            "guardrail_issues": report.issues,
            "guardrail_version": state.get("customization_version", 0),
        }

    return run


def make_resolver(rt: AgentRuntime) -> WorkerFn:
    """Put every line still flagged after the last fact-check back to the original (no LLM).

    The rewritten draft is kept as `rewritten_resume`, so the user can choose to keep a rewrite.
    Flags that can't be located in the draft stay in `guardrail_issues` as warnings.
    """

    async def run(state: GraphState, config: RunnableConfig) -> dict[str, Any]:
        rewritten = state["customized_resume"]
        resolved, reverted, unlocated = resolve_flags(
            state["structured_resume"],
            rewritten,
            state.get("provenance") or Provenance(),
            state.get("guardrail_issues", []),
        )
        removed = {line.skill.casefold() for line in reverted if line.skill}
        return {
            "rewritten_resume": rewritten,
            "customized_resume": resolved,
            "reverted": reverted,
            "guardrail_issues": unlocated,
            "highlighted_skills": [
                s for s in state.get("highlighted_skills", []) if s.casefold() not in removed
            ],
            "resolved_version": state.get("customization_version", 0),
        }

    return run


def make_letter_check(rt: AgentRuntime) -> WorkerFn:
    """Fact-check the cover letter against the original resume (the customized one if absent)."""

    async def run(state: GraphState, config: RunnableConfig) -> dict[str, Any]:
        truth = state.get("structured_resume") or state["customized_resume"]
        human = (
            f"RESUME (ground truth):\n{resume_to_text(truth)}\n\n"
            f"COVER LETTER:\n{state['cover_letter']}"
        )
        report = await invoke_structured(
            rt,
            GuardrailReport,
            load_prompt("letter_guardrail"),
            human,
            agent="letter_check",
            config=config,
            temperature=0.0,
        )
        return {
            "letter_issues": report.issues,
            "letter_check_version": state.get("letter_version", 0),
        }

    return run
