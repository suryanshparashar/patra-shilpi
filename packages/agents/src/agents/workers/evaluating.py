"""Workers that evaluate the customized resume and write the cover letter."""

from typing import Any

from langchain_core.runnables import RunnableConfig

from agents.events import emit_token_reset
from agents.llm import invoke_structured, stream_text
from agents.prompts import load_prompt
from agents.rendering import resume_to_text
from agents.runtime import AgentRuntime
from agents.schemas import ATSReport, Evaluation
from agents.state import GraphState
from agents.workers.base import WorkerFn


def make_evaluator(rt: AgentRuntime) -> WorkerFn:
    """Missing keywords and the ATS score for the final draft, from a single model call."""

    async def run(state: GraphState, config: RunnableConfig) -> dict[str, Any]:
        jd = state["jd_analysis"]
        role = " ".join(part for part in (jd.seniority, jd.role_title) if part)
        human = (
            f"JOB ROLE: {role}\n"
            f"REQUIRED SKILLS: {', '.join(jd.required_skills)}\n"
            f"PREFERRED SKILLS: {', '.join(jd.preferred_skills)}\n"
            f"ATS KEYWORDS: {', '.join(jd.keywords)}\n\n"
            f"RESUME TEXT:\n{resume_to_text(state['customized_resume'])}"
        )
        evaluation = await invoke_structured(
            rt,
            Evaluation,
            load_prompt("evaluator"),
            human,
            agent="evaluator",
            config=config,
            temperature=0.0,
        )
        return {
            "keyword_gap": evaluation.keyword_gap,
            # The total is the sum of the rubric's criteria, added up here, never by the model.
            "ats_report": ATSReport.from_rubric(evaluation.ats),
            "evaluation_version": state.get("customization_version", 0),
        }

    return run


def make_cover_letter(rt: AgentRuntime) -> WorkerFn:
    """Write the letter. A second pass rewrites it without the claims the check flagged."""

    async def run(state: GraphState, config: RunnableConfig) -> dict[str, Any]:
        letters = state.get("letter_version", 0)
        analysis = state.get("jd_analysis")
        jd_part = (
            f"JOB DESCRIPTION ANALYSIS:\n{analysis.model_dump_json(indent=2)}"
            if analysis
            else f"JOB DESCRIPTION:\n{state['jd_text']}"
        )
        # The resume the candidate submits is the source of facts; the original backs it up.
        human = f"{jd_part}\n\nCANDIDATE RESUME:\n{resume_to_text(state['customized_resume'])}"
        issues = state.get("letter_issues", [])
        if letters > 0 and issues:
            feedback = "\n".join(f'- "{i.claim}": {i.reason}' for i in issues)
            human += (
                f"\n\nPREVIOUS LETTER:\n{state.get('cover_letter', '')}\n\n"
                "A FACT-CHECK FLAGGED THESE CLAIMS. Rewrite the letter without them: remove or "
                f"restate each one so it matches the resume exactly.\n{feedback}"
            )
            emit_token_reset("cover_letter")  # the UI clears the first letter and re-streams
        letter = await stream_text(
            rt,
            load_prompt("cover_letter"),
            human,
            agent="cover_letter",
            config=config,
        )
        return {"cover_letter": letter, "letter_version": letters + 1}

    return run
