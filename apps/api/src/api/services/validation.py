from agents import devlog
from api.config import settings
from api.errors import AppError


def validate_job_description(text: str) -> str:
    """Return the trimmed JD, or raise AppError if it is empty, too short or too long."""
    jd = text.strip()
    if not jd:
        raise AppError(422, "JD_EMPTY", "Please paste the job description.")
    if len(jd) < settings.jd_min_chars:
        raise AppError(
            422,
            "JD_TOO_SHORT",
            f"The job description is too short. Enter at least {settings.jd_min_chars} characters.",
            {"min": settings.jd_min_chars, "actual": len(jd)},
        )
    if len(jd) > settings.jd_max_chars:
        raise AppError(
            422,
            "JD_TOO_LONG",
            f"The job description is too long. Keep it under {settings.jd_max_chars} characters.",
            {"max": settings.jd_max_chars, "actual": len(jd)},
        )
    devlog("SERVICE", "job description accepted", chars=len(jd))
    return jd
