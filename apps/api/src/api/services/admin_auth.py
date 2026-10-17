"""Admin login (password or secret keyword) and the admin session cookie.

There is a single admin. Both login methods authorize the same access; the token only records
which one was used.
"""

import hashlib
import hmac

from fastapi import Response

from agents import devlog
from api.config import settings
from api.errors import AppError
from api.services.security import create_admin_token, verify_password
from db import Admin


def _invalid() -> AppError:
    devlog("AUTH", "admin login failed", code="ADMIN_INVALID_CREDENTIALS")
    # One message for every failure, so it never reveals which half (or method) was wrong.
    return AppError(401, "ADMIN_INVALID_CREDENTIALS", "Invalid admin credentials.")


async def login_with_password(username: str, password: str) -> str:
    """Return an admin session token for a valid admin username + password."""
    admin = await Admin.find_one({"username": username.strip()})
    valid = await verify_password(password, admin.password_hash if admin else None)
    if admin is None or not valid:
        raise _invalid()
    devlog("AUTH", "admin login ok", method="password")
    return create_admin_token(admin.username, "password")


def login_with_keyword(keyword: str) -> str:
    """Return an admin session token for the correct secret keyword (ADMIN_KEYWORD)."""
    configured = settings.admin_keyword
    if configured is None or not configured.get_secret_value():
        raise _invalid()  # keyword login is disabled
    if not keyword:
        raise _invalid()
    # Compare fixed-length digests so the comparison time does not depend on the input.
    given = hashlib.sha256(keyword.encode()).digest()
    expected = hashlib.sha256(configured.get_secret_value().encode()).digest()
    if not hmac.compare_digest(given, expected):
        raise _invalid()
    devlog("AUTH", "admin login ok", method="keyword")
    return create_admin_token("admin", "keyword")


def set_admin_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        settings.admin_cookie_name,
        token,
        max_age=settings.admin_session_minutes * 60,
        path=settings.admin_cookie_path,  # only sent to admin routes
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
    )


def clear_admin_cookie(response: Response) -> None:
    response.delete_cookie(
        settings.admin_cookie_name,
        path=settings.admin_cookie_path,
        domain=settings.cookie_domain,
        secure=settings.cookie_secure,
        httponly=True,
        samesite=settings.cookie_samesite,
    )
