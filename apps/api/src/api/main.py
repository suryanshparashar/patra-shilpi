import time
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from agents import AgentSettings, ResumeAgents, configure_devlog, devlog, secs
from api.config import API_DIR, settings
from api.errors import register_exception_handlers
from api.routers import api_router
from db import init_db

configure_devlog(
    settings.devlog if settings.devlog is not None else settings.environment != "production"
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    client = await init_db(settings.mongodb_uri, settings.mongodb_db)
    devlog("DB", "connected", database=settings.mongodb_db)
    app.state.mongo_client = client
    app.state.agents = ResumeAgents(AgentSettings(_env_file=API_DIR / ".env"))  # type: ignore[call-arg]
    devlog("AGENT", "agents ready", model=app.state.agents.runtime.settings.gemini_model)
    yield
    await client.close()


app = FastAPI(
    title="PatraShilpi API",
    lifespan=lifespan,
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json",
)

register_exception_handlers(app)


@app.middleware("http")
async def log_requests(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """One [API] line per request: method, path, status and time to the first byte."""
    started = time.perf_counter()
    response = await call_next(request)
    if not request.url.path.endswith("/healthcheck"):
        devlog(
            "API",
            f"{request.method} {request.url.path}",
            status=response.status_code,
            took=secs(time.perf_counter() - started),
        )
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
