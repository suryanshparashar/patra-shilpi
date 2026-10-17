"""Recording what each run costs, for the admin panel."""

import logging
from typing import Literal
from uuid import uuid4

from agents import UsageRecord, UsageSink, devlog
from db import COUNTERS_ID, AdminStats, LlmUsage, User

logger = logging.getLogger(__name__)


def make_usage_sink(user: User | None, kind: Literal["resume", "cover_letter"]) -> UsageSink:
    """A sink that saves every LLM/embedding call of one run. `user=None` means a guest.

    All the calls of the run share a `run_ref`, which is how runs are counted. It never raises:
    a storage problem must not break the user's run.
    """
    run_ref = uuid4().hex
    user_id = user.id if user else None

    async def sink(records: list[UsageRecord]) -> None:
        try:
            await LlmUsage.insert_many(
                [
                    LlmUsage(
                        run_ref=run_ref,
                        user_id=user_id,
                        kind=kind,
                        agent=r.agent,
                        model=r.model,
                        call_type=r.kind,
                        input_tokens=r.input_tokens,
                        output_tokens=r.output_tokens,
                    )
                    for r in records
                ]
            )
            devlog("DB", "usage recorded", kind=kind, calls=len(records))
        except Exception:
            logger.exception("Could not record LLM usage")

    return sink


async def record_new_guest() -> None:
    """Count a guest the first time they start a run, whatever the outcome.

    The counter is permanent (guest rows expire after 90 days). Never raises.
    """
    try:
        await AdminStats.get_pymongo_collection().update_one(
            {"_id": COUNTERS_ID}, {"$inc": {"guests_total": 1}}, upsert=True
        )
        devlog("DB", "new guest counted")
    except Exception:
        logger.exception("Could not update the guest counter")
