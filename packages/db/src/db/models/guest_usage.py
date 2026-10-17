from datetime import UTC, datetime
from typing import Literal

import pymongo
from beanie import Document, Indexed
from pydantic import Field

# Guest records disappear after this long, which is also when a guest's free run "resets".
GUEST_TTL_SECONDS = 90 * 24 * 60 * 60


def _now() -> datetime:
    return datetime.now(UTC)


class GuestUsage(Document):
    """One row per guest who has started (or finished) their single free run.

    A failed or abandoned run leaves the row as "released" (the guest may try again), so the guest
    is still counted exactly once. Only salted hashes are stored, never the raw device id or
    fingerprint. Both hashes carry a unique index, so one insert atomically claims the free run:
    it fails if *either* the device or the fingerprint has been seen before.
    """

    device_hash: Indexed(str, unique=True)  # type: ignore[valid-type]
    fingerprint_hash: Indexed(str, unique=True)  # type: ignore[valid-type]
    status: Literal["in_progress", "used", "released"] = "in_progress"
    reserved_at: datetime = Field(default_factory=_now)
    used_at: datetime | None = None
    created_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "guest_usage"
        indexes = [
            pymongo.IndexModel(
                [("created_at", pymongo.ASCENDING)], expireAfterSeconds=GUEST_TTL_SECONDS
            ),
        ]
