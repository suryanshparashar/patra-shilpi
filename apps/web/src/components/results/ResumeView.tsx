import type { StructuredResume } from "@/lib/schemas";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="border-b border-stone-200 pb-1 text-xs font-semibold tracking-wider text-stone-500 uppercase">
        {title}
      </h3>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-stone-700 marker:text-stone-400">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function dates(start: string | null, end: string | null): string {
  return [start, end].filter(Boolean).join(" – ");
}

/** A readable, paper-like rendering of a structured resume. Skills the customizer matched to
 * the job are marked in emerald. */
export function ResumeView({
  resume,
  highlightedSkills = [],
}: {
  resume: StructuredResume;
  highlightedSkills?: string[];
}) {
  const { contact } = resume;
  const highlighted = new Set(highlightedSkills.map((s) => s.toLowerCase()));
  const contactLine = [contact.email, contact.phone, contact.location, ...contact.links].filter(
    Boolean,
  );

  return (
    // wrap-anywhere: one very long token (a URL, or a line whose spaces were lost) wraps inside
    // the card instead of overflowing it.
    <article className="min-w-0 text-sm leading-relaxed wrap-anywhere text-stone-800">
      {contact.name ? (
        <h2 className="text-xl font-semibold text-stone-900">{contact.name}</h2>
      ) : null}
      {contactLine.length ? (
        <p className="mt-0.5 text-xs break-words text-stone-500">{contactLine.join("  ·  ")}</p>
      ) : null}

      {resume.summary ? (
        <Section title="Summary">
          <p>{resume.summary}</p>
        </Section>
      ) : null}

      {resume.skills.length ? (
        <Section title="Skills">
          <ul className="flex flex-wrap gap-1.5">
            {resume.skills.map((skill, i) => (
              <li
                key={`${skill}-${i}`}
                className={`rounded-md px-2 py-0.5 text-xs ${
                  highlighted.has(skill.toLowerCase())
                    ? "bg-emerald-100 font-medium text-emerald-800"
                    : "bg-stone-100 text-stone-700"
                }`}
              >
                {skill}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {resume.experience.length ? (
        <Section title="Experience">
          {resume.experience.map((job, i) => (
            <div key={i}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="font-medium text-stone-900">
                  {job.title}
                  <span className="font-normal text-stone-600"> · {job.company}</span>
                </p>
                <p className="text-xs text-stone-500">{dates(job.start_date, job.end_date)}</p>
              </div>
              {job.location ? <p className="text-xs text-stone-500">{job.location}</p> : null}
              <Bullets items={job.bullets} />
            </div>
          ))}
        </Section>
      ) : null}

      {resume.projects.length ? (
        <Section title="Projects">
          {resume.projects.map((project, i) => (
            <div key={i}>
              <p className="font-medium text-stone-900">{project.name}</p>
              {project.technologies.length ? (
                <p className="text-xs text-stone-500">{project.technologies.join(", ")}</p>
              ) : null}
              {project.description ? <p className="mt-0.5">{project.description}</p> : null}
              <Bullets items={project.bullets} />
            </div>
          ))}
        </Section>
      ) : null}

      {resume.education.length ? (
        <Section title="Education">
          {resume.education.map((edu, i) => (
            <div key={i}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="font-medium text-stone-900">
                  {[edu.degree, edu.field_of_study].filter(Boolean).join(" in ") || edu.institution}
                  {edu.degree || edu.field_of_study ? (
                    <span className="font-normal text-stone-600"> · {edu.institution}</span>
                  ) : null}
                </p>
                <p className="text-xs text-stone-500">{dates(edu.start_date, edu.end_date)}</p>
              </div>
              <Bullets items={edu.details} />
            </div>
          ))}
        </Section>
      ) : null}

      {resume.certifications.length ? (
        <Section title="Certifications">
          <Bullets items={resume.certifications} />
        </Section>
      ) : null}

      {resume.additional.length ? (
        <Section title="Additional">
          {resume.additional.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </Section>
      ) : null}
    </article>
  );
}
