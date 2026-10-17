"""Cursor paging for lists sorted newest first, with `_id` breaking ties on `created_at`."""

import base64
from datetime import datetime
from typing import Any

from beanie import PydanticObjectId
from bson.errors import InvalidId

from api.errors import AppError


def encode_cursor(created_at: datetime, oid: PydanticObjectId | None) -> str:
    raw = f"{created_at.isoformat()}|{oid}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_cursor(cursor: str) -> tuple[datetime, PydanticObjectId]:
    try:
        stamp, _, oid = base64.urlsafe_b64decode(cursor.encode()).decode().partition("|")
        return datetime.fromisoformat(stamp), PydanticObjectId(oid)
    except (ValueError, InvalidId) as exc:
        raise AppError(422, "INVALID_CURSOR", "The page cursor is not valid.") from exc


def older_than(cursor: str) -> dict[str, Any]:
    """A Mongo `$or` clause matching documents that come after the cursor (older ones)."""
    stamp, oid = decode_cursor(cursor)
    return {
        "$or": [
            {"created_at": {"$lt": stamp}},
            {"created_at": stamp, "_id": {"$lt": oid}},
        ]
    }
