from typing import Annotated

from fastapi import APIRouter, Form, Query, Response

from agents import Section
from api.config import settings
from api.deps import AgentsDep, RequiredUserDep, customize_limiter
from api.schemas import HistoryDetail, HistoryPage
from api.services.history import get_run, list_runs, save_run, to_detail, to_item
from api.services.streaming import run_to_sse
from api.services.usage import make_usage_sink
from api.sse import sse_response

router = APIRouter(prefix="/history", tags=["history"])


@router.get("")
async def list_history(
    user: RequiredUserDep,
    limit: Annotated[
        int, Query(ge=1, le=settings.history_max_page_size)
    ] = settings.history_page_size,
    cursor: str | None = None,
) -> HistoryPage:
    """The user's runs, newest first. Pass the returned `next_cursor` to get the next page."""
    runs, next_cursor = await list_runs(user, limit, cursor)
    return HistoryPage(items=[to_item(r) for r in runs], next_cursor=next_cursor)


@router.get("/{run_id}")
async def get_history_item(run_id: str, user: RequiredUserDep) -> HistoryDetail:
    return to_detail(await get_run(user, run_id))


@router.delete("/{run_id}", status_code=204)
async def delete_history_item(run_id: str, user: RequiredUserDep) -> Response:
    run = await get_run(user, run_id)
    await run.delete()
    return Response(status_code=204)


@router.post("/{run_id}/rerun")
async def rerun(
    run_id: str,
    agents: AgentsDep,
    user: RequiredUserDep,
    sections: Annotated[list[Section], Form(min_length=1)],
) -> Response:
    """Run the same job description and resume again with different sections.

    Streams the same SSE events as /customize and saves the result as a new history entry.
    """
    source = await get_run(user, run_id)
    selected = list(dict.fromkeys(sections))
    customize_limiter.check(str(user.id))

    async def on_result(result):  # type: ignore[no-untyped-def]
        new_id = await save_run(
            user,
            jd_text=source.jd_text,
            resume_text=source.resume_text,
            sections=selected,
            result=result,
        )
        return {"run_id": new_id}

    events = agents.stream_customize(
        jd_text=source.jd_text,
        resume_text=source.resume_text,
        sections=selected,
        usage_sink=make_usage_sink(user, "resume"),
    )
    return sse_response(run_to_sse(events, on_result=on_result))
