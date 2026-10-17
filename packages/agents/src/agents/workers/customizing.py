"""Workers that write and check the customized resume."""

import logging
from typing import Any

from langchain_core.runnables import RunnableConfig

from agents.llm import invoke_structured, stream_json
from agents.prompts import load_prompt
from agents.runtime import AgentRuntime
from agents.schemas import (
    CustomizedSections,
    GuardrailReport,
    Section,
    StructuredResume,
)
from agents.state import GraphState
from agents.workers.base import WorkerFn

logger = logging.getLogger(__name__)


def merge_sections(
    original: StructuredResume, custom: CustomizedSections, selected: list[Section]
) -> tuple[StructuredResume, list[str]]:
    """Apply the customizer's output to the selected sections only.

    Unselected sections are never touched. A list section whose item count changed (a role or
    project was dropped or added) is rejected and the original is kept.
    """
    update: dict[str, Any] = {}
    highlighted: list[str] = []

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
            update["experience"] = custom.experience
        else:
            logger.warning("Customizer changed the number of roles; keeping the original")
    if "projects" in selected and custom.projects is not None:
        if len(custom.projects) == len(original.projects):
            update["projects"] = custom.projects
        else:
            logger.warning("Customizer changed the number of projects; keeping the original")
    return original.model_copy(update=update), highlighted


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
        customized, highlighted = merge_sections(resume, custom, selected)
        return {
            "customized_sections": custom,
            "customized_resume": customized,
            "highlighted_skills": highlighted,
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
