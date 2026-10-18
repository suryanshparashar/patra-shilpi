import {
  runResultSchema,
  structuredResumeSchema,
  type RunResult,
  type StructuredResume,
  type GuardrailIssue,
} from "@/lib/schemas";
import { z } from "zod";

const KEY = "rc:run";

const savedSchema = z.object({
  jdText: z.string(),
  result: runResultSchema,
  coverLetter: z.string().nullable(),
  // Added later: all optional, so a run saved by an older version still loads.
  letterIssues: z
    .array(z.object({ section: z.string(), claim: z.string(), reason: z.string() }))
    .optional(),
  letterIndex: z.number().nullable().optional(),
  letterChecked: z.boolean().optional(),
  editedResume: structuredResumeSchema.nullable().optional(),
  editedLetter: z.string().nullable().optional(),
});

export interface SavedRun {
  jdText: string;
  result: RunResult;
  coverLetter: string | null;
  letterIssues?: GuardrailIssue[];
  letterIndex?: number | null;
  letterChecked?: boolean;
  /** The user's edits: null means "not edited". */
  editedResume?: StructuredResume | null;
  editedLetter?: string | null;
}

/** Keep the finished result for this tab so a refresh restores it. Storage may be unavailable. */
export function saveRun(run: SavedRun): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(run));
  } catch {
    // private mode or quota exceeded: the run simply won't survive a refresh
  }
}

export function loadRun(): SavedRun | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = savedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function clearRun(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
