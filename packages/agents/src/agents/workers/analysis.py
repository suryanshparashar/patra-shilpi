"""Workers that read the inputs: JD analyzer and resume structurer."""

from typing import Any

from langchain_core.runnables import RunnableConfig

from agents.llm import invoke_structured
from agents.prompts import load_prompt
from agents.runtime import AgentRuntime
from agents.schemas import JDAnalysis, StructuredResume
from agents.state import GraphState
from agents.workers.base import WorkerFn


def make_jd_analyzer(rt: AgentRuntime) -> WorkerFn:
    async def run(state: GraphState, config: RunnableConfig) -> dict[str, Any]:
        analysis = await invoke_structured(
            rt,
            JDAnalysis,
            load_prompt("jd_analyzer"),
            f"JOB DESCRIPTION:\n{state['jd_text']}",
            agent="jd_analyzer",
            config=config,
            temperature=0.0,
        )
        return {"jd_analysis": analysis}

    return run


def make_resume_structurer(rt: AgentRuntime) -> WorkerFn:
    async def run(state: GraphState, config: RunnableConfig) -> dict[str, Any]:
        resume = await invoke_structured(
            rt,
            StructuredResume,
            load_prompt("resume_structurer"),
            f"RESUME TEXT:\n{state['resume_text']}",
            agent="resume_structurer",
            config=config,
            temperature=0.0,
        )
        return {"structured_resume": resume}

    return run
