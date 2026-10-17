import logging
from typing import Annotated, Any

from fastapi import APIRouter, Cookie, Form, Response, UploadFile
from fastapi.concurrency import run_in_threadpool

from agents import Section
from agents.result import RunResult
from api.config import settings
from api.deps import AgentsDep, GuestGateDep, OptionalUserDep, customize_limiter
from api.services.guest_gate import DeviceId, GuestSlot
from api.services.history import save_run
from api.services.pdf_parser import parse_resume_pdf, read_upload
from api.services.streaming import run_to_sse
from api.services.usage import make_usage_sink, record_new_guest
from api.services.validation import validate_job_description
from api.sse import sse_response

logger = logging.getLogger(__name__)

router = APIRouter(tags=["customize"])

COOKIE_MAX_AGE = 90 * 24 * 60 * 60


@router.post("/customize")
async def customize(
    agents: AgentsDep,
    gate: GuestGateDep,
    user: OptionalUserDep,
    jd_text: Annotated[str, Form()],
    sections: Annotated[list[Section], Form(min_length=1)],
    resume: UploadFile,
    fingerprint: Annotated[str | None, Form()] = None,
    device_cookie: Annotated[str | None, Cookie(alias=settings.guest_cookie_name)] = None,
) -> Response:
    """Customize a resume for a job description. Streams Server-Sent Events:
    `progress`, `token`, `token_reset`, then one `result` (or `error`).

    Logged-in users are rate limited and the run is saved to their history (`run_id` in the
    result). Guests get one free run, spent only if a customized resume is produced."""
    # 1. Validate everything first: bad input must never spend a guest's free run.
    jd = validate_job_description(jd_text)
    selected = list(dict.fromkeys(sections))  # drop duplicates, keep order
    resume_text = (await run_in_threadpool(parse_resume_pdf, await read_upload(resume))).text

    # 2. Who is asking?
    slot: GuestSlot | None = None
    device: DeviceId | None = None
    if user is not None:
        customize_limiter.check(str(user.id))
    else:
        valid_fingerprint = gate.validate_fingerprint(fingerprint)
        device = gate.read_device_id(device_cookie)
        slot = await gate.reserve(device.value, valid_fingerprint)
        if slot.is_new_guest:
            await record_new_guest()

    # 3. Stream the run.
    spent = False

    async def on_result(result: RunResult) -> dict[str, Any]:
        nonlocal spent
        if slot is not None and result.status != "failed":
            await gate.mark_used(slot)
            spent = True
        if user is not None:
            run_id = await save_run(
                user, jd_text=jd, resume_text=resume_text, sections=selected, result=result
            )
            return {"run_id": run_id}
        return {}

    async def cleanup() -> None:
        if slot is not None and not spent:
            await gate.release(slot)

    events = agents.stream_customize(
        jd_text=jd,
        resume_text=resume_text,
        sections=selected,
        usage_sink=make_usage_sink(user, "resume"),
    )
    response = sse_response(run_to_sse(events, on_result=on_result, cleanup=cleanup))
    if device is not None and device.is_new:
        response.set_cookie(
            settings.guest_cookie_name,
            gate.sign_device_id(device.value),
            max_age=COOKIE_MAX_AGE,
            httponly=True,
            secure=settings.cookie_secure,
            samesite=settings.cookie_samesite,
            domain=settings.cookie_domain,
        )
    return response
