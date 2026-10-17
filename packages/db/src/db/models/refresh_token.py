from datetime import UTC, datetime

import pymongo
from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field


def _now() -> datetime:
    return datetime.now(UTC)


class RefreshToken(Document):
    user_id: Indexed(PydanticObjectId)  # type: ignore[valid-type]
    # SHA-256 hex digest of the opaque token; the raw token is never stored.
    token_hash: Indexed(str, unique=True)  # type: ignore[valid-type]
    expires_at: datetime
    revoked: bool = False
    created_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "refresh_tokens"
        indexes = [
            # Mongo removes the document once expires_at has passed.
            pymongo.IndexModel([("expires_at", pymongo.ASCENDING)], expireAfterSeconds=0),
        ]
