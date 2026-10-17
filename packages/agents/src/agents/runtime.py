from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings

from agents.config import AgentSettings
from agents.tracing import configure_tracing


class AgentRuntime:
    """Holds settings and builds the Gemini clients that every worker shares."""

    def __init__(self, settings: AgentSettings) -> None:
        self.settings = settings
        configure_tracing(settings)
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model=settings.gemini_embedding_model,
            api_key=settings.google_api_key,
            task_type="SEMANTIC_SIMILARITY",
        )

    def chat(self, temperature: float, *, json_mode: bool = False) -> ChatGoogleGenerativeAI:
        """A chat model. `max_retries=0` because retries are handled by `agents.retry`."""
        return ChatGoogleGenerativeAI(
            model=self.settings.gemini_model,
            google_api_key=self.settings.google_api_key,
            temperature=temperature,
            max_retries=0,
            timeout=self.settings.llm_timeout_seconds,
            response_mime_type="application/json" if json_mode else None,
        )
