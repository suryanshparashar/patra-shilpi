from beanie import Document

COUNTERS_ID = "counters"


class AdminStats(Document):
    """A single document of permanent counters.

    `guests_total` counts guests who spent their free run. It lives here, not in `GuestUsage`,
    because guest rows expire after 90 days but this number must be all-time.
    """

    id: str = COUNTERS_ID  # type: ignore[assignment]
    guests_total: int = 0

    class Settings:
        name = "admin_stats"
