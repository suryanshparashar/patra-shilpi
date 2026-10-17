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


class CustomizedSections(BaseModel):
    """Customizer output. A section the user did not select is null."""

    summary: str | None
    skills: SkillsSection | None
    experience: list[ExperienceItem] | None
    projects: list[ProjectItem] | None


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


class ATSReport(BaseModel):
    score: int = Field(ge=0, le=100)
    strengths: list[str]
    issues: list[str]


class Evaluation(BaseModel):
    """Both checks on the final draft, answered in one model call."""

    keyword_gap: KeywordGap
    ats: ATSReport


class WorkerError(BaseModel):
    worker: str
    message: str
    code: str | None = None  # e.g. "429 RESOURCE_EXHAUSTED" (see retry.error_code)
