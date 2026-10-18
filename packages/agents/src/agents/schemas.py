"""Pydantic schemas shared by the agents.

LLM-facing fields carry no defaults on purpose: Gemini's structured output works best when
every key is required (the model writes null for "absent").
"""

from typing import Literal

from pydantic import BaseModel, Field, computed_field

Section = Literal["summary", "skills", "experience", "projects"]
Task = Literal["customize", "cover_letter"]


class JDAnalysis(BaseModel):
    role_title: str
    company: str | None
    seniority: str | None
    domain: str | None
    required_skills: list[str]
    preferred_skills: list[str]
    keywords: list[str] = Field(description="ATS keywords in the JD's exact wording, by importance")
    responsibilities: list[str]


class Contact(BaseModel):
    name: str | None
    email: str | None
    phone: str | None
    location: str | None
    links: list[str]


class ExperienceItem(BaseModel):
    company: str
    title: str
    location: str | None
    start_date: str | None
    end_date: str | None
    bullets: list[str]


class ProjectItem(BaseModel):
    name: str
    description: str | None
    technologies: list[str]
    bullets: list[str]


class EducationItem(BaseModel):
    institution: str
    degree: str | None
    field_of_study: str | None
    start_date: str | None
    end_date: str | None
    details: list[str]


class StructuredResume(BaseModel):
    contact: Contact
    summary: str | None
    skills: list[str]
    experience: list[ExperienceItem]
    projects: list[ProjectItem]
    education: list[EducationItem]
    certifications: list[str]
    additional: list[str] = Field(description="Any other sections, one entry per line/item")


class SkillsSection(BaseModel):
    highlighted: list[str] = Field(
        description="Resume skills relevant to the JD, most relevant first"
    )
    other: list[str] = Field(description="Remaining resume skills")


_SOURCES = (
    "One entry per bullet, in the same order: the 0-based index of the ORIGINAL bullet (in the "
    "same role or project) that this bullet rewrites, or null if it has no single source."
)


class CustomExperienceItem(ExperienceItem):
    bullet_sources: list[int | None] = Field(description=_SOURCES)


class CustomProjectItem(ProjectItem):
    bullet_sources: list[int | None] = Field(description=_SOURCES)


class CustomizedSections(BaseModel):
    """Customizer output. A section the user did not select is null."""

    summary: str | None
    skills: SkillsSection | None
    experience: list[CustomExperienceItem] | None
    projects: list[CustomProjectItem] | None


class BulletProvenance(BaseModel):
    """Where each line of one customized role or project came from in the original resume."""

    original: int | None  # index of the original role/project; None for one the original lacks
    bullets: list[int | None]  # per customized bullet: index of its original bullet, or None


class Provenance(BaseModel):
    experience: list[BulletProvenance] = Field(default_factory=list)
    projects: list[BulletProvenance] = Field(default_factory=list)


class RevertedLine(BaseModel):
    """A flagged line that was put back to the original by default. Locations refer to
    `RunResult.rewritten_resume`, so the user can choose to keep the rewrite instead."""

    section: Literal["summary", "skills", "experience", "projects"]
    item: int | None = None  # role or project index
    bullet: int | None = None  # bullet index within that role or project
    skill: str | None = None  # the added skill, for the skills section
    original: str | None  # what it goes back to; None means the line is removed
    rewrite: str
    reason: str


class GuardrailIssue(BaseModel):
    section: str
    claim: str = Field(description="The offending text, quoted from the customized resume")
    reason: str


class GuardrailReport(BaseModel):
    issues: list[GuardrailIssue]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def passed(self) -> bool:
        return not self.issues


class MissingKeyword(BaseModel):
    keyword: str
    importance: Literal["required", "preferred"]
    suggestion: str = Field(description="Where/how to add it, only if the candidate truly has it")


class KeywordGap(BaseModel):
    missing_keywords: list[MissingKeyword]


class ATSCriterion(BaseModel):
    score: int = Field(ge=0, le=20, description="0, 5, 10, 15 or 20, per the rubric anchors")
    note: str = Field(description="One short sentence justifying the score")


class ATSRubric(BaseModel):
    """The model scores fixed criteria; the total is added up in code, never by the model."""

    standard_sections: ATSCriterion
    keyword_coverage: ATSCriterion
    experience_formatting: ATSCriterion
    impact: ATSCriterion
    clean_content: ATSCriterion
    role_fit: ATSCriterion
    strengths: list[str]
    issues: list[str]


ATS_CRITERIA: dict[str, str] = {
    "standard_sections": "Standard sections",
    "keyword_coverage": "Keyword coverage",
    "experience_formatting": "Experience formatting",
    "impact": "Impact",
    "clean_content": "Clean content",
    "role_fit": "Role fit",
}


class ATSBreakdownItem(BaseModel):
    name: str
    score: int
    max: int = 20


class ATSReport(BaseModel):
    score: int = Field(ge=0, le=100)
    strengths: list[str]
    issues: list[str]
    breakdown: list[ATSBreakdownItem] = Field(default_factory=list)

    @classmethod
    def from_rubric(cls, rubric: ATSRubric) -> "ATSReport":
        breakdown = [
            ATSBreakdownItem(name=label, score=max(0, min(20, getattr(rubric, key).score)))
            for key, label in ATS_CRITERIA.items()
        ]
        return cls(
            # Each criterion is out of 20; the total is rescaled to 100 whatever their number.
            score=round(sum(item.score for item in breakdown) * 100 / (20 * len(breakdown))),
            strengths=rubric.strengths,
            issues=rubric.issues,
            breakdown=breakdown,
        )


class Evaluation(BaseModel):
    """Both checks on the final draft, answered in one model call."""

    keyword_gap: KeywordGap
    ats: ATSRubric


class WorkerError(BaseModel):
    worker: str
    message: str
    code: str | None = None  # e.g. "429 RESOURCE_EXHAUSTED" (see retry.error_code)
