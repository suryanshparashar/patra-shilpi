"""Password hashing, access-token (JWT) and refresh-token primitives."""

import base64
import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import bcrypt
import jwt
from fastapi.concurrency import run_in_threadpool

from api.config import settings
from api.errors import AppError

_ALGORITHM = "HS256"


# --- passwords -----------------------------------------------------------------------------


def _prehash(password: str) -> bytes:
    """SHA-256 the password first. bcrypt only reads the first 72 bytes, so this lets users
    have long passwords (up to the configured max) without silent truncation."""
    return base64.b64encode(hashlib.sha256(password.encode()).digest())


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(_prehash(password), bcrypt.gensalt()).decode()


def _check_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(_prehash(password), hashed.encode())


# A real hash to compare against when the username doesn't exist, so a failed login takes the
# same time either way (no username enumeration by timing).
_DUMMY_HASH = _hash_password("not-a-real-password")


async def hash_password(password: str) -> str:
    return await run_in_threadpool(_hash_password, password)


async def verify_password(password: str, hashed: str | None) -> bool:
    """Check a password. `hashed=None` (unknown user) still burns the same time, then fails."""
    result = await run_in_threadpool(_check_password, password, hashed or _DUMMY_HASH)
    return result and hashed is not None


# --- JWTs (user access tokens and admin session tokens) -------------------------------------


def _encode(subject: str, typ: str, minutes: int, **extra: str) -> str:
    now = datetime.now(UTC)
    claims = {
        "sub": subject,
        "typ": typ,
        "iat": now,
        "exp": now + timedelta(minutes=minutes),
        **extra,
    }
    return jwt.encode(claims, settings.jwt_secret.get_secret_value(), algorithm=_ALGORITHM)


def _decode(token: str, typ: str, expired: AppError, invalid: AppError) -> dict[str, Any]:
    """Verify signature, expiry and token type. A token of the other type is rejected, so an
    access token can never open the admin panel or the other way round."""
    try:
        claims: dict[str, Any] = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=[_ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise expired from exc
    except jwt.InvalidTokenError as exc:
        raise invalid from exc
    if claims.get("typ") != typ:
        raise invalid
    return claims


def create_access_token(user_id: str) -> str:
    return _encode(user_id, "access", settings.access_token_minutes)


def decode_access_token(token: str) -> str:
    """Return the user id in a valid access token, or raise a 401 AppError."""
    claims = _decode(
        token,
        "access",
        AppError(401, "TOKEN_EXPIRED", "Your session has expired."),
        AppError(401, "TOKEN_INVALID", "Your session is invalid."),
    )
    return str(claims["sub"])


@dataclass(frozen=True)
class AdminClaims:
    name: str
    method: Literal["password", "keyword"]


def create_admin_token(name: str, method: Literal["password", "keyword"]) -> str:
    return _encode(name, "admin", settings.admin_session_minutes, method=method)


def decode_admin_token(token: str) -> AdminClaims:
    claims = _decode(
        token,
        "admin",
        AppError(401, "ADMIN_EXPIRED", "The admin session has expired. Please log in again."),
        AppError(401, "ADMIN_INVALID", "The admin session is invalid. Please log in again."),
    )
    method: Literal["password", "keyword"] = (
        "keyword" if claims.get("method") == "keyword" else "password"
    )
    return AdminClaims(name=str(claims["sub"]), method=method)


# --- refresh token (opaque, stored hashed) -------------------------------------------------


def new_refresh_token() -> tuple[str, str]:
    """A fresh random token and its SHA-256 hash. Only the hash is ever stored."""
    raw = secrets.token_urlsafe(48)
    return raw, hash_refresh_token(raw)


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
