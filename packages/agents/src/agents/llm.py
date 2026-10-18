import json
from datetime import date

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel

from agents.events import emit_token, emit_token_reset
from agents.retry import LLMOutputError, with_retry
from agents.runtime import AgentRuntime


def with_today(system: str) -> str:
    """The system prompt with today's date prepended.

    A model does not know the date, and assumes one near its training cutoff. Anything that
    reasons about time ("Jan 2022 - Present" is how many years? is this role current?) is wrong
    without it, and the fact-checks then flag true claims. Added to every call, in one place.
    """
    return (
        f"Today's date: {date.today().isoformat()}. Use it whenever you reason about time: "
        'a role that ends in "Present" or "Current" is ongoing as of this date, and durations '
        "and years of experience are counted up to it.\n\n" + system
    )


def agent_config(config: RunnableConfig, agent: str) -> RunnableConfig:
    """Tag a call with its agent name so traces and usage records are attributable."""
    return {
        **config,
        "metadata": {**config.get("metadata", {}), "agent": agent},
        "run_name": agent,
    }


async def invoke_structured[M: BaseModel](
    rt: AgentRuntime,
    schema: type[M],
    system: str,
    human: str,
    *,
    agent: str,
    config: RunnableConfig,
    temperature: float = 0.2,
) -> M:
    """One structured-output Gemini call, validated against `schema`, with retries."""
    llm = rt.chat(temperature).with_structured_output(schema)
    messages = [SystemMessage(with_today(system)), HumanMessage(human)]

    async def attempt() -> M:
        result = await llm.ainvoke(messages, config=agent_config(config, agent))
        if result is None:
            raise LLMOutputError("empty structured output")
        return result if isinstance(result, schema) else schema.model_validate(result)

    return await with_retry(attempt, rt.settings, label=agent)


async def stream_json[M: BaseModel](
    rt: AgentRuntime,
    schema: type[M],
    system: str,
    human: str,
    *,
    agent: str,
    config: RunnableConfig,
    temperature: float = 0.4,
) -> M:
    """Stream a JSON object token by token (JSON mode), then validate it against `schema`.

    The schema is given to the model inside the system prompt. A retry first sends a
    `token_reset` event so the UI can discard the partial output.
    """
    llm = rt.chat(temperature, json_mode=True)
    schema_hint = json.dumps(schema.model_json_schema())
    messages = [
        SystemMessage(
            f"{with_today(system)}\n\n"
            f"Return one JSON object matching this JSON Schema:\n{schema_hint}"
        ),
        HumanMessage(human),
    ]

    async def attempt() -> M:
        parts: list[str] = []
        async for chunk in llm.astream(messages, config=agent_config(config, agent)):
            text = str(chunk.text)
            if text:
                parts.append(text)
                emit_token(agent, text)
        raw = "".join(parts).strip()
        if not raw:
            raise LLMOutputError("empty streamed output")
        return schema.model_validate_json(raw)

    return await with_retry(
        attempt, rt.settings, on_retry=lambda: emit_token_reset(agent), label=agent
    )


async def stream_text(
    rt: AgentRuntime,
    system: str,
    human: str,
    *,
    agent: str,
    config: RunnableConfig,
    temperature: float = 0.6,
) -> str:
    """Stream plain prose token by token and return the full text."""
    llm = rt.chat(temperature)
    messages = [SystemMessage(with_today(system)), HumanMessage(human)]

    async def attempt() -> str:
        parts: list[str] = []
        async for chunk in llm.astream(messages, config=agent_config(config, agent)):
            text = str(chunk.text)
            if text:
                parts.append(text)
                emit_token(agent, text)
        result = "".join(parts).strip()
        if not result:
            raise LLMOutputError("empty streamed output")
        return result

    return await with_retry(
        attempt, rt.settings, on_retry=lambda: emit_token_reset(agent), label=agent
    )
