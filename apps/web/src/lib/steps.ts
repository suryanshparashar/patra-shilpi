import type { PlanStep, ProgressEvent } from "@/lib/schemas";

export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface Step {
  id: string;
  label: string;
  status: StepStatus;
  /** How long the step took, once it has finished. */
  elapsedMs?: number | null;
  /** A one-line result shown under a finished step, e.g. "Match 61% → 74%". */
  summary?: string | null;
  /** The friendly reason a step failed (never the provider's raw text). */
  message?: string | null;
  /** The provider's error code and status, e.g. "429 RESOURCE_EXHAUSTED". */
  code?: string | null;
}

/** Every step the server says the run will take, all waiting to start. */
export function initSteps(plan: PlanStep[]): Step[] {
  return plan.map((step) => ({ id: step.id, label: step.label, status: "pending" }));
}

/** A step the plan didn't list (a revision) goes before the first one still waiting. */
function insertBeforeFirstPending(steps: Step[], step: Step): Step[] {
  const index = steps.findIndex((s) => s.status === "pending");
  return index === -1 ? [...steps, step] : [...steps.slice(0, index), step, ...steps.slice(index)];
}

/** Fold one progress event into the checklist. The supervisor's own events are not steps. */
export function applyProgress(steps: Step[], event: ProgressEvent): Step[] {
  if (event.worker === "supervisor" || !event.step) return steps;
  const id = event.step;
  const exists = steps.some((s) => s.id === id);

  if (event.status === "started") {
    // A step can run again after a revision, so a finished one goes back to running.
    const running: Step = { id, label: event.label, status: "running" };
    return exists
      ? steps.map((s) =>
          s.id === id
            ? { ...s, status: "running", elapsedMs: null, summary: null, message: null, code: null }
            : s,
        )
      : insertBeforeFirstPending(steps, running);
  }

  if (event.status !== "done" && event.status !== "failed") return steps;
  const finished: Step = {
    id,
    label: event.label,
    status: event.status,
    elapsedMs: event.elapsed_ms ?? null,
    summary: event.status === "done" ? (event.summary ?? null) : null,
    message: event.status === "failed" ? (event.message ?? null) : null,
    code: event.status === "failed" ? (event.code ?? null) : null,
  };
  return exists
    ? steps.map((s) => (s.id === id ? { ...s, ...finished, label: s.label } : s))
    : insertBeforeFirstPending(steps, finished);
}

/** Close the checklist when the run ends: steps that never started are skipped, and a step
 * still running (the connection dropped mid-step) is marked as interrupted. Completed and
 * failed steps are left exactly as they were. */
export function finalizeSteps(
  steps: Step[],
  interruption?: { message: string; code?: string | null },
): Step[] {
  return steps.map((step) => {
    if (step.status === "pending") return { ...step, status: "skipped" };
    if (step.status === "running") {
      return {
        ...step,
        status: "failed",
        message: interruption?.message ?? "This step did not finish.",
        code: interruption?.code ?? null,
      };
    }
    return step;
  });
}
