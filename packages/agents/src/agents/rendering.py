from agents.schemas import StructuredResume


def resume_to_text(resume: StructuredResume) -> str:
    """Render a structured resume as plain text (for embeddings, ATS checks and prompts)."""
    lines: list[str] = []
    c = resume.contact
    header = [c.name, c.email, c.phone, c.location, *c.links]
    lines.append(" | ".join(p for p in header if p))

    if resume.summary:
        lines += ["", "SUMMARY", resume.summary]
    if resume.skills:
        lines += ["", "SKILLS", ", ".join(resume.skills)]
    if resume.experience:
        lines += ["", "EXPERIENCE"]
        for job in resume.experience:
            dates = " - ".join(d for d in (job.start_date, job.end_date) if d)
            lines.append(", ".join(p for p in (job.title, job.company, job.location, dates) if p))
            lines += [f"- {b}" for b in job.bullets]
    if resume.projects:
        lines += ["", "PROJECTS"]
        for project in resume.projects:
            lines.append(
                project.name
                + (f" ({', '.join(project.technologies)})" if project.technologies else "")
            )
            if project.description:
                lines.append(project.description)
            lines += [f"- {b}" for b in project.bullets]
    if resume.education:
        lines += ["", "EDUCATION"]
        for edu in resume.education:
            dates = " - ".join(d for d in (edu.start_date, edu.end_date) if d)
            degree = " in ".join(p for p in (edu.degree, edu.field_of_study) if p)
            lines.append(", ".join(p for p in (degree, edu.institution, dates) if p))
            lines += [f"- {d}" for d in edu.details]
    if resume.certifications:
        lines += ["", "CERTIFICATIONS", *[f"- {c}" for c in resume.certifications]]
    if resume.additional:
        lines += ["", "ADDITIONAL", *resume.additional]
    return "\n".join(lines).strip()
