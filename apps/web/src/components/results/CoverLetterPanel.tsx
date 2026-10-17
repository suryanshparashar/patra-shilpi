"use client";

import { useState } from "react";

import { DownloadIcon, SpinnerIcon } from "@/components/icons";
import { ErrorCode } from "@/components/results/ErrorCode";
import { LoginPrompt } from "@/components/results/LoginPrompt";
import { Button, Card } from "@/components/ui";
import { useRun } from "@/context/run-context";
import { downloadCoverLetterPdf } from "@/lib/download-pdf";

export function CoverLetterPanel({ candidateName }: { candidateName: string | null }) {
  const { coverLetter, generateCoverLetter } = useRun();
  const [copied, setCopied] = useState(false);
  const running = coverLetter.status === "running";
  const needsLogin = ["AUTH_REQUIRED", "TOKEN_EXPIRED", "TOKEN_INVALID"].includes(
    coverLetter.error?.code ?? "",
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(coverLetter.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: the text is still selectable on the page
    }
  }

  return (
    <Card
      title="Cover letter"
      description="Written from this job description and your customized resume. Available to logged-in users."
    >
      {coverLetter.status === "idle" ? (
        <Button onClick={() => void generateCoverLetter()}>Generate cover letter</Button>
      ) : null}

      {needsLogin ? (
        <div role="alert" className="text-sm text-stone-700">
          <p>Log in to generate a cover letter (cover letters are for registered users).</p>
          <LoginPrompt />
        </div>
      ) : null}

      {coverLetter.status === "error" && !needsLogin ? (
        <div role="alert" className="space-y-3">
          <p className="text-sm text-red-700">{coverLetter.error?.message}</p>
          <ErrorCode code={coverLetter.error?.detail} />
          <Button variant="secondary" onClick={() => void generateCoverLetter()}>
            Try again
          </Button>
        </div>
      ) : null}

      {coverLetter.text ? (
        <div className="space-y-3">
          <p
            aria-live="polite"
            className="rounded-lg bg-stone-50 p-4 text-sm leading-relaxed whitespace-pre-wrap text-stone-800"
          >
            {coverLetter.text}
          </p>
          {running ? (
            <p className="flex items-center gap-2 text-xs text-stone-500">
              <SpinnerIcon /> Writing…
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void downloadCoverLetterPdf(coverLetter.text, candidateName)}>
                <DownloadIcon /> Download PDF
              </Button>
              <Button variant="secondary" onClick={() => void copy()}>
                {copied ? "Copied" : "Copy text"}
              </Button>
              <Button variant="ghost" onClick={() => void generateCoverLetter()}>
                Regenerate
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {running && !coverLetter.text ? (
        <p className="flex items-center gap-2 text-sm text-stone-600">
          <SpinnerIcon /> Writing your cover letter…
        </p>
      ) : null}
    </Card>
  );
}
