import { runResultSchema, type RunResult } from "@/lib/schemas";
import { z } from "zod";

const KEY = "rc:run";

const savedSchema = z.object({
  jdText: z.string(),
  result: runResultSchema,
  coverLetter: z.string().nullable(),
});

export interface SavedRun {
  jdText: string;
  result: RunResult;
  coverLetter: string | null;
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
