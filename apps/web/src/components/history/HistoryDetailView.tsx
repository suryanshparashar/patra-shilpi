"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { formatDate, StatusBadge } from "@/components/history/StatusBadge";
import { SpinnerIcon } from "@/components/icons";
import { SectionPicker } from "@/components/form/SectionPicker";
import { Button, Card } from "@/components/ui";
import type { LetterModel } from "@/components/workspace/LetterEditor";
import { ResultsWorkspace } from "@/components/workspace/ResultsWorkspace";
import { useAuth } from "@/context/auth-context";
import { useRun } from "@/context/run-context";
import { deleteHistoryItem, fetchHistoryItem } from "@/lib/history-api";
import { ApiError } from "@/lib/http";
import type { HistoryDetail, RunResult, Section, StructuredResume } from "@/lib/schemas";
import { useAutosave, type EditsSnapshot } from "@/lib/use-autosave";

/** The stored run only keeps the ATS score, so the keyword and fact-check notes are empty. */
function toRunResult(detail: HistoryDetail): RunResult {
  return {
    status: detail.status,
    original_resume: detail.original_resume,
    customized_resume: detail.customized_resume,
    highlighted_skills: detail.highlighted_skills,
    match_before: detail.match_score_before,
    match_after: detail.match_score_after,
    ats_report:
      detail.ats_score === null ? null : { score: detail.ats_score, strengths: [], issues: [] },
    keyword_gap: null,
    guardrail_issues: [],
    cover_letter: null,
    errors: detail.errors.map((message) => ({ worker: "run", message })),
    run_id: detail.id,
  };
}

/** A saved run, with the same editing workspace as a fresh one. The AI's versions are kept on
 * the server, so edits can always be reset. */
function SavedWorkspace({ detail }: { detail: HistoryDetail }) {
  const ai = detail.ai_resume ?? detail.customized_resume;
  const [resumeEdit, setResumeEdit] = useState<StructuredResume | null>(
    detail.resume_edited ? detail.customized_resume : null,
  );
  const [letterEdits, setLetterEdits] = useState<Record<number, string | null>>(() =>
    Object.fromEntries(detail.cover_letters.map((l, i) => [i, l.edited ? l.content : null])),
  );

  const snapshot = useMemo<EditsSnapshot>(
    () => ({ resume: resumeEdit, letters: letterEdits }),
    [resumeEdit, letterEdits],
  );
  const { status, flush } = useAutosave(detail.id, snapshot);

  if (!ai) return null;

  const letters: LetterModel[] = detail.cover_letters.map((l, i) => ({
    label: `Letter ${i + 1} · ${formatDate(l.created_at)}`,
    status: "done",
    aiText: l.ai_content,
    text: letterEdits[i] ?? l.ai_content,
    edited: letterEdits[i] !== null && letterEdits[i] !== undefined,
    issues: l.issues,
    factChecked: l.fact_checked,
    canGenerate: false,
    onEdit: (text) => setLetterEdits((prev) => ({ ...prev, [i]: text })),
    onReset: () => setLetterEdits((prev) => ({ ...prev, [i]: null })),
  }));

  return (
    <ResultsWorkspace
      result={toRunResult(detail)}
      original={detail.original_resume}
      aiResume={ai}
      resume={resumeEdit ?? ai}
      resumeEdited={resumeEdit !== null}
      onResumeChange={setResumeEdit}
      onResumeReset={() => setResumeEdit(null)}
      highlightedSkills={detail.highlighted_skills}
      letters={letters}
      saveStatus={status}
      flush={flush}
    />
  );
}

function RerunCard({ detail }: { detail: HistoryDetail }) {
  const router = useRouter();
  const { startRerun } = useRun();
  const [sections, setSections] = useState<Section[]>(detail.selected_sections);

  function rerun() {
    if (sections.length === 0) return;
    void startRerun(detail.id, detail.jd_text, sections);
    router.push("/results");
  }

  return (
    <Card
      title="Run it again"
      description="Uses the same job description and resume. Pick which sections to customize this time."
    >
      <div className="space-y-4">
        <SectionPicker
          value={sections}
          onChange={setSections}
          error={sections.length === 0 ? "Select at least one section." : undefined}
        />
        <Button onClick={rerun} disabled={sections.length === 0}>
          Re-run
        </Button>
      </div>
    </Card>
  );
}

export function HistoryDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    fetchHistoryItem(id)
      .then((item) => !cancelled && setDetail(item))
      .catch(
        (e) =>
          !cancelled && setError(e instanceof ApiError ? e.message : "Could not load this run."),
      );
    return () => {
      cancelled = true;
    };
  }, [ready, user, id, router]);

  async function remove() {
    try {
      await deleteHistoryItem(id);
      router.push("/history");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete that run.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/history" className="text-sm font-medium text-emerald-700 hover:underline">
        ← Back to history
      </Link>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {!detail && !error ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-stone-600">
          <SpinnerIcon /> Loading…
        </p>
      ) : null}

      {detail ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-stone-900">
                {detail.candidate_name ?? "Saved run"}
              </h1>
              <StatusBadge status={detail.status} />
              <span className="text-sm text-stone-500">{formatDate(detail.created_at)}</span>
            </div>
            {confirming ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-stone-600">Delete this run?</span>
                <Button
                  variant="secondary"
                  onClick={() => void remove()}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  Delete
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setConfirming(true)}>
                Delete
              </Button>
            )}
          </div>

          {detail.errors.length > 0 ? (
            <div
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
            >
              <p className="font-medium">
                {detail.customized_resume
                  ? "Some steps could not finish in this run:"
                  : "This run did not produce a resume:"}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                {detail.errors.map((message, i) => (
                  <li key={i}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {detail.customized_resume ? <SavedWorkspace detail={detail} /> : null}

          <RerunCard detail={detail} />

          <details className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-sm font-medium text-stone-900">
              Job description
            </summary>
            <p className="mt-3 text-sm whitespace-pre-wrap text-stone-700">{detail.jd_text}</p>
          </details>
        </div>
      ) : null}
    </div>
  );
}
