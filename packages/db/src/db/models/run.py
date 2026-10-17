from datetime import UTC, datetime
from typing import Any, Literal

import pymongo
from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field

Section = Literal["summary", "skills", "experience", "projects"]
RunStatus = Literal["completed", "partial", "failed"]


def _now() -> datetime:
    return datetime.now(UTC)


class CoverLetter(BaseModel):
    content: str
    created_at: datetime = Field(default_factory=_now)


class Run(Document):
    """One customization run saved to a logged-in user's history."""

    user_id: PydanticObjectId
    jd_text: str
    resume_text: str
    resume_structured: dict[str, Any] | None = None
    selected_sections: list[Section]
    customized_resume: dict[str, Any] | None = None
    highlighted_skills: list[str] = Field(default_factory=list)
    match_score_before: float | None = None
    match_score_after: float | None = None
    ats_score: int | None = None
    cover_letters: list[CoverLetter] = Field(default_factory=list)
    status: RunStatus = "completed"
    errors: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "runs"
        indexes = [
            pymongo.IndexModel(
                [("user_id", pymongo.ASCENDING), ("created_at", pymongo.DESCENDING)]
            ),
        ]
