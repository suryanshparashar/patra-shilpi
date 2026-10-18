"use client";

import { useMemo } from "react";

import { ResultsWorkspace } from "@/components/workspace/ResultsWorkspace";
import type { LetterModel } from "@/components/workspace/LetterEditor";
import { useRun } from "@/context/run-context";
import type { RunResult } from "@/lib/schemas";
import type { Step } from "@/lib/steps";
import { useAutosave, type EditsSnapshot } from "@/lib/use-autosave";

/** The workspace for the run that just finished. Edits live in the run context (so they survive
 * a refresh) and are saved to the run's history entry for logged-in users. */
export function RunWorkspace({ result, steps }: { result: RunResult; steps: Step[] }) {
  const {
    coverLetter,
    generateCoverLetter,
    edits,
    editResume,
    resetResume,
    editLetter,
    resetLetter,
  } = useRun();
  const aiResume = result.customized_resume;

  const snapshot = useMemo<EditsSnapshot>(
    () => ({
      resume: edits.resume,
      letters: coverLetter.index != null ? { [coverLetter.index]: edits.letter } : {},
    }),
    [edits.resume, edits.letter, coverLetter.index],
  );
  const { status, flush } = useAutosave(result.run_id, snapshot);

  if (!aiResume) return null;

  const letter: LetterModel = {
    status: coverLetter.status,
    aiText: coverLetter.text,
    text: edits.letter ?? coverLetter.text,
    edited: edits.letter !== null,
    phase: coverLetter.phase,
    error: coverLetter.error,
    issues: coverLetter.issues ?? [],
    factChecked: coverLetter.checked ?? true,
    canGenerate: true,
    onGenerate: () => void generateCoverLetter(),
    onEdit: editLetter,
    onReset: resetLetter,
  };

  return (
    <ResultsWorkspace
      result={result}
      original={result.original_resume}
      aiResume={aiResume}
      resume={edits.resume ?? aiResume}
      resumeEdited={edits.resume !== null}
      onResumeChange={editResume}
      onResumeReset={resetResume}
      highlightedSkills={result.highlighted_skills}
      letters={[letter]}
      saveStatus={status}
      flush={flush}
      steps={steps}
      historyHref={result.run_id ? `/history/${result.run_id}` : null}
    />
  );
}
