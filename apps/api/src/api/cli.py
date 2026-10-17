from pathlib import Path

import uvicorn

REPO_ROOT = Path(__file__).resolve().parents[4]


def dev() -> None:
    """Run the API with auto-reload, watching the api app and the shared packages."""
    uvicorn.run(
        "api.main:app",
        port=8000,
        reload=True,
        reload_dirs=[str(REPO_ROOT / "apps" / "api" / "src"), str(REPO_ROOT / "packages")],
    )
