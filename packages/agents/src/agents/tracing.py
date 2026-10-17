import os

from agents.config import AgentSettings


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
