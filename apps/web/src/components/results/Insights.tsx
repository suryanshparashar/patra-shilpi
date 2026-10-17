import { AlertIcon } from "@/components/icons";
import { ErrorCode } from "@/components/results/ErrorCode";
import { Card } from "@/components/ui";
import type { RunResult } from "@/lib/schemas";

export function PartialNotice({ result }: { result: RunResult }) {
  if (result.status !== "partial") return null;
  return (
    <div
      role="status"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
    >
      <p className="flex items-center gap-2 font-medium">
        <AlertIcon className="size-4" />
        Your resume was customized, but some steps could not finish:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        {result.errors.map((e, i) => (
          <li key={i}>
            {e.message} <ErrorCode code={e.code} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GuardrailNotes({ result }: { result: RunResult }) {
  if (!result.guardrail_issues.length) return null;
  return (
    <Card
      title="Please review before sending"
      description="Our fact-check found text that your original resume may not support."
      className="border-amber-200"
    >
      <ul className="space-y-3">
        {result.guardrail_issues.map((issue, i) => (
          <li key={i} className="text-sm">
            <p className="text-stone-900">
              <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 capitalize">
                {issue.section}
              </span>
              “{issue.claim}”
            </p>
            <p className="mt-0.5 text-stone-600">{issue.reason}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function MissingKeywords({ result }: { result: RunResult }) {
  const gap = result.keyword_gap;
  if (gap === null) return null;
  return (
    <Card
      title="Missing keywords"
      description="Terms from the job description that your resume doesn't show. Add one only if it's true for you."
    >
      {gap.missing_keywords.length === 0 ? (
        <p className="text-sm text-stone-600">Nothing important is missing. Nice match.</p>
      ) : (
        <ul className="space-y-3">
          {gap.missing_keywords.map((item, i) => (
            <li key={i} className="text-sm">
              <span
                className={`mr-2 rounded-md px-2 py-0.5 text-xs font-medium ${
                  item.importance === "required"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-stone-100 text-stone-700"
                }`}
              >
                {item.keyword}
              </span>
              <span className="text-xs text-stone-500">{item.importance}</span>
              <p className="mt-1 text-stone-600">{item.suggestion}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
