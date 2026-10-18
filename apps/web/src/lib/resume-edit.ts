import { findPhrase } from "@/lib/highlight";
import type { GuardrailIssue, RevertedLine, StructuredResume } from "@/lib/schemas";

/** Pure helpers for editing a structured resume in place. Nothing here mutates its input. */

/** Every editable text of a resume has an id, e.g. "summary", "skill:2", "exp:0:b:1". */
export type FieldId = string;

export interface Field {
  id: FieldId;
  text: string;
}

const clone = (resume: StructuredResume): StructuredResume => structuredClone(resume);
const norm = (text: string): string => text.replace(/\s+/g, " ").trim().toLowerCase();
const same = (a: string | null | undefined, b: string | null | undefined): boolean =>
  norm(a ?? "") === norm(b ?? "");

/** Every text field of the resume, in reading order. */
export function fieldsOf(resume: StructuredResume): Field[] {
  const out: Field[] = [];
  const add = (id: FieldId, text: string | null | undefined) => {
    if (text) out.push({ id, text });
  };
  const { contact } = resume;
  add("name", contact.name);
  add("email", contact.email);
  add("phone", contact.phone);
  add("location", contact.location);
  contact.links.forEach((link, i) => add(`link:${i}`, link));
  add("summary", resume.summary);
  resume.skills.forEach((skill, i) => add(`skill:${i}`, skill));
  resume.experience.forEach((job, i) => {
    add(`exp:${i}:title`, job.title);
    add(`exp:${i}:company`, job.company);
    job.bullets.forEach((b, j) => add(`exp:${i}:b:${j}`, b));
  });
  resume.projects.forEach((project, i) => {
    add(`proj:${i}:name`, project.name);
    add(`proj:${i}:desc`, project.description);
    project.bullets.forEach((b, j) => add(`proj:${i}:b:${j}`, b));
  });
  resume.education.forEach((edu, i) => {
    edu.details.forEach((d, j) => add(`edu:${i}:d:${j}`, d));
  });
  resume.certifications.forEach((c, i) => add(`cert:${i}`, c));
  resume.additional.forEach((a, i) => add(`add:${i}`, a));
  return out;
}

const orNull = (text: string): string | null => (text.trim() ? text : null);

/** The resume with one field changed. Unknown ids leave it as it was. */
export function setField(resume: StructuredResume, id: FieldId, text: string): StructuredResume {
  const next = clone(resume);
  const parts = id.split(":");
  const index = Number(parts[1]);
  const sub = Number(parts[3]);
  switch (parts[0]) {
    case "name":
      next.contact.name = orNull(text);
      break;
    case "email":
      next.contact.email = orNull(text);
      break;
    case "phone":
      next.contact.phone = orNull(text);
      break;
    case "location":
      next.contact.location = orNull(text);
      break;
    case "link":
      next.contact.links[index] = text;
      break;
    case "summary":
      next.summary = text; // kept even when empty, so clearing it doesn't remove the section
      break;
    case "skill":
      next.skills[index] = text;
      break;
    case "exp": {
      const job = next.experience[index];
      if (!job) break;
      if (parts[2] === "b") job.bullets[sub] = text;
      else if (parts[2] === "title") job.title = text;
      else if (parts[2] === "company") job.company = text;
      else if (parts[2] === "location") job.location = orNull(text);
      else if (parts[2] === "start") job.start_date = orNull(text);
      else if (parts[2] === "end") job.end_date = orNull(text);
      break;
    }
    case "proj": {
      const project = next.projects[index];
      if (!project) break;
      if (parts[2] === "b") project.bullets[sub] = text;
      else if (parts[2] === "name") project.name = text;
      else if (parts[2] === "desc") project.description = orNull(text);
      else if (parts[2] === "tech") {
        project.technologies = text
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }
      break;
    }
    case "edu": {
      const edu = next.education[index];
      if (!edu) break;
      if (parts[2] === "d") edu.details[sub] = text;
      else if (parts[2] === "institution") edu.institution = text;
      else if (parts[2] === "degree") edu.degree = orNull(text);
      else if (parts[2] === "degreeline") {
        // One line, "Degree in Field": the first " in " splits it.
        const split = /^(.*?)\s+in\s+(.+)$/i.exec(text);
        edu.degree = orNull(split ? split[1] : text);
        edu.field_of_study = split ? split[2] : null;
      } else if (parts[2] === "field") edu.field_of_study = orNull(text);
      else if (parts[2] === "start") edu.start_date = orNull(text);
      else if (parts[2] === "end") edu.end_date = orNull(text);
      break;
    }
    case "cert":
      next.certifications[index] = text;
      break;
    case "add":
      next.additional[index] = text;
      break;
  }
  return next;
}

/** The resume without empty entries (blank bullets, skills and lines), for the PDF. */
export function cleanResume(resume: StructuredResume): StructuredResume {
  const next = clone(resume);
  const keep = (items: string[]) => items.map((s) => s.trim()).filter(Boolean);
  next.skills = keep(next.skills);
  next.certifications = keep(next.certifications);
  next.additional = keep(next.additional);
  next.contact.links = keep(next.contact.links);
  next.experience.forEach((job) => (job.bullets = keep(job.bullets)));
  next.projects.forEach((project) => (project.bullets = keep(project.bullets)));
  next.education.forEach((edu) => (edu.details = keep(edu.details)));
  return next;
}

// --- where a flag points ---------------------------------------------------------------------

export interface Located {
  id: FieldId;
  /** The flagged phrase inside the field, when it was found word for word. */
  range: { start: number; end: number } | null;
}

const words = (text: string): Set<string> => new Set(norm(text).match(/[a-z0-9+#.%$]+/g) ?? []);

/** Which field a fact-check flag is about: the field containing the quoted text, or failing
 * that the one sharing most of its words. Null once the text has been edited away. */
export function locateClaim(resume: StructuredResume, issue: GuardrailIssue): Located | null {
  const fields = fieldsOf(resume);
  for (const field of fields) {
    const range = findPhrase(field.text, issue.claim);
    if (range) return { id: field.id, range };
  }
  const claim = words(issue.claim);
  if (claim.size < 3) return null;
  let best: { id: FieldId; score: number } | null = null;
  for (const field of fields) {
    if (!/^(summary|exp:\d+:b:|proj:\d+:b:)/.test(field.id)) continue;
    const have = words(field.text);
    const score = [...claim].filter((w) => have.has(w)).length / claim.size;
    if (score >= 0.6 && (!best || score > best.score)) best = { id: field.id, score };
  }
  return best ? { id: best.id, range: null } : null;
}

// --- restored lines: choose the rewrite or the original ---------------------------------------

type Listed = { bullets: string[] };

function items(resume: StructuredResume, line: RevertedLine): Listed[] {
  return line.section === "experience" ? resume.experience : resume.projects;
}

/** True if the resume currently contains the rewrite for this restored line. */
export function isUsingRewrite(resume: StructuredResume, line: RevertedLine): boolean {
  if (line.section === "summary") return same(resume.summary, line.rewrite);
  if (line.section === "skills") return resume.skills.some((s) => same(s, line.skill));
  const item = line.item != null ? items(resume, line)[line.item] : undefined;
  return !!item?.bullets.some((b) => same(b, line.rewrite));
}

/** Switch one restored line to the AI's rewrite, wherever it now sits in the edited resume. */
export function keepRewrite(resume: StructuredResume, line: RevertedLine): StructuredResume {
  const next = clone(resume);
  if (line.section === "summary") {
    next.summary = line.rewrite;
  } else if (line.section === "skills") {
    if (line.skill && !next.skills.some((s) => same(s, line.skill))) next.skills.push(line.skill);
  } else if (line.item != null) {
    const item = items(next, line)[line.item];
    if (!item) return next;
    const at = line.original ? item.bullets.findIndex((b) => same(b, line.original)) : -1;
    if (at >= 0) item.bullets[at] = line.rewrite;
    else
      item.bullets.splice(
        Math.min(line.bullet ?? item.bullets.length, item.bullets.length),
        0,
        line.rewrite,
      );
  }
  return next;
}

/** Switch one restored line back to the user's original wording (or remove it if it had none). */
export function keepOriginal(resume: StructuredResume, line: RevertedLine): StructuredResume {
  const next = clone(resume);
  if (line.section === "summary") {
    next.summary = line.original;
  } else if (line.section === "skills") {
    next.skills = next.skills.filter((s) => !same(s, line.skill));
  } else if (line.item != null) {
    const item = items(next, line)[line.item];
    if (!item) return next;
    const at = item.bullets.findIndex((b) => same(b, line.rewrite));
    if (at < 0) return next;
    if (line.original) item.bullets[at] = line.original;
    else item.bullets.splice(at, 1);
  }
  return next;
}

/** The field a restored line currently occupies in the resume, if it has one. */
export function restoredFieldId(resume: StructuredResume, line: RevertedLine): FieldId | null {
  if (line.section === "summary") return resume.summary ? "summary" : null;
  if (line.section === "skills") {
    const at = resume.skills.findIndex((s) => same(s, line.skill));
    return at >= 0 ? `skill:${at}` : null;
  }
  if (line.item == null) return null;
  const item = items(resume, line)[line.item];
  if (!item) return null;
  const prefix = line.section === "experience" ? "exp" : "proj";
  const using = isUsingRewrite(resume, line);
  const text = using ? line.rewrite : line.original;
  const at = text ? item.bullets.findIndex((b) => same(b, text)) : -1;
  return at >= 0 ? `${prefix}:${line.item}:b:${at}` : null;
}

/** The degree as one line, "B.Tech in Computer Science": what the education editor shows. */
export function degreeLine(degree: string | null, field: string | null): string {
  return [degree, field].filter(Boolean).join(" in ");
}

/** How many lines the user changed from the AI's version: changed lines, added ones and removed
 * ones, each counted once (a line rewritten counts as one change, not two). */
export function editedLineCount(ai: StructuredResume, current: StructuredResume): number {
  const tally = (resume: StructuredResume) => {
    const counts = new Map<string, number>();
    for (const { text } of fieldsOf(resume)) {
      const key = norm(text);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  };
  const before = tally(ai);
  const after = tally(current);
  const surplus = (a: Map<string, number>, b: Map<string, number>) => {
    let total = 0;
    for (const [key, count] of a) total += Math.max(0, count - (b.get(key) ?? 0));
    return total;
  };
  return Math.max(surplus(after, before), surplus(before, after));
}
