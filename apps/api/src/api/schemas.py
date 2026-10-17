"""Request/response models for the auth and history routes."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from agents import Section, StructuredResume
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
    content: str
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


class HistoryPage(BaseModel):
    items: list[HistoryItem]
    next_cursor: str | None


class HistoryDetail(HistoryItem):
    jd_text: str
    original_resume: StructuredResume | None
    customized_resume: StructuredResume | None
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
