"""Workers that evaluate the customized resume and write the cover letter."""

from typing import Any

from langchain_core.runnables import RunnableConfig

from agents.llm import invoke_structured, stream_text
from agents.prompts import load_prompt
from agents.rendering import resume_to_text
from agents.runtime import AgentRuntime
from agents.schemas import Evaluation
from agents.state import GraphState
from agents.workers.base import WorkerFn


def make_evaluator(rt: AgentRuntime) -> WorkerFn:
    """Missing keywords and the ATS score for the final draft, from a single model call."""

    async def run(state: GraphState, config: RunnableConfig) -> dict[str, Any]:
        jd = state["jd_analysis"]
        human = (
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
            temperature=0.1,
        )
        return {
            "keyword_gap": evaluation.keyword_gap,
            "ats_report": evaluation.ats,
            "evaluation_version": state.get("customization_version", 0),
        }

    return run


def make_cover_letter(rt: AgentRuntime) -> WorkerFn:
    async def run(state: GraphState, config: RunnableConfig) -> dict[str, Any]:
        analysis = state.get("jd_analysis")
        jd_part = (
            f"JOB DESCRIPTION ANALYSIS:\n{analysis.model_dump_json(indent=2)}"
            if analysis
            else f"JOB DESCRIPTION:\n{state['jd_text']}"
        )
        human = f"{jd_part}\n\nCANDIDATE RESUME:\n{resume_to_text(state['customized_resume'])}"
        letter = await stream_text(
            rt,
            load_prompt("cover_letter"),
            human,
            agent="cover_letter",
            config=config,
        )
        return {"cover_letter": letter}

    return run
