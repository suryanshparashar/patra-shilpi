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
        os.environ["LANGSMITH_PROJECT"] = settings.langsmith_project
