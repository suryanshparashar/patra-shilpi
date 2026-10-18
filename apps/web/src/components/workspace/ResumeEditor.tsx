"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { PlusIcon, XIcon } from "@/components/icons";
import { EditableText, type Tone } from "@/components/workspace/EditableText";
import { degreeLine, setField, type FieldId } from "@/lib/resume-edit";
import type { StructuredResume } from "@/lib/schemas";

/** A note shown under a field: a line that was restored, a rewrite the user kept, or a flag. */
export interface Marker {
  kind: "restored" | "kept" | "flag";
  text: string;
  action?: { label: string; run: () => void };
}

/** Ask the editor to focus a field and select part of it ("Show" on a flag). */
export interface FocusRequest {
  id: FieldId;
  range: { start: number; end: number } | null;
  nonce: number;
}

const CHIP: Record<Marker["kind"], string> = {
  restored: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  kept: "bg-amber-50 text-amber-900 ring-amber-200",
  flag: "bg-amber-50 text-amber-900 ring-amber-300",
};

function toneOf(markers: Marker[] | undefined): Tone {
  if (!markers?.length) return null;
  return markers.some((m) => m.kind === "flag") ? "flag" : markers[0].kind;
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-7 mb-2 border-b border-stone-200 pb-1 text-xs font-semibold tracking-wider text-stone-500 uppercase">
      {children}
    </h3>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
    >
      <PlusIcon className="size-3.5" />
      {children}
    </button>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-6 shrink-0 place-items-center rounded-md text-stone-400 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100"
    >
      <XIcon className="size-3.5" />
    </button>
  );
}

/** The resume as a page you can edit in place. Every change goes straight to `onChange`, and
 * the PDF is built from the result. */
export function ResumeEditor({
  resume,
  onChange,
  highlightedSkills,
  markers,
  focus,
}: {
  resume: StructuredResume;
  onChange: (resume: StructuredResume) => void;
  highlightedSkills: string[];
  markers: Record<FieldId, Marker[]>;
  focus: FocusRequest | null;
}) {
  const page = useRef<HTMLElement | null>(null);
  const matched = new Set(highlightedSkills.map((s) => s.toLowerCase()));

  useEffect(() => {
    if (!focus) return;
    const element = page.current?.querySelector<HTMLTextAreaElement | HTMLInputElement>(
      `[data-field-id="${focus.id}"]`,
    );
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "center", behavior: "smooth" });
    if (focus.range) element.setSelectionRange(focus.range.start, focus.range.end);
  }, [focus]);

  const edit = (id: FieldId, text: string) => onChange(setField(resume, id, text));
  const update = (change: (draft: StructuredResume) => void) => {
    const draft = structuredClone(resume);
    change(draft);
    onChange(draft);
  };

  /** A text field with its markers underneath. */
  function field(
    id: FieldId,
    value: string,
    label: string,
    className = "",
    placeholder = "",
    spell = false,
  ) {
    return (
      <>
        <EditableText
          spellCheck={spell}
          value={value}
          onChange={(text) => edit(id, text)}
          label={label}
          className={className}
          placeholder={placeholder}
          tone={toneOf(markers[id])}
          fieldId={id}
        />
        <Markers items={markers[id]} />
      </>
    );
  }

  /** One editable line of a list, with a remove button. Enter adds a new line after it. */
  function row(
    id: FieldId,
    value: string,
    label: string,
    remove: () => void,
    addAfter: () => void,
    mark = "•",
  ) {
    return (
      <li key={id} className="group flex items-start gap-2">
        <span className="mt-0.5 w-3 shrink-0 text-stone-400" aria-hidden>
          {mark}
        </span>
        <div className="min-w-0 flex-1">
          <EditableText
            value={value}
            onChange={(text) => edit(id, text)}
            label={label}
            onEnter={addAfter}
            spellCheck
            tone={toneOf(markers[id])}
            fieldId={id}
          />
          <Markers items={markers[id]} />
        </div>
        <RemoveButton label={`Remove ${label}`} onClick={remove} />
      </li>
    );
  }

  const { contact } = resume;

  return (
    <article
      ref={page}
      className="min-w-0 rounded-2xl bg-white p-6 text-sm leading-relaxed wrap-anywhere text-stone-800 shadow-sm ring-1 ring-stone-200 sm:p-10"
    >
      {field(
        "name",
        contact.name ?? "",
        "Name",
        "text-2xl font-semibold text-stone-900",
        "Your name",
      )}
      <div className="mt-2 grid gap-x-4 gap-y-1 text-xs text-stone-600 sm:grid-cols-3">
        {field("email", contact.email ?? "", "Email", "", "Email")}
        {field("phone", contact.phone ?? "", "Phone", "", "Phone")}
        {field("location", contact.location ?? "", "Location", "", "Location")}
      </div>
      {contact.links.length ? (
        <ul className="mt-1 space-y-0.5 text-xs text-stone-600">
          {contact.links.map((link, i) => (
            <li key={`link-${i}`} className="group flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <EditableText
                  spellCheck={false}
                  value={link}
                  onChange={(text) => edit(`link:${i}`, text)}
                  label={`Link ${i + 1}`}
                />
              </div>
              <RemoveButton
                label={`Remove link ${i + 1}`}
                onClick={() => update((d) => void d.contact.links.splice(i, 1))}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <Heading>Summary</Heading>
      {resume.summary !== null ? (
        field("summary", resume.summary, "Summary", "", "Write a short summary", true)
      ) : (
        <AddButton onClick={() => update((d) => void (d.summary = ""))}>Add a summary</AddButton>
      )}

      <Heading>Skills</Heading>
      <ul className="flex flex-wrap gap-1.5">
        {resume.skills.map((skill, i) => (
          <li
            key={`skill-${i}`}
            className={`group inline-flex items-center gap-1 rounded-md py-0.5 pr-0.5 pl-2 text-xs ring-1 ${
              matched.has(skill.toLowerCase())
                ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                : "bg-stone-50 text-stone-700 ring-stone-200"
            } ${markers[`skill:${i}`] ? "ring-2 ring-amber-300" : ""}`}
          >
            <input
              value={skill}
              aria-label={`Skill ${i + 1}`}
              spellCheck={false}
              onChange={(event) => edit(`skill:${i}`, event.target.value)}
              size={Math.max(3, skill.length)}
              data-field-id={`skill:${i}`}
              className="min-w-0 bg-transparent outline-none focus:ring-0"
            />
            <RemoveButton
              label={`Remove skill ${skill}`}
              onClick={() => update((d) => void d.skills.splice(i, 1))}
            />
          </li>
        ))}
      </ul>
      {resume.skills.some((_, i) => markers[`skill:${i}`]) ? (
        <div className="mt-1.5 space-y-1">
          {resume.skills
            .flatMap((_, i) => markers[`skill:${i}`] ?? [])
            .map((m, i) => (
              <Markers key={i} items={[m]} />
            ))}
        </div>
      ) : null}
      <AddButton
        onClick={() =>
          update((d) => {
            d.skills.push("");
          })
        }
      >
        Add a skill
      </AddButton>

      {resume.experience.length ? <Heading>Experience</Heading> : null}
      <div className="space-y-5">
        {resume.experience.map((job, i) => (
          <section key={`exp-${i}`}>
            <div className="grid gap-x-4 sm:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                {field(
                  `exp:${i}:title`,
                  job.title,
                  `Role ${i + 1} title`,
                  "font-semibold text-stone-900",
                )}
                {field(`exp:${i}:company`, job.company, `Role ${i + 1} company`, "text-stone-700")}
              </div>
              <div className="flex items-start gap-1 text-xs text-stone-500">
                <div className="w-24">
                  <EditableText
                    spellCheck={false}
                    value={job.start_date ?? ""}
                    onChange={(t) => edit(`exp:${i}:start`, t)}
                    label={`Role ${i + 1} start date`}
                    placeholder="Start"
                    className="text-right"
                  />
                </div>
                <span className="py-0.5">–</span>
                <div className="w-24">
                  <EditableText
                    spellCheck={false}
                    value={job.end_date ?? ""}
                    onChange={(t) => edit(`exp:${i}:end`, t)}
                    label={`Role ${i + 1} end date`}
                    placeholder="End"
                  />
                </div>
              </div>
            </div>
            <ul className="mt-1 space-y-1">
              {job.bullets.map((bullet, j) =>
                row(
                  `exp:${i}:b:${j}`,
                  bullet,
                  `Experience ${i + 1}, bullet ${j + 1}`,
                  () => update((d) => void d.experience[i].bullets.splice(j, 1)),
                  () => update((d) => void d.experience[i].bullets.splice(j + 1, 0, "")),
                ),
              )}
            </ul>
            <AddButton onClick={() => update((d) => void d.experience[i].bullets.push(""))}>
              Add a bullet
            </AddButton>
          </section>
        ))}
      </div>

      {resume.projects.length ? <Heading>Projects</Heading> : null}
      <div className="space-y-5">
        {resume.projects.map((project, i) => (
          <section key={`proj-${i}`}>
            {field(
              `proj:${i}:name`,
              project.name,
              `Project ${i + 1} name`,
              "font-semibold text-stone-900",
            )}
            <TechnologiesInput
              value={project.technologies}
              onChange={(technologies) =>
                update((d) => void (d.projects[i].technologies = technologies))
              }
              label={`Project ${i + 1} technologies`}
            />
            {project.description !== null
              ? field(
                  `proj:${i}:desc`,
                  project.description,
                  `Project ${i + 1} description`,
                  "",
                  "",
                  true,
                )
              : null}
            <ul className="mt-1 space-y-1">
              {project.bullets.map((bullet, j) =>
                row(
                  `proj:${i}:b:${j}`,
                  bullet,
                  `Project ${i + 1}, bullet ${j + 1}`,
                  () => update((d) => void d.projects[i].bullets.splice(j, 1)),
                  () => update((d) => void d.projects[i].bullets.splice(j + 1, 0, "")),
                ),
              )}
            </ul>
            <AddButton onClick={() => update((d) => void d.projects[i].bullets.push(""))}>
              Add a bullet
            </AddButton>
          </section>
        ))}
      </div>

      {resume.education.length ? <Heading>Education</Heading> : null}
      <div className="space-y-4">
        {resume.education.map((edu, i) => (
          <section key={`edu-${i}`}>
            <div className="grid gap-x-4 sm:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <EditableText
                  spellCheck={false}
                  value={edu.institution}
                  onChange={(t) => edit(`edu:${i}:institution`, t)}
                  label={`Education ${i + 1} institution`}
                  className="font-semibold text-stone-900"
                />
                <EditableText
                  spellCheck={false}
                  value={degreeLine(edu.degree, edu.field_of_study)}
                  onChange={(t) => edit(`edu:${i}:degreeline`, t)}
                  label={`Education ${i + 1} degree`}
                  placeholder="Degree, e.g. B.Tech in Computer Science"
                  className="text-stone-700"
                />
              </div>
              <div className="flex items-start gap-1 text-xs text-stone-500">
                <div className="w-24">
                  <EditableText
                    spellCheck={false}
                    value={edu.start_date ?? ""}
                    onChange={(t) => edit(`edu:${i}:start`, t)}
                    label={`Education ${i + 1} start date`}
                    placeholder="Start"
                    className="text-right"
                  />
                </div>
                <span className="py-0.5">–</span>
                <div className="w-24">
                  <EditableText
                    spellCheck={false}
                    value={edu.end_date ?? ""}
                    onChange={(t) => edit(`edu:${i}:end`, t)}
                    label={`Education ${i + 1} end date`}
                    placeholder="End"
                  />
                </div>
              </div>
            </div>
            <ul className="mt-1 space-y-1">
              {edu.details.map((detail, j) =>
                row(
                  `edu:${i}:d:${j}`,
                  detail,
                  `Education ${i + 1}, detail ${j + 1}`,
                  () => update((d) => void d.education[i].details.splice(j, 1)),
                  () => update((d) => void d.education[i].details.splice(j + 1, 0, "")),
                ),
              )}
            </ul>
          </section>
        ))}
      </div>

      {resume.certifications.length ? (
        <>
          <Heading>Certifications</Heading>
          <ul className="space-y-1">
            {resume.certifications.map((cert, i) =>
              row(
                `cert:${i}`,
                cert,
                `Certification ${i + 1}`,
                () => update((d) => void d.certifications.splice(i, 1)),
                () => update((d) => void d.certifications.splice(i + 1, 0, "")),
              ),
            )}
          </ul>
        </>
      ) : null}

      {resume.additional.length ? (
        <>
          <Heading>Additional</Heading>
          <ul className="space-y-1">
            {resume.additional.map((line, i) =>
              row(
                `add:${i}`,
                line,
                `Additional line ${i + 1}`,
                () => update((d) => void d.additional.splice(i, 1)),
                () => update((d) => void d.additional.splice(i + 1, 0, "")),
                "",
              ),
            )}
          </ul>
        </>
      ) : null}
    </article>
  );
}

const splitList = (text: string): string[] =>
  text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

/** A comma-separated list. It keeps its own text while you type, so "a, " keeps its comma and
 * space; the list is rebuilt from it on every change. */
function TechnologiesInput({
  value,
  onChange,
  label,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  label: string;
}) {
  const [text, setText] = useState(value.join(", "));
  const [seen, setSeen] = useState(value);
  // Changed from outside (a reset): show the new list instead of the stale text.
  if (seen !== value) {
    setSeen(value);
    if (JSON.stringify(splitList(text)) !== JSON.stringify(value)) setText(value.join(", "));
  }
  return (
    <EditableText
      spellCheck={false}
      value={text}
      onChange={(next) => {
        setText(next);
        onChange(splitList(next));
      }}
      label={label}
      placeholder="Technologies, separated by commas"
      className="text-xs text-stone-500"
    />
  );
}

function Markers({ items }: { items: Marker[] | undefined }) {
  if (!items?.length) return null;
  return (
    <div className="mt-1 mb-1.5 space-y-1">
      {items.map((marker, i) => (
        <p
          key={i}
          className={`inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-2 py-1 text-xs ring-1 ${CHIP[marker.kind]}`}
        >
          <span className="wrap-anywhere">{marker.text}</span>
          {marker.action ? (
            <button
              type="button"
              onClick={marker.action.run}
              className="font-semibold underline underline-offset-2 hover:no-underline"
            >
              {marker.action.label}
            </button>
          ) : null}
        </p>
      ))}
    </div>
  );
}
