"""The numbers shown on the admin dashboard."""

from typing import Any

from beanie import PydanticObjectId

from api.config import settings
from api.schemas import AdminUserRow, StatsOut
from api.services.pagination import encode_cursor, older_than
from db import COUNTERS_ID, Admin, AdminStats, GuestUsage, LlmUsage, User

# --- aggregation pipelines (kept separate so they can be checked on their own) ----------------


def runs_by_kind_pipeline() -> list[dict[str, Any]]:
    """Distinct runs per kind: all the calls of one run share a `run_ref`."""
    return [
        {"$group": {"_id": {"kind": "$kind", "run_ref": "$run_ref"}}},
        {"$group": {"_id": "$_id.kind", "runs": {"$sum": 1}}},
    ]


def totals_by_call_type_pipeline() -> list[dict[str, Any]]:
    return [
        {
            "$group": {
                "_id": "$call_type",
                "calls": {"$sum": 1},
                "input_tokens": {"$sum": {"$ifNull": ["$input_tokens", 0]}},
                "output_tokens": {"$sum": {"$ifNull": ["$output_tokens", 0]}},
            }
        }
    ]


def runs_per_user_pipeline(user_ids: list[PydanticObjectId]) -> list[dict[str, Any]]:
    return [
        {"$match": {"user_id": {"$in": user_ids}}},
        {"$group": {"_id": {"user_id": "$user_id", "kind": "$kind", "run_ref": "$run_ref"}}},
        {
            "$group": {
                "_id": {"user_id": "$_id.user_id", "kind": "$_id.kind"},
                "runs": {"$sum": 1},
            }
        },
    ]


# --- cost ------------------------------------------------------------------------------------


def estimate_cost(input_tokens: int, output_tokens: int) -> float | None:
    """tokens x price per 1M tokens, or None if prices are not configured."""
    price_in = settings.llm_price_input_per_million
    price_out = settings.llm_price_output_per_million
    if price_in is None or price_out is None:
        return None
    return input_tokens * price_in / 1_000_000 + output_tokens * price_out / 1_000_000


# --- queries ---------------------------------------------------------------------------------


async def sync_guest_counter() -> int:
    """Return the all-time number of guests who started a run (whatever the outcome).

    The counter goes up the first time a guest starts, but it can lag behind: guests from before
    the counter existed, or an increment that failed. Every stored guest row is one distinct
    guest and rows live for 90 days, so the all-time total can never be lower than the row count.
    `$max` raises the counter to that floor (creating it if missing) and never lowers it.
    """
    spent_now = await GuestUsage.count()
    collection = AdminStats.get_pymongo_collection()
    await collection.update_one(
        {"_id": COUNTERS_ID}, {"$max": {"guests_total": spent_now}}, upsert=True
    )
    counters = await AdminStats.get(COUNTERS_ID)
    return counters.guests_total if counters else spent_now


async def compute_stats() -> StatsOut:
    guests_total = await sync_guest_counter()
    runs = {
        row["_id"]: row["runs"]
        for row in await LlmUsage.aggregate(runs_by_kind_pipeline()).to_list()
    }
    totals = {
        row["_id"]: row
        for row in await LlmUsage.aggregate(totals_by_call_type_pipeline()).to_list()
    }
    llm = totals.get("llm", {})
    embedding = totals.get("embedding", {})
    # Embeddings report no tokens, so tokens and cost come from chat calls only.
    input_tokens = int(llm.get("input_tokens", 0))
    output_tokens = int(llm.get("output_tokens", 0))
    return StatsOut(
        registered_users=await User.count(),
        registered_admins=await Admin.count(),
        guest_users=guests_total,
        resume_runs=runs.get("resume", 0),
        cover_letter_runs=runs.get("cover_letter", 0),
        llm_calls=int(llm.get("calls", 0)),
        embedding_calls=int(embedding.get("calls", 0)),
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=input_tokens + output_tokens,
        estimated_cost_usd=estimate_cost(input_tokens, output_tokens),
        pricing_configured=estimate_cost(0, 0) is not None,
    )


async def list_users(limit: int, cursor: str | None) -> tuple[list[AdminUserRow], str | None]:
    """Registered users, newest first, each with their resume and cover-letter run counts."""
    query = older_than(cursor) if cursor else {}
    found = await User.find(query).sort("-created_at", "-_id").limit(limit + 1).to_list()
    page = found[:limit]

    counts: dict[tuple[Any, str], int] = {}
    ids = [u.id for u in page if u.id is not None]
    if ids:
        for row in await LlmUsage.aggregate(runs_per_user_pipeline(ids)).to_list():
            counts[(row["_id"]["user_id"], row["_id"]["kind"])] = row["runs"]

    rows = [
        AdminUserRow(
            id=str(u.id),
            username=u.username,
            created_at=u.created_at,
            resume_runs=counts.get((u.id, "resume"), 0),
            cover_letter_runs=counts.get((u.id, "cover_letter"), 0),
        )
        for u in page
    ]
    next_cursor = encode_cursor(page[-1].created_at, page[-1].id) if len(found) > limit else None
    return rows, next_cursor
