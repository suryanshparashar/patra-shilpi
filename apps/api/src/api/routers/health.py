from fastapi import APIRouter, Request

from api.config import settings

router = APIRouter(tags=["health"])


@router.get("/healthcheck")
async def healthcheck(request: Request) -> dict[str, str]:
    await request.app.state.mongo_client.admin.command("ping")
    return {"status": "ok", "environment": settings.environment, "database": "connected"}
