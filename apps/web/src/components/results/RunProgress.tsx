import { AlertIcon, CheckIcon, SpinnerIcon, XIcon } from "@/components/icons";
import { ErrorCode } from "@/components/results/ErrorCode";
import { Card } from "@/components/ui";
import { seconds } from "@/lib/devlog";
import type { Step } from "@/lib/steps";

function StepIcon({ status }: { status: Step["status"] }) {
  switch (status) {
    case "running":
      return <SpinnerIcon className="size-5 text-emerald-600" />;
    case "done":
      return (
        <span className="grid size-5 place-items-center rounded-full bg-emerald-600 text-white">
          <CheckIcon className="size-3" />
        </span>
      );
    case "failed":
      return (
        <span className="grid size-5 place-items-center rounded-full bg-red-600 text-white">
          <XIcon className="size-3" />
        </span>
      );
    case "skipped":
      return <span className="block size-5 rounded-full border-2 border-dashed border-stone-300" />;
    default:
      return <span className="block size-5 rounded-full border-2 border-stone-300" />;
  }
}

function StepRow({ step }: { step: Step }) {
  const tone =
    step.status === "running"
      ? "font-medium text-stone-900"
      : step.status === "failed"
        ? "font-medium text-red-800"
        : step.status === "done"
          ? "text-stone-700"
          : "text-stone-400";

  return (
    <li
      className={`flex items-start gap-3 ${
        step.status === "failed" ? "rounded-lg bg-red-50/70 p-2.5 ring-1 ring-red-200" : ""
      }`}
    >
      <span className="mt-0.5 shrink-0">
        <StepIcon status={step.status} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className={`text-sm ${tone}`}>{step.label}</p>
          <span className="shrink-0 text-xs text-stone-400 tabular-nums">
            {step.status === "done" && step.elapsedMs != null ? seconds(step.elapsedMs) : null}
            {step.status === "failed" && step.elapsedMs != null ? seconds(step.elapsedMs) : null}
            {step.status === "skipped" ? "Skipped" : null}
          </span>
        </div>
        {step.status === "done" && step.summary ? (
          <p
            className={`mt-0.5 text-xs ${
              step.id === "match_after" ? "font-medium text-emerald-700" : "text-stone-500"
            }`}
          >
            {step.summary}
          </p>
        ) : null}
        {step.status === "failed" ? (
          <div className="mt-1.5 space-y-1.5">
            {step.message ? (
              <p className="flex items-start gap-1.5 text-xs text-red-700">
                <AlertIcon className="mt-px size-3.5 shrink-0" />
                {step.message}
              </p>
            ) : null}
            <ErrorCode code={step.code} />
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol aria-live="polite" className="space-y-2.5">
      {steps.map((step) => (
        <StepRow key={step.id} step={step} />
      ))}
    </ol>
  );
}

/** The checklist of every step in the run: done ones with their time, the one in progress, the
 * ones still to come, and, if the run stopped, exactly where. */
export function RunProgress({
  steps,
  stopped = false,
  bare = false,
}: {
  steps: Step[];
  /** The run ended early: the title changes and nothing is shown as still in progress. */
  stopped?: boolean;
  /** Render just the list and progress bar, with no card around them. */
  bare?: boolean;
}) {
  const finished = steps.filter((s) => s.status === "done").length;
  const percent = steps.length ? Math.round((finished / steps.length) * 100) : 0;

  const body =
    steps.length === 0 ? (
      <p className="flex items-center gap-3 text-sm text-stone-600">
        <SpinnerIcon className="size-5 text-emerald-600" />
        Starting…
      </p>
    ) : (
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex justify-between text-xs text-stone-500">
            <span>
              {finished} of {steps.length} steps done
            </span>
            <span className="tabular-nums">{percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${stopped ? "bg-stone-400" : "bg-emerald-600"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <StepList steps={steps} />
      </div>
    );

  if (bare) return body;
  return (
    <Card
      title={stopped ? "Customization stopped" : "Customizing your resume"}
      description={
        stopped
          ? "Here is what finished and where it stopped."
          : "Keep this tab open. Each step is checked off as it completes."
      }
    >
      {body}
    </Card>
  );
}
