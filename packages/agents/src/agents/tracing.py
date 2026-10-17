import os

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.tracers.langchain import LangChainTracer

from agents.config import AgentSettings


class AgentAddressTracer(LangChainTracer):
    """LangChain's tracer, sending only the agent address.

    By default the tracer stamps every run with a project name (the env var, else "default").
    LangSmith rejects a run that carries both a project and an agent address ("address cannot be
    combined with session_id or session_name"), so every trace would be lost. Clearing the
    project name leaves the address from LANGSMITH_AGENT_ID / LANGSMITH_AGENT_ENVIRONMENT as the
    run's only destination.
    """

    def __init__(self, *args: object, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)  # type: ignore[arg-type]
        # Runs again for the copies LangChain makes (`copy_with_metadata_defaults`).
        self.project_name = None


def agent_tracer(settings: AgentSettings) -> BaseCallbackHandler | None:
    """A tracer for one run when traces go to an agent; None when tracing is off or project-based.

    Pass it in the run's callbacks: LangChain only creates its own tracer when none is given.
    """
    enabled = settings.langsmith_tracing and settings.langsmith_api_key is not None
    if not (enabled and settings.langsmith_agent_id):
        return None
    return AgentAddressTracer()


def configure_tracing(settings: AgentSettings) -> None:
    """Export LangSmith settings to the environment, where the LangSmith client reads them.

    Must run before the first LLM call.
    """
    api_key = settings.langsmith_api_key
    enabled = settings.langsmith_tracing and api_key is not None
    os.environ["LANGSMITH_TRACING"] = "true" if enabled else "false"
    if enabled and api_key is not None:
        os.environ["LANGSMITH_API_KEY"] = api_key.get_secret_value()
        if settings.langsmith_agent_id:
            # An agent address and a project are competing destinations: with both set, LangSmith
            # traces nothing. The agent wins.
            os.environ.pop("LANGSMITH_PROJECT", None)
        else:
            os.environ["LANGSMITH_PROJECT"] = settings.langsmith_project
        for name, value in (
            ("LANGSMITH_ENDPOINT", settings.langsmith_endpoint),
            ("LANGSMITH_AGENT_ID", settings.langsmith_agent_id),
            ("LANGSMITH_AGENT_ENVIRONMENT", settings.langsmith_agent_environment),
        ):
            if value:
                os.environ[name] = value
