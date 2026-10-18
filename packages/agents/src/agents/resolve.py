"""Put lines the fact-check still flags back to the original, by default (no model call).

"Never a fact invented" has to hold for what the user downloads, not just for what we warn
about. So after the last fact-check every flagged line is located in the draft and reverted:

- summary: back to the original summary (removed if the original had none);
- an experience or project bullet: back to the original bullet it was rewritten from (its
  provenance), or removed if it had no source;
- skills: a skill the original doesn't list is removed.

Each revert is returned as a `RevertedLine`, located in the rewritten draft, so the user can
choose to keep the rewrite. A flag that can't be located is returned unchanged as a warning.
"""

import re
from collections.abc import Sequence

from agents.schemas import (
    BulletProvenance,
    ExperienceItem,
    GuardrailIssue,
    ProjectItem,
    Provenance,
    RevertedLine,
    StructuredResume,
)

Items = Sequence[ExperienceItem | ProjectItem]  # roles or projects: both have `bullets`


def _items(resume: StructuredResume, section: str) -> Items:
    return resume.experience if section == "experience" else resume.projects


# A claim counts as found in a line when this share of its words appear in that line.
MIN_OVERLAP = 0.6

_WORD = re.compile(r"[a-z0-9+#.%$]+")


def _norm(text: str) -> str:
    return " ".join(_WORD.findall(text.casefold()))


def _words(text: str) -> set[str]:
    return set(_WORD.findall(text.casefold()))


def _match(claim: str, line: str) -> float:
    """1.0 when one contains the other, else the share of the claim's words in the line."""
    c, n = _norm(claim), _norm(line)
    if not c or not n:
        return 0.0
    if c in n or n in c:
        return 1.0
    words = _words(claim)
    return len(words & _words(line)) / len(words) if words else 0.0


def _original_bullet(
    original: StructuredResume, section: str, source: BulletProvenance | None, bullet: int
) -> str | None:
    if source is None or source.original is None or bullet >= len(source.bullets):
        return None
    index = source.bullets[bullet]
    if index is None:
        return None
    items = _items(original, section)
    if source.original >= len(items) or index >= len(items[source.original].bullets):
        return None
    return items[source.original].bullets[index]


def _section(raw: str) -> str:
    """The guardrail's free-text section ("Experience - Acme") as a section name, or ""."""
    text = raw.casefold()
    for name, stem in (
        ("summary", "summary"),
        ("skills", "skill"),
        ("experience", "experience"),
        ("projects", "project"),
    ):
        if stem in text:
            return name
    return ""


def _locate(
    issue: GuardrailIssue,
    original: StructuredResume,
    draft: StructuredResume,
    provenance: Provenance,
) -> list[RevertedLine]:
    """The reverts that settle one flag; empty if the flagged text can't be found.

    The flag's own section is searched first, then the whole draft (the section label is a
    model's guess and is sometimes wrong).
    """
    section = _section(issue.section)
    found = _locate_in(issue, section, original, draft, provenance)
    if not found and section and section != "skills":
        found = _locate_in(issue, "", original, draft, provenance)
    return found


def _locate_in(
    issue: GuardrailIssue,
    section: str,
    original: StructuredResume,
    draft: StructuredResume,
    provenance: Provenance,
) -> list[RevertedLine]:
    if section == "skills":
        known = {_norm(s) for s in original.skills}
        claim = _norm(issue.claim)
        added = [s for s in draft.skills if _norm(s) not in known and _norm(s) in claim]
        return [
            RevertedLine(section="skills", skill=s, original=None, rewrite=s, reason=issue.reason)
            for s in added
        ]

    # Candidate lines: (score, revert) for the summary and every bullet.
    candidates: list[tuple[float, RevertedLine]] = []
    if draft.summary and section in ("summary", ""):
        candidates.append(
            (
                _match(issue.claim, draft.summary),
                RevertedLine(
                    section="summary",
                    original=original.summary,
                    rewrite=draft.summary,
                    reason=issue.reason,
                ),
            )
        )
    for name, sources in (
        ("experience", provenance.experience),
        ("projects", provenance.projects),
    ):
        if section not in (name, ""):
            continue
        for i, item in enumerate(_items(draft, name)):
            source = sources[i] if i < len(sources) else None
            for j, text in enumerate(item.bullets):
                candidates.append(
                    (
                        _match(issue.claim, text),
                        RevertedLine(
                            section=name,  # type: ignore[arg-type]
                            item=i,
                            bullet=j,
                            original=_original_bullet(original, name, source, j),
                            rewrite=text,
                            reason=issue.reason,
                        ),
                    )
                )

    if not candidates:
        return []
    score, best = max(candidates, key=lambda pair: pair[0])
    if score < MIN_OVERLAP:
        return []
    # A line the original already says word for word is not an invention: nothing to revert.
    if best.original is not None and _norm(best.original) == _norm(best.rewrite):
        return []
    return [best]


def apply_reverts(draft: StructuredResume, reverted: list[RevertedLine]) -> StructuredResume:
    """The draft with the given reverts applied. Removals are done last, so indices hold."""
    resume = draft.model_copy(deep=True)
    removed_skills = {line.skill.casefold() for line in reverted if line.skill}
    removed_bullets: set[tuple[str, int, int]] = set()

    for line in reverted:
        if line.section == "summary":
            resume.summary = line.original
        elif line.section in ("experience", "projects") and line.item is not None:
            items = _items(resume, line.section)
            if line.item >= len(items) or line.bullet is None:
                continue
            if line.bullet >= len(items[line.item].bullets):
                continue
            if line.original is None:
                removed_bullets.add((line.section, line.item, line.bullet))
            else:
                items[line.item].bullets[line.bullet] = line.original

    for name in ("experience", "projects"):
        for i, item in enumerate(_items(resume, name)):
            item.bullets = [
                b for j, b in enumerate(item.bullets) if (name, i, j) not in removed_bullets
            ]
    resume.skills = [s for s in resume.skills if s.casefold() not in removed_skills]
    return resume


def resolve_flags(
    original: StructuredResume,
    draft: StructuredResume,
    provenance: Provenance,
    issues: list[GuardrailIssue],
) -> tuple[StructuredResume, list[RevertedLine], list[GuardrailIssue]]:
    """Revert every locatable flag. Returns (resume, reverts, flags that could not be located)."""
    reverted: list[RevertedLine] = []
    unlocated: list[GuardrailIssue] = []
    seen: set[tuple[str, int | None, int | None, str | None]] = set()
    for issue in issues:
        lines = _locate(issue, original, draft, provenance)
        if not lines:
            unlocated.append(issue)
        for line in lines:
            key = (line.section, line.item, line.bullet, line.skill)
            if key not in seen:  # two flags on the same line revert it once
                seen.add(key)
                reverted.append(line)
    return apply_reverts(draft, reverted), reverted, unlocated
