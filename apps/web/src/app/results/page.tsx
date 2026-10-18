"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { BackgroundGraphics } from "@/components/BackgroundGraphics";
import { ErrorPanel } from "@/components/results/ErrorPanel";
import { RunProgress } from "@/components/results/RunProgress";
import { Button } from "@/components/ui";
import { RunWorkspace } from "@/components/workspace/RunWorkspace";
import { useRun } from "@/context/run-context";

export default function ResultsPage() {
  const router = useRouter();
  const { hydrated, run, resetRun } = useRun();

  // Nothing to show (direct visit or a cleared tab): go back to the form.
  useEffect(() => {
    if (hydrated && run.status === "idle") router.replace("/customize");
  }, [hydrated, run.status, router]);

  function startOver() {
    resetRun();
    router.push("/customize");
  }

  return (
    <section className="relative isolate flex-1 overflow-hidden">
      <BackgroundGraphics />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-stone-900">Your tailored resume</h1>
          {run.status === "done" ? (
            <Button variant="secondary" onClick={startOver}>
              Start over
            </Button>
          ) : null}
        </div>

        {run.status === "running" ? (
          <div className="mx-auto max-w-xl">
            <RunProgress steps={run.steps} />
          </div>
        ) : null}

        {run.status === "error" && run.error ? (
          <div className="mx-auto max-w-xl space-y-4">
            {/* If the run had started, show how far it got: finished steps, the failed one, the rest. */}
            {run.steps.length > 0 ? <RunProgress steps={run.steps} stopped /> : null}
            <ErrorPanel error={run.error} onBack={startOver} compact={run.steps.length > 0} />
          </div>
        ) : null}

        {run.status === "done" && run.result ? (
          <RunWorkspace result={run.result} steps={run.steps} />
        ) : null}
      </div>
    </section>
  );
}
