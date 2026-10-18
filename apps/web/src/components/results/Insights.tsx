import { AlertIcon } from "@/components/icons";
import { ErrorCode } from "@/components/results/ErrorCode";
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
