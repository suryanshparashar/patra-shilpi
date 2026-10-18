"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { AlertIcon, CheckIcon, DownloadIcon, SpinnerIcon, UndoIcon } from "@/components/icons";
import { ErrorCode } from "@/components/results/ErrorCode";
import { LoginPrompt } from "@/components/results/LoginPrompt";
import { Button } from "@/components/ui";
import type { ErrorInfo } from "@/context/run-context";
import { downloadCoverLetterPdf } from "@/lib/download-pdf";
import { findPhrase, flagState, segments } from "@/lib/highlight";
import type { GuardrailIssue } from "@/lib/schemas";

/** One cover letter as the page holds it. */
export interface LetterModel {
  /** Heading when a run has several saved letters, e.g. its date. */
  label?: string;
  status: "idle" | "running" | "done" | "error";
  /** The AI's letter (the text so far while it is still streaming). */
  aiText: string;
  /** What is shown and downloaded: the user's edit if there is one, else the AI's letter. */
  text: string;
  edited: boolean;
  /** What is happening now while running, e.g. "Fact-checking the cover letter". */
  phase?: string | null;
  error?: ErrorInfo | null;
  /** Claims the fact-check still flags in the AI's letter. */
  issues: GuardrailIssue[];
  /** False for a letter saved before the check existed, or when the check itself failed. */
  factChecked: boolean;
  /** Saved letters (history) cannot be generated again from here. */
  canGenerate: boolean;
  onGenerate?: () => void;
  onEdit: (text: string) => void;
  onReset: () => void;
}

const AUTH_CODES = ["AUTH_REQUIRED", "TOKEN_EXPIRED", "TOKEN_INVALID"];

/** The letter as plain text you can edit. Flagged phrases are marked in amber behind the text
 * and stop being marked as soon as you edit them out. The PDF is built from what you see. */
export function LetterEditor({
  letter,
  name,
  beforeDownload,
  label,
  showRequest,
}: {
  letter: LetterModel;
  name: string | null;
  /** Runs before a download, e.g. to save the edits to history first. */
  beforeDownload?: () => Promise<void>;
  label?: string;
  /** Ask the editor to select a flagged phrase ("Show" in the sidebar). */
  showRequest?: { claim: string; nonce: number } | null;
}) {
  const area = useRef<HTMLTextAreaElement | null>(null);
  const mirror = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDownload, setConfirmDownload] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const running = letter.status === "running";
  const needsLogin = AUTH_CODES.includes(letter.error?.code ?? "");

  const { states, open, resolved, pieces } = useMemo(() => {
    const all = letter.issues.map((issue) => ({
      issue,
      state: flagState(letter.text, letter.aiText, issue),
    }));
    const stillOpen = all.filter((s) => s.state === "open");
    return {
      states: all,
      open: stillOpen,
      resolved: all.filter((s) => s.state === "resolved").length,
      pieces: segments(
        letter.text,
        stillOpen.map((s) => s.issue.claim),
      ),
    };
  }, [letter.issues, letter.text, letter.aiText]);

  const fit = useCallback(() => {
    const element = area.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.max(element.scrollHeight, 240)}px`;
  }, []);
  useLayoutEffect(fit, [letter.text, fit]);

  const show = useCallback(
    (claim: string) => {
      const element = area.current;
      const range = findPhrase(letter.text, claim);
      if (!element || !range) return;
      element.focus({ preventScroll: true });
      element.setSelectionRange(range.start, range.end);
      // Scroll to the amber mark behind the text, which is where the phrase is on screen.
      let offset = 0;
      let index = -1;
      for (const piece of pieces) {
        if (piece.flagged) index += 1;
        if (offset + piece.text.length > range.start && piece.flagged) break;
        offset += piece.text.length;
      }
      mirror.current?.querySelectorAll("mark")[Math.max(index, 0)]?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    },
    [letter.text, pieces],
  );

  const handled = useRef(0);
  useEffect(() => {
    if (!showRequest || showRequest.nonce === handled.current) return;
    handled.current = showRequest.nonce;
    show(showRequest.claim);
  }, [showRequest, show]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(letter.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: the text stays selectable on the page
    }
  }

  async function download() {
    setConfirmDownload(false);
    await beforeDownload?.();
    await downloadCoverLetterPdf(letter.text, name);
  }

  const words = letter.text.trim() ? letter.text.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-4">
      {label ? <h3 className="text-sm font-semibold text-stone-900">{label}</h3> : null}

      {letter.status === "idle" && letter.canGenerate ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-stone-200">
          <p className="text-sm text-stone-600">
            Written from the job description and your resume, then fact-checked against your
            original. You can edit it before you download. For logged-in users.
          </p>
          <Button className="mt-4" onClick={letter.onGenerate}>
            Generate cover letter
          </Button>
        </div>
      ) : null}

      {needsLogin ? (
        <div
          role="alert"
          className="rounded-xl bg-white p-5 text-sm text-stone-700 ring-1 ring-stone-200"
        >
          <p>Log in to generate a cover letter (cover letters are for registered users).</p>
          <LoginPrompt />
        </div>
      ) : null}

      {letter.status === "error" && !needsLogin ? (
        <div role="alert" className="space-y-3 rounded-xl bg-white p-5 ring-1 ring-red-200">
          <p className="text-sm text-red-700">{letter.error?.message}</p>
          <ErrorCode code={letter.error?.detail} />
          {letter.canGenerate ? (
            <Button variant="secondary" onClick={letter.onGenerate}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}

      {running && !letter.text ? (
        <p className="flex items-center gap-2 rounded-xl bg-white p-5 text-sm text-stone-600 ring-1 ring-stone-200">
          <SpinnerIcon /> {letter.phase ?? "Writing your cover letter"}…
        </p>
      ) : null}

      {letter.text && !needsLogin ? (
        <>
          {!letter.factChecked && !running ? (
            <p
              role="status"
              className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <AlertIcon className="size-4 shrink-0" />
              This letter was not fact-checked against your resume. Read it carefully before you
              send it.
            </p>
          ) : null}

          {states.length > 0 && !running ? (
            <section
              aria-label="Fact-check"
              className={`rounded-xl border p-4 text-sm ${
                open.length || states.some((s) => s.state === "unlocated")
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900"
              }`}
            >
              <p className="flex items-center gap-2 font-medium">
                {open.length === 0 && states.every((s) => s.state === "resolved") ? (
                  <CheckIcon className="size-4" />
                ) : (
                  <AlertIcon className="size-4" />
                )}
                {open.length === 0 && states.every((s) => s.state === "resolved")
                  ? "All flagged phrases are edited out."
                  : "The fact-check could not confirm these claims in your resume. Edit or remove them below."}
                <span className="ml-auto text-xs font-normal">
                  {resolved} of {states.length} resolved
                </span>
              </p>
              <ul className="mt-3 space-y-2">
                {states.map(({ issue, state }, i) => (
                  <li key={i} className="flex flex-wrap items-start gap-x-3 gap-y-1">
                    <div className="min-w-0 flex-1 wrap-anywhere">
                      <p className={state === "resolved" ? "line-through opacity-60" : ""}>
                        “{issue.claim}”
                      </p>
                      <p className="text-xs opacity-80">
                        {state === "resolved"
                          ? "Edited out."
                          : state === "unlocated"
                            ? `${issue.reason} (Not found word for word in the text. Check the letter for it.)`
                            : issue.reason}
                      </p>
                    </div>
                    {state === "open" ? (
                      <button
                        type="button"
                        onClick={() => show(issue.claim)}
                        className="shrink-0 text-xs font-semibold underline underline-offset-2 hover:no-underline"
                      >
                        Show
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="relative rounded-2xl bg-white shadow-sm ring-1 ring-stone-200 focus-within:ring-2 focus-within:ring-emerald-500/60">
            {/* The same text, drawn behind the textarea, with the flagged phrases marked. */}
            <div
              ref={mirror}
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden p-6 text-[15px] leading-7 wrap-anywhere whitespace-pre-wrap text-transparent sm:p-8"
            >
              {pieces.map((piece, i) =>
                piece.flagged ? (
                  <mark key={i} className="rounded bg-amber-200/80 text-transparent">
                    {piece.text}
                  </mark>
                ) : (
                  <span key={i}>{piece.text}</span>
                ),
              )}
              {"\n"}
            </div>
            <textarea
              ref={area}
              value={letter.text}
              readOnly={running}
              aria-label="Cover letter"
              spellCheck
              onChange={(event) => letter.onEdit(event.target.value)}
              className="relative block min-h-60 w-full resize-none overflow-hidden rounded-2xl border-0 bg-transparent p-6 text-[15px] leading-7 wrap-anywhere whitespace-pre-wrap text-stone-800 outline-none sm:p-8"
            />
          </div>

          {running ? (
            <p className="flex items-center gap-2 text-xs text-stone-500">
              <SpinnerIcon /> {letter.phase ?? "Writing"}…
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {confirmDownload ? (
                <div
                  role="alert"
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200"
                >
                  {open.length} flagged {open.length === 1 ? "phrase is" : "phrases are"} still in
                  the letter. Download anyway?
                  <Button variant="secondary" onClick={() => void download()}>
                    Download anyway
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmDownload(false)}>
                    Keep editing
                  </Button>
                </div>
              ) : (
                <Button onClick={() => (open.length ? setConfirmDownload(true) : void download())}>
                  <DownloadIcon /> Download PDF
                </Button>
              )}
              <Button variant="secondary" onClick={() => void copy()}>
                {copied ? "Copied" : "Copy text"}
              </Button>
              {letter.edited ? (
                confirmReset ? (
                  <span className="flex items-center gap-2 text-sm text-stone-600">
                    Discard your edits?
                    <Button
                      variant="secondary"
                      onClick={() => {
                        letter.onReset();
                        setConfirmReset(false);
                      }}
                    >
                      Discard
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                      Cancel
                    </Button>
                  </span>
                ) : (
                  <Button variant="ghost" onClick={() => setConfirmReset(true)}>
                    <UndoIcon /> Reset to AI version
                  </Button>
                )
              ) : null}
              {letter.canGenerate ? (
                confirmRegenerate ? (
                  <span className="flex items-center gap-2 text-sm text-stone-600">
                    Replace your edited letter?
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setConfirmRegenerate(false);
                        letter.onGenerate?.();
                      }}
                    >
                      Replace
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmRegenerate(false)}>
                      Cancel
                    </Button>
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      letter.edited ? setConfirmRegenerate(true) : letter.onGenerate?.()
                    }
                  >
                    Regenerate
                  </Button>
                )
              ) : null}
              <span className="ml-auto text-xs text-stone-500 tabular-nums">{words} words</span>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
