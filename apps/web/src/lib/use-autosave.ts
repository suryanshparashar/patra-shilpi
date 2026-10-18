"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { patchHistory } from "@/lib/history-api";
import type { StructuredResume } from "@/lib/schemas";

/** The user's edits, as the page holds them. `null` means "not edited" (the AI's version). */
export interface EditsSnapshot {
  resume: StructuredResume | null;
  /** Edited letter text by the letter's index in the saved run. */
  letters: Record<number, string | null>;
}

/** "local": nothing to save to (guest, or the run isn't in history), edits live in this tab. */
export type SaveStatus = "local" | "saved" | "saving" | "error";

const DELAY_MS = 1000;

/** Save edits to the run's history entry shortly after the user stops typing.
 *
 * Only what differs from the last save is sent. The first snapshot is the baseline, so edits
 * that were already saved (or restored from the tab) are not sent again. `flush` saves at once,
 * e.g. before a download. */
export function useAutosave(runId: string | null, snapshot: EditsSnapshot) {
  const [status, setStatus] = useState<SaveStatus>(runId ? "saved" : "local");
  const saved = useRef<EditsSnapshot>(snapshot);
  const latest = useRef(snapshot);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback(async () => {
    if (!runId) return;
    const target = latest.current;
    const base = saved.current;
    const jobs: Promise<void>[] = [];

    if (JSON.stringify(target.resume) !== JSON.stringify(base.resume)) {
      jobs.push(
        patchHistory(runId, target.resume ? { resume: target.resume } : { reset_resume: true }),
      );
    }
    for (const [key, text] of Object.entries(target.letters)) {
      const index = Number(key);
      if (text === (base.letters[index] ?? null)) continue;
      jobs.push(
        patchHistory(
          runId,
          text === null
            ? { letter_index: index, reset_letter: true }
            : { letter_index: index, letter: text },
        ),
      );
    }
    if (!jobs.length) return;

    setStatus("saving");
    try {
      await Promise.all(jobs);
      saved.current = target;
      setStatus(JSON.stringify(latest.current) === JSON.stringify(target) ? "saved" : "saving");
    } catch {
      setStatus("error");
    }
  }, [runId]);

  useEffect(() => {
    latest.current = snapshot;
    if (!runId) return;
    if (JSON.stringify(snapshot) === JSON.stringify(saved.current)) return;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void send(), DELAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [snapshot, runId, send]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await send();
  }, [send]);

  return { status: runId ? status : ("local" as const), flush, retry: flush };
}
