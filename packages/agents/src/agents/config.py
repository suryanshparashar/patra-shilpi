from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class AgentSettings(BaseSettings):
    """Agent configuration. Pass `_env_file=` at construction to read a .env file."""

    model_config = SettingsConfigDict(extra="ignore", env_ignore_empty=True)

    google_api_key: SecretStr
    # One chat model for every agent. Required: there is deliberately no default.
    gemini_model: str
    gemini_embedding_model: str = "gemini-embedding-001"

    llm_timeout_seconds: float = 60.0
    llm_max_attempts: int = 3
    llm_retry_base_delay: float = 1.0

    # gemini-embedding-001 accepts ~2048 tokens; longer inputs are truncated to this many chars.
    embedding_max_chars: int = 7000

    max_supervisor_steps: int = 15
    max_revisions: int = 1

    # LangSmith: one setup, switched on or off by this flag.
    langsmith_tracing: bool = False
    langsmith_api_key: SecretStr | None = None
    langsmith_project: str = "patrashilpi"
    # Region endpoint, e.g. https://apac.api.smith.langchain.com. Empty means the US default.
    langsmith_endpoint: str | None = None
    # Groups traces under an agent in LangSmith's Agents view.
    langsmith_agent_id: str | None = None
    langsmith_agent_environment: str | None = None
