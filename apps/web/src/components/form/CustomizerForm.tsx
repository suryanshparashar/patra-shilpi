"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { JobDescriptionField } from "@/components/form/JobDescriptionField";
import { ResumeDropzone } from "@/components/form/ResumeDropzone";
import { SectionPicker } from "@/components/form/SectionPicker";
import { Button } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { useRun } from "@/context/run-context";
import { focusFirst } from "@/lib/focus";
import { validateInput, type InputErrors } from "@/lib/schemas";

export function CustomizerForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { draft, updateDraft, startRun, run } = useRun();
  const [submitted, setSubmitted] = useState(false);

  // After the first submit attempt, errors follow the fields live.
  const errors: InputErrors = submitted ? validateInput(draft).errors : {};
  const busy = run.status === "running";

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const { data, errors: found } = validateInput(draft);
    if (!data) {
      focusFirst([
        found.jdText && "jd",
        found.file && (draft.file ? "resume-remove" : "resume-dropzone"),
        found.sections && "section-summary",
      ]);
      return;
    }
    void startRun(data);
    router.push("/results");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <JobDescriptionField
        value={draft.jdText}
        onChange={(jdText) => updateDraft({ jdText })}
        error={errors.jdText}
      />
      <ResumeDropzone
        file={draft.file}
        onChange={(file) => updateDraft({ file })}
        error={errors.file}
      />
      <SectionPicker
        value={draft.sections}
        onChange={(sections) => updateDraft({ sections })}
        error={errors.sections}
      />

      <div className="space-y-3">
        <Button type="submit" disabled={busy} className="w-full py-3 text-base sm:w-auto">
          {busy ? "A run is in progress…" : "Customize my resume"}
        </Button>
        <p className="text-xs leading-relaxed text-stone-500">
          {user
            ? "Runs are saved to your history, including the resume text extracted from your PDF, so you can re-run or delete them. The PDF file itself is never stored."
            : "Your free guest run is tracked with a cookie and an anonymous, hashed browser fingerprint. Nothing about your resume is stored, and your PDF is never saved."}
        </p>
      </div>
    </form>
  );
}
