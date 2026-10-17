"use client";

import { useState } from "react";

import { DownloadIcon, SpinnerIcon } from "@/components/icons";
import { ResumeView } from "@/components/results/ResumeView";
import { Button, Card } from "@/components/ui";
import { downloadResumePdf } from "@/lib/download-pdf";
import type { StructuredResume } from "@/lib/schemas";

type Tab = "original" | "customized";

export function ComparisonView({
  original,
  customized,
  highlightedSkills,
}: {
  original: StructuredResume | null;
  customized: StructuredResume;
  highlightedSkills: string[];
}) {
  const [tab, setTab] = useState<Tab>("customized");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  async function download() {
    setDownloading(true);
    setDownloadError(false);
    try {
      await downloadResumePdf(customized);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  }

  const downloadButton = (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={download} disabled={downloading}>
        {downloading ? <SpinnerIcon /> : <DownloadIcon />}
        Download PDF
      </Button>
      {downloadError ? (
        <p role="alert" className="text-xs text-red-600">
          Could not create the PDF. Please try again.
        </p>
      ) : null}
    </div>
  );

  return (
    <div>
      <div
        role="tablist"
        aria-label="Resume version"
        className="mb-3 flex gap-1 rounded-lg bg-stone-200/60 p-1 lg:hidden"
      >
        {(["original", "customized"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
              tab === value ? "bg-white text-stone-900 shadow-sm" : "text-stone-600"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={tab === "original" ? "" : "hidden lg:block"}>
          <Card title="Original" description="As parsed from your PDF." className="h-full">
            {original ? (
              <ResumeView resume={original} />
            ) : (
              <p className="text-sm text-stone-500">The original could not be displayed.</p>
            )}
          </Card>
        </div>
        <div className={tab === "customized" ? "" : "hidden lg:block"}>
          <Card
            title="Customized"
            description="Tailored to the job. Matched skills are highlighted."
            action={downloadButton}
            className="h-full border-emerald-200"
          >
            <ResumeView resume={customized} highlightedSkills={highlightedSkills} />
          </Card>
        </div>
      </div>
    </div>
  );
}
