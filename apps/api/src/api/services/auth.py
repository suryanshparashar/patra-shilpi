"""Registration, login, refresh-token rotation and the auth cookies."""

import re
from datetime import UTC, datetime, timedelta

from beanie import PydanticObjectId
from bson.errors import InvalidId
from fastapi import Response
from pymongo.errors import DuplicateKeyError
from pymongo.results import UpdateResult

from agents import devlog
from api.config import settings
from api.errors import AppError
from api.services.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from db import RefreshToken, User

_USERNAME_RE = re.compile(r"^[a-z0-9_-]+$")


# --- validation ----------------------------------------------------------------------------


def normalize_username(username: str) -> str:
    return username.strip().lower()


def validate_username(username: str) -> str:
    """Return the normalized username, or raise a 422 AppError."""
    name = normalize_username(username)
    low, high = settings.username_min_chars, settings.username_max_chars
    if not (low <= len(name) <= high) or not _USERNAME_RE.match(name):
        raise AppError(
            422,
            "USERNAME_INVALID",
            f"Username must be {low}-{high} characters: lowercase letters, numbers, "
            "underscores or hyphens.",
        )
    return name


def validate_password(password: str) -> None:
    low, high = settings.password_min_chars, settings.password_max_chars
    if not (low <= len(password) <= high):
        raise AppError(422, "PASSWORD_INVALID", f"Password must be {low}-{high} characters long.")


# --- users ---------------------------------------------------------------------------------


async def register_user(username: str, password: str) -> User:
    name = validate_username(username)
    validate_password(password)
    user = User(username=name, username_key=name, password_hash=await hash_password(password))
    try:
        saved = await user.insert()
        devlog("AUTH", "account created", user=name)
        return saved
    except DuplicateKeyError as exc:
        raise AppError(409, "USERNAME_TAKEN", "That username is already taken.") from exc


async def authenticate(username: str, password: str) -> User:
    """Return the user for valid credentials.

    An unknown username and a wrong password are separate errors, so the form can point at the
    right field. (Sign-up already reveals whether a username is taken, so this exposes nothing
    new; failed attempts are still rate limited.)
    """
    user = await User.find_one({"username_key": normalize_username(username)})
    if user is None:
        devlog("AUTH", "login failed", code="USER_NOT_FOUND", user=normalize_username(username))
        raise AppError(401, "USER_NOT_FOUND", "No account with that username.")
    if not await verify_password(password, user.password_hash):
        devlog("AUTH", "login failed", code="WRONG_PASSWORD", user=user.username)
        raise AppError(401, "WRONG_PASSWORD", "That password is incorrect.")
    await User.find_one({"_id": user.id}).update({"$set": {"last_login_at": datetime.now(UTC)}})
    devlog("AUTH", "login ok", user=user.username)
    return user


async def qa_user() -> User:
    """The configured test account for the one-click /qa login.

    Only ever the single username in QA_LOGIN_USERNAME, and only if that account already exists;
    with the setting unset the feature is off. Never creates accounts.
    """
    if not settings.qa_login_username:
        raise AppError(404, "QA_LOGIN_DISABLED", "Test login is not enabled.")
    user = await User.find_one({"username_key": normalize_username(settings.qa_login_username)})
    if user is None:
        devlog("AUTH", "test login failed", code="QA_USER_NOT_FOUND")
        raise AppError(404, "QA_USER_NOT_FOUND", "The test account doesn't exist yet.")
    await User.find_one({"_id": user.id}).update({"$set": {"last_login_at": datetime.now(UTC)}})
    devlog("AUTH", "test login ok", user=user.username)
    return user


async def user_from_access_token(token: str) -> User:
    user_id = decode_access_token(token)
    try:
        user = await User.get(PydanticObjectId(user_id))
    except InvalidId:
        user = None
    if user is None:
        raise AppError(401, "TOKEN_INVALID", "Your session is invalid.")
    return user


# --- sessions ------------------------------------------------------------------------------


async def start_session(user: User) -> tuple[str, str]:
    """Create a refresh token for the user. Returns (access_token, refresh_token)."""
    assert user.id is not None
    raw, token_hash = new_refresh_token()
    await RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
    ).insert()
    return create_access_token(str(user.id)), raw


def _invalid_refresh() -> AppError:
    devlog("AUTH", "refresh rejected", code="REFRESH_INVALID")
    return AppError(401, "REFRESH_INVALID", "Please log in again.")


async def rotate_session(raw_refresh: str | None) -> tuple[User, str, str]:
    """Trade a valid refresh token for a new pair. The old token is single-use."""
    if not raw_refresh:
        raise _invalid_refresh()
    token = await RefreshToken.find_one({"token_hash": hash_refresh_token(raw_refresh)})
    if token is None or token.revoked or token.expires_at.astimezone(UTC) <= datetime.now(UTC):
        raise _invalid_refresh()

    # Claim it atomically: of two concurrent refreshes with the same token, only one wins.
    claimed = await RefreshToken.find_one({"_id": token.id, "revoked": False}).update(
        {"$set": {"revoked": True}}
    )
    if not isinstance(claimed, UpdateResult) or claimed.modified_count != 1:
        raise _invalid_refresh()

    user = await User.get(token.user_id)
    if user is None:
        raise _invalid_refresh()
    access, refresh = await start_session(user)
    devlog("AUTH", "session refreshed", user=user.username)
    return user, access, refresh


async def end_session(raw_refresh: str | None) -> None:
    """Revoke the refresh token of this browser's session (logout). Unknown tokens are fine."""
    if raw_refresh:
        await RefreshToken.find_one({"token_hash": hash_refresh_token(raw_refresh)}).update(
            {"$set": {"revoked": True}}
        )


# --- cookies -------------------------------------------------------------------------------


def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    max_age = settings.refresh_token_days * 24 * 60 * 60
    common = {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
        "domain": settings.cookie_domain,
        "max_age": max_age,
    }
    # The access cookie outlives the JWT inside it on purpose: an expired token must reach the
    # server as a 401 (so the web app refreshes), not vanish and make the user look like a guest.
    response.set_cookie(settings.access_cookie_name, access, path="/", **common)  # type: ignore[arg-type]
    response.set_cookie(
        settings.refresh_cookie_name,
        refresh,
        path=settings.refresh_cookie_path,
        **common,  # type: ignore[arg-type]
    )


def clear_auth_cookies(response: Response) -> None:
    for name, path in (
        (settings.access_cookie_name, "/"),
        (settings.refresh_cookie_name, settings.refresh_cookie_path),
    ):
        response.delete_cookie(
            name,
            path=path,
            domain=settings.cookie_domain,
            secure=settings.cookie_secure,
            httponly=True,
            samesite=settings.cookie_samesite,
        )
