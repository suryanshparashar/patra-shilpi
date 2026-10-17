"""Saving runs to a logged-in user's history, and reading them back."""

import logging
import re

from beanie import PydanticObjectId
from bson.errors import InvalidId
from pydantic import ValidationError

from agents import Section, StructuredResume, devlog
from agents.result import RunResult
from api.errors import AppError
from api.schemas import CoverLetterOut, HistoryDetail, HistoryItem
from api.services.pagination import encode_cursor, older_than
from db import CoverLetter, Run, User

logger = logging.getLogger(__name__)

SNIPPET_CHARS = 140


def _snippet(text: str) -> str:
    flat = re.sub(r"\s+", " ", text).strip()
    return flat if len(flat) <= SNIPPET_CHARS else flat[: SNIPPET_CHARS - 1].rstrip() + "…"


def _parse_resume(data: dict | None) -> StructuredResume | None:  # type: ignore[type-arg]
    if not data:
        return None
    try:
        return StructuredResume.model_validate(data)
    except ValidationError:
        return None


def to_item(run: Run) -> HistoryItem:
    customized = _parse_resume(run.customized_resume)
    return HistoryItem(
        id=str(run.id),
        created_at=run.created_at,
        status=run.status,
        selected_sections=run.selected_sections,
        jd_snippet=_snippet(run.jd_text),
        candidate_name=customized.contact.name if customized else None,
        match_score_before=run.match_score_before,
        match_score_after=run.match_score_after,
        ats_score=run.ats_score,
        cover_letter_count=len(run.cover_letters),
    )


def to_detail(run: Run) -> HistoryDetail:
    return HistoryDetail(
        **to_item(run).model_dump(),
        jd_text=run.jd_text,
        original_resume=_parse_resume(run.resume_structured),
        customized_resume=_parse_resume(run.customized_resume),
        highlighted_skills=run.highlighted_skills,
        errors=run.errors,
        cover_letters=[CoverLetterOut(**c.model_dump()) for c in run.cover_letters],
    )


# --- listing -------------------------------------------------------------------------------


async def list_runs(user: User, limit: int, cursor: str | None) -> tuple[list[Run], str | None]:
    query: dict = {"user_id": user.id}  # type: ignore[type-arg]
    if cursor:
        query.update(older_than(cursor))
    runs = await Run.find(query).sort("-created_at", "-_id").limit(limit + 1).to_list()
    page = runs[:limit]
    return page, (encode_cursor(page[-1].created_at, page[-1].id) if len(runs) > limit else None)


async def get_run(user: User, run_id: str) -> Run:
    """The user's own run, or a 404 (also for other people's runs and malformed ids)."""
    try:
        oid = PydanticObjectId(run_id)
    except InvalidId as exc:
        raise AppError(404, "RUN_NOT_FOUND", "That run was not found.") from exc
    run = await Run.find_one({"_id": oid, "user_id": user.id})
    if run is None:
        raise AppError(404, "RUN_NOT_FOUND", "That run was not found.")
    return run


# --- writes --------------------------------------------------------------------------------


async def save_run(
    user: User, *, jd_text: str, resume_text: str, sections: list[Section], result: RunResult
) -> str | None:
    """Save a finished run. Never raises: a storage problem must not break the user's result."""
    assert user.id is not None
    try:
        run = await Run(
            user_id=user.id,
            jd_text=jd_text,
            resume_text=resume_text,
            resume_structured=result.original_resume.model_dump()
            if result.original_resume
            else None,
            selected_sections=sections,
            customized_resume=result.customized_resume.model_dump()
            if result.customized_resume
            else None,
            highlighted_skills=result.highlighted_skills,
            match_score_before=result.match_before,
            match_score_after=result.match_after,
            ats_score=result.ats_report.score if result.ats_report else None,
            status=result.status,
            errors=[e.message for e in result.errors],
        ).insert()
        devlog("DB", "run saved to history", run=str(run.id), status=result.status)
        return str(run.id)
    except Exception:
        logger.exception("Could not save run to history")
        return None


async def attach_cover_letter(user: User, run_id: str, content: str) -> None:
    """Add a cover letter to one of the user's runs. Never raises (same reason as save_run)."""
    try:
        run = await get_run(user, run_id)
        await Run.find_one({"_id": run.id}).update(
            {"$push": {"cover_letters": CoverLetter(content=content).model_dump()}}
        )
    except Exception:
        logger.exception("Could not save cover letter to history")
