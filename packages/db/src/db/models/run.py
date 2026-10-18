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
    edited_content: str | None = None  # the user's edited version; `content` stays the AI's
    # Claims the fact-check still flagged in the AI's letter: {section, claim, reason}.
    issues: list[dict[str, str]] = Field(default_factory=list)
    # False for letters saved before the check existed, or when the check itself failed.
    fact_checked: bool = False
    created_at: datetime = Field(default_factory=_now)


class Run(Document):
    """One customization run saved to a logged-in user's history."""

    user_id: PydanticObjectId
    jd_text: str
    resume_text: str
    resume_structured: dict[str, Any] | None = None
    selected_sections: list[Section]
    customized_resume: dict[str, Any] | None = None
    edited_resume: dict[str, Any] | None = (
        None  # the user's edits; `customized_resume` stays the AI's
    )
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
