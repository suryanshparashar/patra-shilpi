from typing import Annotated

from fastapi import Depends, Request

from agents import ResumeAgents
from api.config import settings
from api.errors import AppError
from api.services.auth import user_from_access_token
from api.services.guest_gate import GuestGate
from api.services.rate_limit import SlidingWindowLimiter
from api.services.security import AdminClaims, decode_admin_token
from db import User

_guest_gate = GuestGate(settings)

customize_limiter = SlidingWindowLimiter(settings.rate_limit_per_hour, noun="runs")
cover_letter_limiter = SlidingWindowLimiter(settings.rate_limit_per_hour, noun="cover letters")
login_limiter = SlidingWindowLimiter(
    settings.login_max_failures, settings.login_window_seconds, noun="failed login attempts"
)
register_limiter = SlidingWindowLimiter(settings.register_per_hour, 3600, noun="sign-ups")
admin_login_limiter = SlidingWindowLimiter(
    settings.login_max_failures, settings.login_window_seconds, noun="failed admin login attempts"
)


def get_agents(request: Request) -> ResumeAgents:
    agents: ResumeAgents = request.app.state.agents
    return agents


def get_guest_gate() -> GuestGate:
    return _guest_gate


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


async def get_optional_user(request: Request) -> User | None:
    """The logged-in user, or None for a guest (no access cookie).

    A cookie that is present but expired or invalid is a 401, never a silent downgrade to guest:
    the web app answers a 401 by refreshing the session and retrying.
    """
    token = request.cookies.get(settings.access_cookie_name)
    if not token:
        return None
    return await user_from_access_token(token)


async def require_user(user: Annotated[User | None, Depends(get_optional_user)]) -> User:
    """Reject guests with a 401."""
    if user is None:
        raise AppError(401, "AUTH_REQUIRED", "Please log in to use this feature.")
    return user


async def require_admin(request: Request) -> AdminClaims:
    """Allow only a valid admin session. Admin tokens and user tokens are not interchangeable."""
    token = request.cookies.get(settings.admin_cookie_name)
    if not token:
        raise AppError(401, "ADMIN_REQUIRED", "Admin login required.")
    return decode_admin_token(token)


AgentsDep = Annotated[ResumeAgents, Depends(get_agents)]
GuestGateDep = Annotated[GuestGate, Depends(get_guest_gate)]
OptionalUserDep = Annotated[User | None, Depends(get_optional_user)]
RequiredUserDep = Annotated[User, Depends(require_user)]
AdminDep = Annotated[AdminClaims, Depends(require_admin)]
