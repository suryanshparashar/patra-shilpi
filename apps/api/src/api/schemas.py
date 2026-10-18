"""Request/response models for the auth and history routes."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from agents import Section, StructuredResume
from agents.schemas import GuardrailIssue
from db import User


class Credentials(BaseModel):
    # Generous caps only guard against huge payloads; the real rules are in services.auth.
    username: str = Field(max_length=100)
    password: str = Field(max_length=1000)


class UserOut(BaseModel):
    id: str
    username: str
    created_at: datetime

    @classmethod
    def from_user(cls, user: User) -> "UserOut":
        return cls(id=str(user.id), username=user.username, created_at=user.created_at)


class CoverLetterOut(BaseModel):
    content: str  # what the user last saved: their edit if there is one, else the AI's letter
    ai_content: str  # the AI's original letter
    issues: list[GuardrailIssue] = []  # claims the fact-check still flagged in it
    fact_checked: bool = False  # False: saved before the check existed, or the check failed
    edited: bool = False
    created_at: datetime


class HistoryItem(BaseModel):
    id: str
    created_at: datetime
    status: Literal["completed", "partial", "failed"]
    selected_sections: list[Section]
    jd_snippet: str
    candidate_name: str | None
    match_score_before: float | None
    match_score_after: float | None
    ats_score: int | None
    cover_letter_count: int


class HistoryEdits(BaseModel):
    """What the user changed after the run. Fields left out are not touched."""

    resume: StructuredResume | None = None
    reset_resume: bool = False
    letter_index: int | None = Field(default=None, ge=0)
    letter: str | None = Field(default=None, max_length=10_000)
    reset_letter: bool = False


class HistoryPage(BaseModel):
    items: list[HistoryItem]
    next_cursor: str | None


class HistoryDetail(HistoryItem):
    jd_text: str
    original_resume: StructuredResume | None
    customized_resume: StructuredResume | None  # the user's edit if there is one
    ai_resume: StructuredResume | None  # the AI's version, to reset to
    resume_edited: bool = False
    highlighted_skills: list[str]
    errors: list[str]
    cover_letters: list[CoverLetterOut]


# --- Admin panel ---------------------------------------------------------------------------


class KeywordLogin(BaseModel):
    keyword: str = Field(max_length=500)


class AdminSession(BaseModel):
    name: str
    method: Literal["password", "keyword"]


class StatsOut(BaseModel):
    registered_users: int
    registered_admins: int
    guest_users: int  # guests who spent their free run, all-time
    resume_runs: int
    cover_letter_runs: int
    llm_calls: int
    embedding_calls: int
    input_tokens: int
    output_tokens: int
    total_tokens: int
    estimated_cost_usd: float | None  # None when prices are not configured
    pricing_configured: bool


class AdminUserRow(BaseModel):
    id: str
    username: str
    created_at: datetime
    resume_runs: int
    cover_letter_runs: int


class AdminUsersPage(BaseModel):
    items: list[AdminUserRow]
    next_cursor: str | None
