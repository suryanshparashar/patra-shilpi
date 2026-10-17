"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { streamCoverLetter, streamCustomize, streamRerun } from "@/lib/api";
import { getFingerprint } from "@/lib/fingerprint";
import { ApiError } from "@/lib/http";
import {
  SECTIONS,
  type CustomizeInput,
  type RunResult,
  type Section,
  type StreamEvent,
} from "@/lib/schemas";
import { clearRun, loadRun, saveRun } from "@/lib/session";
import { devlog, seconds } from "@/lib/devlog";
import { applyProgress, finalizeSteps, initSteps, type Step } from "@/lib/steps";

export interface Draft {
  jdText: string;
  sections: Section[];
  file: File | null;
}

export interface ErrorInfo {
  code: string;
  message: string;
  /** The LLM provider's error code, e.g. "429 RESOURCE_EXHAUSTED", when a step failed. */
  detail?: string | null;
}

export interface RunState {
  status: "idle" | "running" | "done" | "error";
  steps: Step[];
  result: RunResult | null;
  error: ErrorInfo | null;
  jdText: string;
}

export interface CoverLetterState {
  status: "idle" | "running" | "done" | "error";
  text: string;
  error: ErrorInfo | null;
}

interface RunContextValue {
  /** False until sessionStorage has been checked, so pages don't redirect too early. */
  hydrated: boolean;
  draft: Draft;
  updateDraft: (patch: Partial<Draft>) => void;
  run: RunState;
  startRun: (input: CustomizeInput) => Promise<void>;
  /** Run a saved history entry again with different sections. */
  startRerun: (runId: string, jdText: string, sections: Section[]) => Promise<void>;
  resetRun: () => void;
  coverLetter: CoverLetterState;
  generateCoverLetter: () => Promise<void>;
}

const INITIAL_DRAFT: Draft = { jdText: "", sections: [...SECTIONS], file: null };
const IDLE_RUN: RunState = { status: "idle", steps: [], result: null, error: null, jdText: "" };
const IDLE_COVER_LETTER: CoverLetterState = { status: "idle", text: "", error: null };

const RunContext = createContext<RunContextValue | null>(null);

function toErrorInfo(error: unknown): ErrorInfo {
  if (error instanceof ApiError) {
    return { code: error.code, message: error.message, detail: error.detail };
  }
  return { code: "UNKNOWN", message: "Something went wrong. Please try again." };
}

/** Holds the form draft and the streamed run, so they survive navigating between pages. */
export function RunProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [run, setRun] = useState<RunState>(IDLE_RUN);
  const [coverLetter, setCoverLetter] = useState<CoverLetterState>(IDLE_COVER_LETTER);
  const runAbort = useRef<AbortController | null>(null);
  const coverAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = loadRun();
    if (saved) {
      setRun({
        status: "done",
        steps: [],
        result: saved.result,
        error: null,
        jdText: saved.jdText,
      });
      if (saved.coverLetter) {
        setCoverLetter({ status: "done", text: saved.coverLetter, error: null });
      }
    }
    setHydrated(true);
  }, []);

  const updateDraft = useCallback((patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetRun = useCallback(() => {
    runAbort.current?.abort();
    coverAbort.current?.abort();
    clearRun();
    setRun(IDLE_RUN);
    setCoverLetter(IDLE_COVER_LETTER);
  }, []);

  /** Consume a customize-style event stream into the run state. */
  const execute = useCallback(
    async (open: (signal: AbortSignal) => AsyncGenerator<StreamEvent>, jdText: string) => {
      runAbort.current?.abort();
      coverAbort.current?.abort();
      const controller = new AbortController();
      runAbort.current = controller;
      clearRun();
      setCoverLetter(IDLE_COVER_LETTER);
      setRun({ ...IDLE_RUN, status: "running", jdText });

      try {
        let result: RunResult | null = null;
        for await (const event of open(controller.signal)) {
          if (event.kind === "plan") {
            setRun((prev) => ({ ...prev, steps: initSteps(event.steps) }));
          } else if (event.kind === "progress") {
            const p = event.data;
            if (p.worker !== "supervisor" && p.step && p.status !== "decided") {
              devlog("STEP", `${p.label} · ${p.status}`, {
                took: p.elapsed_ms != null ? seconds(p.elapsed_ms) : undefined,
                summary: p.summary ?? undefined,
                code: p.code ?? undefined,
              });
            }
            setRun((prev) => ({ ...prev, steps: applyProgress(prev.steps, p) }));
          } else if (event.kind === "result") {
            result = event.data;
          } else if (event.kind === "error") {
            throw new ApiError(event.code, event.message);
          }
        }
        if (!result) {
          throw new ApiError(
            "STREAM_ENDED",
            "The connection ended before the result arrived. Please try again.",
          );
        }
        if (result.status === "failed") {
          const first = result.errors[0];
          const message = first?.message ?? "We could not customize your resume.";
          // Keep the checklist exactly as it was: finished steps stay, the failed one is marked.
          setRun((prev) => ({
            ...prev,
            status: "error",
            result,
            steps: finalizeSteps(prev.steps),
            error: { code: "RUN_FAILED", message, detail: first?.code ?? null },
          }));
          return;
        }
        setRun((prev) => ({ ...prev, status: "done", result, steps: finalizeSteps(prev.steps) }));
        saveRun({ jdText, result, coverLetter: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        const info = toErrorInfo(error);
        // The checklist (if the run had started) stays; a step caught mid-flight is marked.
        setRun((prev) => ({
          ...prev,
          status: "error",
          error: info,
          steps: finalizeSteps(prev.steps, { message: info.message, code: info.detail }),
        }));
      }
    },
    [],
  );

  const startRun = useCallback(
    async (input: CustomizeInput) => {
      await execute(async function* (signal) {
        const fingerprint = await getFingerprint();
        yield* streamCustomize({ ...input, fingerprint }, signal);
      }, input.jdText);
    },
    [execute],
  );

  const startRerun = useCallback(
    (runId: string, jdText: string, sections: Section[]) =>
      execute((signal) => streamRerun(runId, sections, signal), jdText),
    [execute],
  );

  const generateCoverLetter = useCallback(async () => {
    const resume = run.result?.customized_resume;
    if (!resume || !run.result) return;
    coverAbort.current?.abort();
    const controller = new AbortController();
    coverAbort.current = controller;
    setCoverLetter({ status: "running", text: "", error: null });

    try {
      let letter = "";
      const request = {
        jdText: run.jdText,
        resume,
        jdAnalysis: run.result.jd_analysis ?? null,
        runId: run.result.run_id,
      };
      for await (const event of streamCoverLetter(request, controller.signal)) {
        if (event.kind === "token") {
          setCoverLetter((prev) => ({ ...prev, text: prev.text + event.text }));
        } else if (event.kind === "token_reset") {
          setCoverLetter((prev) => ({ ...prev, text: "" }));
        } else if (event.kind === "result") {
          if (!event.data.cover_letter) {
            const first = event.data.errors[0];
            const message = first?.message ?? "We could not write the cover letter.";
            throw new ApiError("COVER_LETTER_FAILED", message, 0, first?.code ?? null);
          }
          letter = event.data.cover_letter;
        } else if (event.kind === "error") {
          throw new ApiError(event.code, event.message);
        }
      }
      if (!letter) {
        throw new ApiError("STREAM_ENDED", "The connection ended before the letter arrived.");
      }
      setCoverLetter({ status: "done", text: letter, error: null });
      saveRun({ jdText: run.jdText, result: run.result, coverLetter: letter });
    } catch (error) {
      if (controller.signal.aborted) return;
      setCoverLetter((prev) => ({ ...prev, status: "error", error: toErrorInfo(error) }));
    }
  }, [run.result, run.jdText]);

  const value = useMemo<RunContextValue>(
    () => ({
      hydrated,
      draft,
      updateDraft,
      run,
      startRun,
      startRerun,
      resetRun,
      coverLetter,
      generateCoverLetter,
    }),
    [
      hydrated,
      draft,
      updateDraft,
      run,
      startRun,
      startRerun,
      resetRun,
      coverLetter,
      generateCoverLetter,
    ],
  );

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}

export function useRun(): RunContextValue {
  const context = useContext(RunContext);
  if (!context) throw new Error("useRun must be used inside <RunProvider>");
  return context;
}
