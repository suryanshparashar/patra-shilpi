import Link from "next/link";

import { ComparisonView } from "@/components/results/ComparisonView";
import { CoverLetterPanel } from "@/components/results/CoverLetterPanel";
import { GuardrailNotes, MissingKeywords, PartialNotice } from "@/components/results/Insights";
import { ScoreCards } from "@/components/results/ScoreCards";
import { RunProgress } from "@/components/results/RunProgress";
import type { RunResult } from "@/lib/schemas";
import type { Step } from "@/lib/steps";

export function ResultsView({ result, steps = [] }: { result: RunResult; steps?: Step[] }) {
  if (!result.customized_resume) return null;
  return (
    <div className="space-y-4">
      {result.run_id ? (
        <p className="text-sm text-stone-600">
          Saved to your history.{" "}
          <Link
            href={`/history/${result.run_id}`}
            className="font-medium text-emerald-700 hover:underline"
          >
            View it there
          </Link>
        </p>
      ) : null}
      <PartialNotice result={result} />
      {result.status === "partial" && steps.length > 0 ? (
        <details open className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-stone-900">
            Run steps
          </summary>
          <div className="mt-4">
            <RunProgress steps={steps} bare />
          </div>
        </details>
      ) : null}
      <ScoreCards result={result} />
      <GuardrailNotes result={result} />
      <ComparisonView
        original={result.original_resume}
        customized={result.customized_resume}
        highlightedSkills={result.highlighted_skills}
      />
      <MissingKeywords result={result} />
      <CoverLetterPanel candidateName={result.customized_resume.contact.name} />
    </div>
  );
}
