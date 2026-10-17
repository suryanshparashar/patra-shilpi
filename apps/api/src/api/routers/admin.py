from typing import Annotated

from fastapi import APIRouter, Query, Request, Response

from api.config import settings
from api.deps import AdminDep, admin_login_limiter, client_ip
from api.errors import AppError
from api.schemas import AdminSession, AdminUsersPage, Credentials, KeywordLogin, StatsOut
from api.services.admin_auth import (
    clear_admin_cookie,
    login_with_keyword,
    login_with_password,
    set_admin_cookie,
)
from api.services.admin_stats import compute_stats, list_users
from api.services.security import decode_admin_token

router = APIRouter(prefix="/admin", tags=["admin"])


def _session(token: str) -> AdminSession:
    claims = decode_admin_token(token)
    return AdminSession(name=claims.name, method=claims.method)


@router.post("/login")
async def login(body: Credentials, request: Request, response: Response) -> AdminSession:
    """Log in as the admin with a username and password."""
    key = client_ip(request)
    admin_login_limiter.ensure_allowed(key)
    try:
        token = await login_with_password(body.username, body.password)
    except AppError:
        admin_login_limiter.hit(key)
        raise
    admin_login_limiter.clear(key)
    set_admin_cookie(response, token)
    return _session(token)


@router.post("/login/keyword")
async def login_keyword(body: KeywordLogin, request: Request, response: Response) -> AdminSession:
    """Log in as the same admin with the secret keyword."""
    key = client_ip(request)
    admin_login_limiter.ensure_allowed(key)
    try:
        token = login_with_keyword(body.keyword)
    except AppError:
        admin_login_limiter.hit(key)
        raise
    admin_login_limiter.clear(key)
    set_admin_cookie(response, token)
    return _session(token)


@router.post("/logout", status_code=204)
async def logout() -> Response:
    response = Response(status_code=204)
    clear_admin_cookie(response)
    return response


@router.get("/me")
async def me(admin: AdminDep) -> AdminSession:
    return AdminSession(name=admin.name, method=admin.method)


@router.get("/stats")
async def stats(_: AdminDep) -> StatsOut:
    """Totals for the dashboard cards."""
    return await compute_stats()


@router.get("/users")
async def users(
    _: AdminDep,
    limit: Annotated[int, Query(ge=1, le=100)] = settings.admin_users_page_size,
    cursor: str | None = None,
) -> AdminUsersPage:
    """Registered users, newest first, with their run counts."""
    items, next_cursor = await list_users(limit, cursor)
    return AdminUsersPage(items=items, next_cursor=next_cursor)
