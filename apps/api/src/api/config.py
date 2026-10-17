from pathlib import Path
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

API_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=API_DIR / ".env",
        extra="ignore",
        env_ignore_empty=True,  # `KEY=` with no value counts as unset
    )

    environment: str = "development"
    # Step-by-step console trail. Unset = on in development, off in production.
    devlog: bool | None = None
    cors_origins: list[str] = ["http://localhost:3000"]
    mongodb_uri: str
    mongodb_db: str = "resume_customizer_dev"

    # Input limits
    jd_min_chars: int = 50
    jd_max_chars: int = 10_000
    max_upload_bytes: int = 5 * 1024 * 1024
    max_pdf_pages: int = 5
    # Below this many extracted characters a PDF is treated as scanned/image-only.
    min_resume_chars: int = 100

    # Guests get one free run, tracked by a signed device cookie + a browser fingerprint.
    guest_hash_secret: SecretStr
    guest_cookie_name: str = "rc_device"
    guest_reservation_ttl_seconds: int = (
        10 * 60
    )  # a stuck "in progress" run is reclaimable after this
    fingerprint_min_chars: int = 16
    fingerprint_max_chars: int = 256

    # Cookies (prod: Domain=.<project-subdomain>.<domain>, Secure on; dev: host-only, Secure off)
    cookie_domain: str | None = None
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"

    # Auth: JWT access token + opaque rotating refresh token, both in httpOnly cookies
    jwt_secret: SecretStr
    access_token_minutes: int = 30
    refresh_token_days: int = 14
    access_cookie_name: str = "rc_access"
    refresh_cookie_name: str = "rc_refresh"
    refresh_cookie_path: str = "/api/v1/auth"  # the refresh token is only ever sent to auth routes
    username_min_chars: int = 3
    username_max_chars: int = 30
    password_min_chars: int = 8
    password_max_chars: int = 128
    login_max_failures: int = 5
    login_window_seconds: int = 15 * 60
    register_per_hour: int = 10  # per client IP
    # One-click test login at /qa for evaluators. Unset (the default) disables it entirely.
    qa_login_username: str | None = None

    # Admin panel: one admin, logging in with username + password or a single secret keyword
    admin_keyword: SecretStr | None = None  # unset disables keyword login
    admin_session_minutes: int = 60
    admin_cookie_name: str = "rc_admin"
    admin_cookie_path: str = "/api/v1/admin"
    admin_users_page_size: int = 50
    # USD per 1M tokens for GEMINI_MODEL. Unset means cost is reported as "not configured".
    llm_price_input_per_million: float | None = None
    llm_price_output_per_million: float | None = None

    # History
    history_page_size: int = 20
    history_max_page_size: int = 50

    # Logged-in users: runs per rolling hour, for customizations and cover letters separately
    rate_limit_per_hour: int = 10


settings = Settings()  # type: ignore[call-arg]
