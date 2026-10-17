import { ErrorCode } from "@/components/results/ErrorCode";
import { Card } from "@/components/ui";
import type { RunResult } from "@/lib/schemas";

function Bar({ value, tone }: { value: number; tone: "muted" | "primary" }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-stone-100">
      <div
        className={`h-full rounded-full ${tone === "primary" ? "bg-emerald-600" : "bg-stone-300"}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function failureOf(result: RunResult, worker: string) {
  return result.errors.find((e) => e.worker === worker);
}

function Unavailable({ failure }: { failure?: { message: string; code?: string | null } }) {
  return (
    <div className="space-y-2 text-sm text-stone-500">
      <p>{failure?.message ?? "Not available for this run."}</p>
      <ErrorCode code={failure?.code} />
    </div>
  );
}

export function ScoreCards({ result }: { result: RunResult }) {
  const { match_before: before, match_after: after, ats_report: ats } = result;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card
        title="Resume–job match"
        description="Semantic similarity between your resume and the job description."
      >
        {before === null ? (
          <Unavailable failure={failureOf(result, "match_scorer")} />
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-stone-900">{after ?? before}%</span>
              {after !== null ? (
                <span
                  className={`text-sm font-medium ${after >= before ? "text-emerald-700" : "text-amber-700"}`}
                >
                  {after >= before ? "+" : ""}
                  {(after - before).toFixed(1)} vs. original
                </span>
              ) : null}
            </div>
            <div className="space-y-2">
              <div>
                <div className="mb-1 flex justify-between text-xs text-stone-500">
                  <span>Original</span>
                  <span>{before}%</span>
                </div>
                <Bar value={before} tone="muted" />
              </div>
              {after !== null ? (
                <div>
                  <div className="mb-1 flex justify-between text-xs text-stone-500">
                    <span>Customized</span>
                    <span>{after}%</span>
                  </div>
                  <Bar value={after} tone="primary" />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </Card>

      <Card title="ATS-friendliness" description="Estimated by AI from the resume's content.">
        {ats === null ? (
          <Unavailable failure={failureOf(result, "evaluator")} />
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-stone-900">{ats.score}</span>
              <span className="text-sm text-stone-500">/ 100</span>
            </div>
            <Bar value={ats.score} tone="primary" />
            {ats.issues.length ? (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-stone-800">
                  {ats.issues.length} suggestion{ats.issues.length === 1 ? "" : "s"}
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-700">
                  {ats.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            {ats.strengths.length ? (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-stone-800">Strengths</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-700">
                  {ats.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}
