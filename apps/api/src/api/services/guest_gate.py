"""The one-free-run rule for guests.

A guest is recognised by two independent signals: a signed httpOnly device cookie and a browser
fingerprint sent by the client. Either one matching a previous run blocks the guest. Only salted
HMAC-SHA256 hashes are stored (see `db.GuestUsage`).

Lifecycle of the single free run:
    reserve()   -> row inserted as "in_progress" (blocks a second tab/parallel run)
    mark_used() -> run produced a customized resume: the free run is spent
    release()   -> run failed or the client left: the row is deleted, the guest may retry
"""

import hmac
import re
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hashlib import sha256

from beanie import PydanticObjectId
from pymongo.errors import DuplicateKeyError

from agents import devlog
from api.config import Settings
from api.errors import AppError
from db import GuestUsage

_FINGERPRINT_RE = re.compile(r"^[A-Za-z0-9_\-]+$")


@dataclass(frozen=True)
class GuestSlot:
    """A reserved free run. Pass it to `mark_used` or `release`."""

    id: PydanticObjectId
    is_new_guest: bool  # False when this guest was seen before (a retry after a failed run)


@dataclass(frozen=True)
class DeviceId:
    value: str
    is_new: bool  # True when no valid cookie came with the request, so one must be set


class GuestGate:
    def __init__(self, settings: Settings) -> None:
        self._secret = settings.guest_hash_secret.get_secret_value().encode()
        self._settings = settings

    # --- device cookie ---------------------------------------------------------------------

    def _mac(self, kind: str, value: str) -> str:
        return hmac.new(self._secret, f"{kind}:{value}".encode(), sha256).hexdigest()

    def read_device_id(self, cookie_value: str | None) -> DeviceId:
        """Return the device id in a valid signed cookie, or mint a new one."""
        if cookie_value and "." in cookie_value:
            device_id, _, signature = cookie_value.rpartition(".")
            if hmac.compare_digest(signature, self._mac("cookie", device_id)):
                return DeviceId(device_id, is_new=False)
        return DeviceId(secrets.token_urlsafe(24), is_new=True)

    def sign_device_id(self, device_id: str) -> str:
        return f"{device_id}.{self._mac('cookie', device_id)}"

    # --- the free run ----------------------------------------------------------------------

    def validate_fingerprint(self, fingerprint: str | None) -> str:
        s = self._settings
        value = (fingerprint or "").strip()
        if not (s.fingerprint_min_chars <= len(value) <= s.fingerprint_max_chars) or not (
            _FINGERPRINT_RE.match(value)
        ):
            raise AppError(
                422, "FINGERPRINT_INVALID", "A valid browser fingerprint is required for guests."
            )
        return value

    async def reserve(self, device_id: str, fingerprint: str) -> GuestSlot:
        """Claim the guest's free run, or raise if it is spent or already in progress."""
        device_hash = self._mac("device", device_id)
        fingerprint_hash = self._mac("fingerprint", fingerprint)

        reclaimed = False
        for _ in range(2):  # the second pass runs only after clearing reclaimable rows
            try:
                doc = await GuestUsage(
                    device_hash=device_hash, fingerprint_hash=fingerprint_hash
                ).insert()
                assert doc.id is not None
                devlog("GUEST", "free run reserved", new_guest=not reclaimed)
                return GuestSlot(id=doc.id, is_new_guest=not reclaimed)
            except DuplicateKeyError:
                cleared = await self._clear_reclaimable(device_hash, fingerprint_hash)
                if cleared is None:
                    break
                reclaimed = reclaimed or cleared > 0
        await self._raise_blocked(device_hash, fingerprint_hash)
        raise AssertionError("unreachable")  # pragma: no cover

    async def _matches(self, device_hash: str, fingerprint_hash: str) -> list[GuestUsage]:
        query = {"$or": [{"device_hash": device_hash}, {"fingerprint_hash": fingerprint_hash}]}
        return await GuestUsage.find(query).to_list()

    async def _clear_reclaimable(self, device_hash: str, fingerprint_hash: str) -> int | None:
        """Make room for a retry. Returns how many old rows were removed, or None if blocked.

        Reclaimable rows are runs that failed ("released") and reservations abandoned for longer
        than the TTL. If any matching row is a live reservation or a spent run, the guest stays
        blocked. A count of 0 means the conflicting row vanished (TTL) in the meantime.
        """
        matches = await self._matches(device_hash, fingerprint_hash)
        cutoff = datetime.now(UTC) - timedelta(seconds=self._settings.guest_reservation_ttl_seconds)
        reclaimable = [
            m
            for m in matches
            if m.status == "released"
            or (m.status == "in_progress" and m.reserved_at.astimezone(UTC) < cutoff)
        ]
        if len(reclaimable) != len(matches):
            return None
        if reclaimable:
            await GuestUsage.find({"_id": {"$in": [m.id for m in reclaimable]}}).delete()
        return len(reclaimable)

    async def _raise_blocked(self, device_hash: str, fingerprint_hash: str) -> None:
        matches = await self._matches(device_hash, fingerprint_hash)
        if any(m.status == "used" for m in matches):
            devlog("GUEST", "blocked: free run already used")
            raise AppError(
                403,
                "GUEST_LIMIT_REACHED",
                "You have used your free run. Log in or register to keep customizing.",
            )
        devlog("GUEST", "blocked: a run is already in progress")
        raise AppError(
            409,
            "GUEST_RUN_IN_PROGRESS",
            "A run is already in progress for this browser. Please wait for it to finish.",
        )

    async def mark_used(self, slot: GuestSlot) -> None:
        devlog("GUEST", "free run spent")
        await GuestUsage.find_one({"_id": slot.id}).update(
            {"$set": {"status": "used", "used_at": datetime.now(UTC)}}
        )

    async def release(self, slot: GuestSlot) -> None:
        """Give the free run back after a failed run (only if it was never marked used).

        The row is kept, marked "released", so the guest is still counted once if they retry.
        """
        devlog("GUEST", "free run released (the run did not finish)")
        await GuestUsage.find_one({"_id": slot.id, "status": "in_progress"}).update(
            {"$set": {"status": "released"}}
        )
