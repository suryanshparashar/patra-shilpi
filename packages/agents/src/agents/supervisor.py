import logging
from typing import Any, Literal

from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, create_model

from agents.devlog import devlog
from agents.events import emit_progress
from agents.llm import invoke_structured
from agents.prompts import load_prompt
from agents.routing import FINISH, get_options
from agents.runtime import AgentRuntime
from agents.state import GraphState
from agents.workers.base import NodeFn

logger = logging.getLogger(__name__)


def _decision_model(choices: list[str]) -> type[BaseModel]:
    """A schema whose `next` field is an enum of exactly the allowed choices."""
    return create_model(
        "SupervisorDecision",
        next=(Literal[tuple(choices)], ...),  # type: ignore[arg-type]
        reason=(str, ...),
    )


def _progress_summary(state: GraphState) -> str:
    done = state.get("completed", [])
    failed = state.get("failed", [])
    issues = state.get("guardrail_issues", [])
    lines = [
        f"Task: {state.get('task', 'customize')}",
        f"Completed workers: {', '.join(done) or 'none'}",
        f"Failed workers: {', '.join(failed) or 'none'}",
        f"Customization passes so far: {state.get('customization_version', 0)}",
        f"Revisions used: {state.get('revision_count', 0)}",
    ]
    if "guardrail_issues" in state:
        lines.append(f"Guardrail issues on the current draft: {len(issues)}")
        lines += [f"  - [{i.section}] {i.reason}" for i in issues[:6]]
    return "\n".join(lines)


def make_supervisor(rt: AgentRuntime) -> NodeFn:
    settings = rt.settings

    async def supervisor(state: GraphState, config: RunnableConfig) -> dict[str, Any]:
        steps = state.get("steps", 0)
        options = get_options(state, settings)

        carry_on = options.next or FINISH
        choices = [carry_on, "section_customizer"]

        how = "llm"
        decided: dict[str, Any] = {}
        if steps >= settings.max_supervisor_steps:
            logger.warning("Supervisor step limit reached; finishing")
            choice, reason, how = FINISH, "Step limit reached.", "limit"
        elif not options.ask_revise:
            choice, reason, how = carry_on, "Fixed order.", "rule"
        else:
            decided = {"revision_decided": True}
            emit_progress("supervisor", "started")
            human = f"PROGRESS:\n{_progress_summary(state)}\n\nOPTIONS: {', '.join(choices)}"
            try:
                decision = await invoke_structured(
                    rt,
                    _decision_model(choices),
                    load_prompt("supervisor"),
                    human,
                    agent="supervisor",
                    config=config,
                    temperature=0.0,
                )
                choice, reason = decision.next, decision.reason  # type: ignore[attr-defined]
            except Exception:
                # The supervisor must never fail the run: fall back to the first valid option.
                logger.exception("Supervisor LLM call failed; using the first valid option")
                choice, reason, how = choices[0], "Fallback: supervisor unavailable.", "fallback"

        devlog(
            "AGENT",
            f"supervisor -> {choice}",
            n=steps + 1,
            how=how,
            options=",".join(choices),
            why=reason,
        )
        emit_progress("supervisor", "decided", reason, next=choice)
        return {"next_worker": choice, "steps": steps + 1, **decided}

    return supervisor
