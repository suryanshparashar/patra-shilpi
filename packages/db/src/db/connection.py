from beanie import init_beanie
from pymongo import AsyncMongoClient

from db.models import DOCUMENT_MODELS


async def init_db(uri: str, db_name: str) -> AsyncMongoClient:  # type: ignore[type-arg]
    """Connect to MongoDB, verify the connection, and register the Beanie models."""
    client: AsyncMongoClient = AsyncMongoClient(uri, tz_aware=True)  # type: ignore[type-arg]
    await client.admin.command("ping")
    await init_beanie(database=client[db_name], document_models=DOCUMENT_MODELS)
    return client
