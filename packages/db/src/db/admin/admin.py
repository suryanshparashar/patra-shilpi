from datetime import UTC, datetime

from beanie import Document, Indexed
from pydantic import Field


def _now() -> datetime:
    return datetime.now(UTC)


class Admin(Document):
    """The (single) admin account, kept apart from regular users.

    `password_hash` uses the same scheme as `User.password_hash`: bcrypt over the base64 of the
    SHA-256 of the password (see `api.services.security.hash_password`).
    """

    username: Indexed(str, unique=True)  # type: ignore[valid-type]
    password_hash: str
    created_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "admins"
