from typing import Any

from fastapi import APIRouter, Response
from pydantic import BaseModel

from agents import StructuredResume
from agents.result import RunResult
from agents.schemas import JDAnalysis
from api.deps import AgentsDep, RequiredUserDep, cover_letter_limiter
from api.services.history import attach_cover_letter
from api.services.streaming import run_to_sse
from api.services.usage import make_usage_sink
from api.services.validation import validate_job_description
from api.sse import sse_response

router = APIRouter(tags=["cover-letter"])


class CoverLetterRequest(BaseModel):
    """The client resends the run's context, so the server keeps no per-run state."""

    jd_text: str
    customized_resume: StructuredResume
    jd_analysis: JDAnalysis | None = None  # from the run's result; saves re-analyzing the JD
    run_id: str | None = None  # the history entry to attach the letter to, if the run was saved


@router.post("/cover-letter")
async def cover_letter(
    body: CoverLetterRequest, agents: AgentsDep, user: RequiredUserDep
) -> Response:
    """Write a cover letter (login required). Streams Server-Sent Events:
    `progress`, `token`, `token_reset`, then one `result` (or `error`)."""
    jd = validate_job_description(body.jd_text)
    cover_letter_limiter.check(str(user.id))

    async def on_result(result: RunResult) -> dict[str, Any]:
        if body.run_id and result.cover_letter:
            await attach_cover_letter(user, body.run_id, result.cover_letter)
        return {}

    events = agents.stream_cover_letter(
        jd_text=jd,
        customized_resume=body.customized_resume,
        jd_analysis=body.jd_analysis,
        usage_sink=make_usage_sink(user, "cover_letter"),
    )
    return sse_response(run_to_sse(events, on_result=on_result))
