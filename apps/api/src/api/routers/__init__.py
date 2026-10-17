from fastapi import APIRouter

from api.routers import admin, auth, cover_letter, customize, health, history

# Every backend route lives under /api/v1.
api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(customize.router)
api_router.include_router(cover_letter.router)
api_router.include_router(history.router)
api_router.include_router(admin.router)
