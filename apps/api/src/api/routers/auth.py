from fastapi import APIRouter, Request, Response

from api.config import settings
from api.deps import RequiredUserDep, client_ip, login_limiter, register_limiter
from api.errors import AppError, error_response
from api.schemas import Credentials, UserOut
from api.services.auth import (
    authenticate,
    clear_auth_cookies,
    end_session,
    normalize_username,
    qa_user,
    register_user,
    rotate_session,
    set_auth_cookies,
    start_session,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201)
async def register(body: Credentials, request: Request, response: Response) -> UserOut:
    """Create an account and log in."""
    register_limiter.check(client_ip(request))
    user = await register_user(body.username, body.password)
    access, refresh = await start_session(user)
    set_auth_cookies(response, access, refresh)
    return UserOut.from_user(user)


@router.post("/login")
async def login(body: Credentials, request: Request, response: Response) -> UserOut:
    # Only failed attempts count toward the limit, and a success forgives earlier failures.
    key = f"{client_ip(request)}|{normalize_username(body.username)}"
    login_limiter.ensure_allowed(key)
    try:
        user = await authenticate(body.username, body.password)
    except AppError:
        login_limiter.hit(key)
        raise
    login_limiter.clear(key)
    access, refresh = await start_session(user)
    set_auth_cookies(response, access, refresh)
    return UserOut.from_user(user)


@router.post("/qa-login")
async def qa_login(response: Response) -> UserOut:
    """Log in as the configured test account without a password (the /qa link for evaluators).
    Disabled unless QA_LOGIN_USERNAME is set."""
    user = await qa_user()
    access, refresh = await start_session(user)
    set_auth_cookies(response, access, refresh)
    return UserOut.from_user(user)


@router.post("/refresh", response_model=UserOut)
async def refresh(request: Request, response: Response) -> UserOut | Response:
    """Trade the refresh cookie for a new access + refresh pair (the old refresh is revoked)."""
    try:
        user, access, new_refresh = await rotate_session(
            request.cookies.get(settings.refresh_cookie_name)
        )
    except AppError as exc:
        # The session is dead: say so and wipe both cookies so the browser starts clean.
        failure = error_response(exc.status_code, exc.code, exc.message)
        clear_auth_cookies(failure)
        return failure
    set_auth_cookies(response, access, new_refresh)
    return UserOut.from_user(user)


@router.post("/logout", status_code=204)
async def logout(request: Request) -> Response:
    """End this browser's session. Safe to call when not logged in."""
    await end_session(request.cookies.get(settings.refresh_cookie_name))
    response = Response(status_code=204)
    clear_auth_cookies(response)
    return response


@router.get("/me")
async def me(user: RequiredUserDep) -> UserOut:
    return UserOut.from_user(user)
