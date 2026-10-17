import { AlertIcon } from "@/components/icons";
import { ErrorCode } from "@/components/results/ErrorCode";
import { LoginPrompt } from "@/components/results/LoginPrompt";
import { Button } from "@/components/ui";
import type { ErrorInfo } from "@/context/run-context";

const TITLES: Record<string, string> = {
  GUEST_LIMIT_REACHED: "Your free run has been used",
  GUEST_RUN_IN_PROGRESS: "A run is already in progress",
  RATE_LIMITED: "Too many runs",
  NETWORK_ERROR: "Connection problem",
  TOKEN_EXPIRED: "Your session has expired",
  TOKEN_INVALID: "Your session has expired",
  RUN_FAILED: "We couldn't finish your resume",
};

export function ErrorPanel({
  error,
  onBack,
  compact = false,
}: {
  error: ErrorInfo;
  onBack: () => void;
  /** The step checklist above already shows what failed, so only add a short note and the way out. */
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <AlertIcon className="mt-0.5 size-5 shrink-0 text-red-600" />
        <div>
          <h2 className="text-base font-semibold">
            {TITLES[error.code] ?? "Something went wrong"}
          </h2>
          {compact ? (
            <p className="mt-1 text-sm">
              The step that failed is marked above, with its error code.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm">{error.message}</p>
              {error.detail ? (
                <p className="mt-2">
                  <ErrorCode code={error.detail} />
                </p>
              ) : null}
            </>
          )}
          {["GUEST_LIMIT_REACHED", "TOKEN_EXPIRED", "TOKEN_INVALID"].includes(error.code) ? (
            <LoginPrompt />
          ) : null}
          <div className="mt-4">
            <Button variant="secondary" onClick={onBack}>
              Back to the form
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
