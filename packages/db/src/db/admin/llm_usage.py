from datetime import UTC, datetime
from typing import Literal

import pymongo
from beanie import Document, PydanticObjectId
from pydantic import Field


def _now() -> datetime:
    return datetime.now(UTC)


class LlmUsage(Document):
    """One row per LLM or embedding call. Rows are never edited or deleted with user history, so
    admin numbers do not change when a user deletes their runs.

    `run_ref` groups the calls of one run, so counting distinct `run_ref` values counts runs.
    """

    run_ref: str
    user_id: PydanticObjectId | None = None  # None for guests
    kind: Literal["resume", "cover_letter"]
    agent: str
    model: str
    call_type: Literal["llm", "embedding"]
    input_tokens: int | None = None
    output_tokens: int | None = None
    created_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "llm_usage"
        indexes = [
            pymongo.IndexModel([("kind", pymongo.ASCENDING), ("run_ref", pymongo.ASCENDING)]),
            pymongo.IndexModel([("user_id", pymongo.ASCENDING), ("kind", pymongo.ASCENDING)]),
        ]
