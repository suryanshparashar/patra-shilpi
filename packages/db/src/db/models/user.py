from datetime import UTC, datetime

from beanie import Document, Indexed
from pydantic import Field


def _now() -> datetime:
    return datetime.now(UTC)


class User(Document):
    username: str
    # Lowercased copy of `username`; enforces case-insensitive uniqueness.
    username_key: Indexed(str, unique=True)  # type: ignore[valid-type]
    password_hash: str
    created_at: datetime = Field(default_factory=_now)
    last_login_at: datetime | None = None

    class Settings:
        name = "users"
