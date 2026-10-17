from functools import cache
from pathlib import Path

PROMPTS_DIR = Path(__file__).parent / "prompts"


@cache
def load_prompt(name: str) -> str:
    """Load a versioned system prompt from `agents/prompts/<name>.md`."""
    return (PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8").strip()
