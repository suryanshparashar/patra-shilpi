"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  AlertIcon,
  CheckIcon,
  DownloadIcon,
  ShieldCheckIcon,
  SpinnerIcon,
  UndoIcon,
} from "@/components/icons";
import { PartialNotice } from "@/components/results/Insights";
import { ResumeView } from "@/components/results/ResumeView";
import { RunProgress } from "@/components/results/RunProgress";
import { LetterEditor, type LetterModel } from "@/components/workspace/LetterEditor";
import { ResumeEditor, type FocusRequest, type Marker } from "@/components/workspace/ResumeEditor";
import { Button } from "@/components/ui";
import { downloadResumePdf } from "@/lib/download-pdf";
import { flagState } from "@/lib/highlight";
import {
  cleanResume,
  editedLineCount,
  isUsingRewrite,
  keepOriginal,
  keepRewrite,
  locateClaim,
  restoredFieldId,
  type FieldId,
} from "@/lib/resume-edit";
import type { RevertedLine, RunResult, StructuredResume } from "@/lib/schemas";
import type { Step } from "@/lib/steps";
import type { SaveStatus } from "@/lib/use-autosave";

type Tab = "resume" | "letter" | "compare";

const SECTION_LABEL: Record<RevertedLine["section"], string> = {
  summary: "Summary",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
};

export interface WorkspaceProps {
  /** Scores, keyword gaps, the fact-check's restored lines and flags. */
  result: RunResult;
  original: StructuredResume | null;
  /** The AI's resume: what "Reset" goes back to. */
  aiResume: StructuredResume;
  /** The resume as shown and downloaded: the user's edit if there is one, else the AI's. */
  resume: StructuredResume;
  resumeEdited: boolean;
  onResumeChange: (resume: StructuredResume) => void;
  onResumeReset: () => void;
  highlightedSkills: string[];
  letters: LetterModel[];
  saveStatus: SaveStatus;
  /** Save pending edits to history right now (before a download, or to retry after an error). */
  flush: () => Promise<void>;
  steps?: Step[];
  /** Link to the saved history entry, shown on a fresh run. */
  historyHref?: string | null;
}

function Panel({
  title,
  children,
  aside,
}: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-stone-500">
        <SpinnerIcon className="size-3.5" /> Saving…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span role="status" className="flex items-center gap-1.5 text-xs text-amber-700">
        <AlertIcon className="size-3.5" /> Couldn&apos;t save to history.
        <button type="button" onClick={onRetry} className="font-semibold underline">
          Retry
        </button>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-stone-500">
      <CheckIcon className="size-3.5 text-emerald-600" />
      {status === "saved" ? "Edits saved to your history" : "Edits are kept in this tab"}
    </span>
  );
}

/** How good a score is, as colors: green from 80, amber from 60, rose below. */
function toneFor(ratio: number) {
  if (ratio >= 0.8)
    return { bar: "bg-emerald-500", stroke: "stroke-emerald-500", text: "text-emerald-700" };
  if (ratio >= 0.6)
    return { bar: "bg-amber-400", stroke: "stroke-amber-400", text: "text-amber-700" };
  return { bar: "bg-rose-400", stroke: "stroke-rose-400", text: "text-rose-700" };
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** A ring that fills to `ratio`, with the number in the middle. */
function Gauge({
  ratio,
  children,
  label,
}: {
  ratio: number;
  children: React.ReactNode;
  label: string;
}) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const tone = toneFor(ratio);
  return (
    <div role="img" aria-label={label} className="relative size-20">
      <svg viewBox="0 0 72 72" className="size-full -rotate-90">
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          strokeWidth="6"
          className="stroke-stone-200/80"
        />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamp(ratio))}
          className={`${tone.stroke} transition-[stroke-dashoffset] duration-700`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

function ScoreTile({
  title,
  ratio,
  value,
  unit,
  note,
  unavailable,
}: {
  title: string;
  ratio: number;
  value: string;
  unit?: string;
  note?: React.ReactNode;
  unavailable?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 rounded-xl bg-stone-50 px-2 py-3 ring-1 ring-stone-200/70">
      <p className="text-[11px] font-semibold tracking-wider text-stone-500 uppercase">{title}</p>
      {unavailable ? (
        <p className="px-1 py-4 text-center text-xs text-stone-500">{unavailable}</p>
      ) : (
        <>
          <Gauge ratio={ratio} label={`${title}: ${value}${unit ?? ""}`}>
            <span className="leading-none">
              <span className="text-xl font-semibold text-stone-900 tabular-nums">{value}</span>
              {unit ? <span className="text-[10px] text-stone-500">{unit}</span> : null}
            </span>
          </Gauge>
          {note}
        </>
      )}
    </div>
  );
}

function ScorePanel({ result }: { result: RunResult }) {
  const { match_before: before, match_after: after, ats_report: ats } = result;
  const failure = (worker: string) => result.errors.find((e) => e.worker === worker)?.message;
  const match = after ?? before;
  const delta = before !== null && after !== null ? after - before : null;

  return (
    <Panel title="Scores">
      <div className="grid grid-cols-2 gap-2.5">
        <ScoreTile
          title="Match"
          ratio={(match ?? 0) / 100}
          value={match === null ? "–" : String(Math.round(match))}
          unit="%"
          unavailable={match === null ? (failure("match_scorer") ?? "Not available.") : undefined}
          note={
            delta !== null ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  delta >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {delta >= 0 ? "▲ +" : "▼ "}
                {delta.toFixed(1)}
              </span>
            ) : null
          }
        />
        <ScoreTile
          title="ATS"
          ratio={(ats?.score ?? 0) / 100}
          value={ats ? String(ats.score) : "–"}
          unit="/100"
          unavailable={ats ? undefined : (failure("evaluator") ?? "Not available.")}
        />
      </div>

      {before !== null && after !== null ? (
        <p className="mt-3 flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600 ring-1 ring-stone-200/70">
          <span>Match after tailoring</span>
          <span className="font-medium text-stone-900 tabular-nums">
            {before}% <span className="text-stone-400">→</span> {after}%
          </span>
        </p>
      ) : null}

      {ats?.breakdown?.length ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold tracking-wider text-stone-500 uppercase">
            ATS breakdown
          </p>
          <dl className="space-y-2.5">
            {ats.breakdown.map((item) => {
              const ratio = clamp(item.score / item.max);
              return (
                <div key={item.name}>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <dt className="text-stone-700">{item.name}</dt>
                    <dd className={`font-medium tabular-nums ${toneFor(ratio).text}`}>
                      {item.score}
                      <span className="text-stone-400">/{item.max}</span>
                    </dd>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className={`h-full rounded-full ${toneFor(ratio).bar}`}
                      style={{ width: `${ratio * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </dl>
        </div>
      ) : null}

      {ats?.issues.length ? (
        <details className="group mt-4 rounded-lg ring-1 ring-stone-200/70">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-medium text-stone-800 hover:bg-stone-50">
            <span>
              {ats.issues.length} suggestion{ats.issues.length === 1 ? "" : "s"} to improve
            </span>
            <span className="text-stone-400 transition-transform group-open:rotate-180" aria-hidden>
              ▾
            </span>
          </summary>
          <ul className="divide-y divide-stone-100 border-t border-stone-100">
            {ats.issues.map((issue, i) => (
              <li
                key={i}
                className="flex gap-2.5 px-3 py-2.5 text-xs leading-relaxed text-stone-700"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden />
                <span className="min-w-0 wrap-anywhere">{issue}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Panel>
  );
}

export function ResultsWorkspace(props: WorkspaceProps) {
  const {
    result,
    original,
    aiResume,
    resume,
    resumeEdited,
    onResumeChange,
    onResumeReset,
    highlightedSkills,
    letters,
    saveStatus,
    flush,
    steps = [],
    historyHref,
  } = props;

  const [tab, setTab] = useState<Tab>("resume");
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [letterShow, setLetterShow] = useState<{
    index: number;
    claim: string;
    nonce: number;
  } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  const reverted = useMemo(() => result.reverted ?? [], [result.reverted]);

  const markers = useMemo(() => {
    const out: Record<FieldId, Marker[]> = {};
    const add = (id: FieldId, marker: Marker) => (out[id] ??= []).push(marker);
    for (const line of reverted) {
      const id = restoredFieldId(resume, line);
      if (!id) continue;
      if (isUsingRewrite(resume, line)) {
        add(id, {
          kind: "kept",
          text: "You kept the AI's rewrite. The fact-check could not confirm it.",
          action: { label: "Use original", run: () => onResumeChange(keepOriginal(resume, line)) },
        });
      } else {
        add(id, {
          kind: "restored",
          text: "Restored to your original: the fact-check could not confirm the rewrite.",
          action: { label: "Use rewrite", run: () => onResumeChange(keepRewrite(resume, line)) },
        });
      }
    }
    for (const issue of result.guardrail_issues) {
      const at = locateClaim(resume, issue);
      if (at) add(at.id, { kind: "flag", text: issue.reason });
    }
    return out;
  }, [reverted, resume, result.guardrail_issues, onResumeChange]);

  function show(id: FieldId, range: FocusRequest["range"]) {
    setTab("resume");
    setFocus({ id, range, nonce: Date.now() });
  }

  function showInLetter(index: number, claim: string) {
    setTab("letter");
    setLetterShow({ index, claim, nonce: Date.now() });
  }

  async function download() {
    setDownloading(true);
    setDownloadError(false);
    try {
      await flush();
      await downloadResumePdf(cleanResume(resume));
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  }

  const tabs: { id: Tab; label: string; badge?: string }[] = [
    { id: "resume", label: "Resume" },
    { id: "letter", label: "Cover letter" },
    { id: "compare", label: "Compare original" },
  ];

  return (
    <div className="space-y-4">
      {historyHref ? (
        <p className="text-sm text-stone-600">
          Saved to your history.{" "}
          <Link href={historyHref} className="font-medium text-emerald-700 hover:underline">
            View it there
          </Link>
        </p>
      ) : null}
      <PartialNotice result={result} />
      {result.status === "partial" && steps.length > 0 ? (
        <details open className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-stone-900">
            Run steps
          </summary>
          <div className="mt-4">
            <RunProgress steps={steps} bare />
          </div>
        </details>
      ) : null}

      <div
        role="tablist"
        aria-label="Documents"
        className="flex gap-1 rounded-xl bg-stone-200/60 p-1 sm:w-fit"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-4 py-1.5 text-sm font-medium whitespace-nowrap sm:flex-none ${
              tab === t.id
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          {tab === "resume" ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-stone-600">
                  Click any text to edit it. The PDF uses exactly what you see here.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {resumeEdited ? (
                    confirmReset ? (
                      <span className="flex items-center gap-2 text-sm text-stone-600">
                        Discard your edits?
                        <Button
                          variant="secondary"
                          onClick={() => {
                            onResumeReset();
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
                  <Button onClick={() => void download()} disabled={downloading}>
                    {downloading ? <SpinnerIcon /> : <DownloadIcon />}
                    Download PDF
                  </Button>
                </div>
              </div>
              {downloadError ? (
                <p role="alert" className="text-xs text-red-600">
                  Could not create the PDF. Please try again.
                </p>
              ) : null}
              <ResumeEditor
                resume={resume}
                onChange={onResumeChange}
                highlightedSkills={highlightedSkills}
                markers={markers}
                focus={focus}
              />
            </>
          ) : null}

          {tab === "letter" ? (
            <div className="space-y-8">
              {letters.map((letter, i) => (
                <LetterEditor
                  key={i}
                  letter={letter}
                  name={resume.contact.name}
                  beforeDownload={flush}
                  label={letters.length > 1 ? letter.label : undefined}
                  showRequest={letterShow?.index === i ? letterShow : null}
                />
              ))}
            </div>
          ) : null}

          {tab === "compare" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <section className="min-w-0 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
                <h2 className="mb-3 text-sm font-semibold text-stone-900">Original</h2>
                {original ? (
                  <ResumeView resume={original} />
                ) : (
                  <p className="text-sm text-stone-500">The original could not be displayed.</p>
                )}
              </section>
              <section className="min-w-0 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-emerald-200">
                <h2 className="mb-3 text-sm font-semibold text-stone-900">
                  Your resume {resumeEdited ? "(edited)" : ""}
                </h2>
                <ResumeView resume={resume} highlightedSkills={highlightedSkills} />
              </section>
            </div>
          ) : null}
        </div>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-6">
          <Panel title="Your edits">
            <SaveIndicator status={saveStatus} onRetry={() => void flush()} />
          </Panel>

          <ScorePanel result={result} />

          {tab === "letter" ? (
            <LetterFactCheckPanel letters={letters} onShow={showInLetter} />
          ) : (
            <FactCheckPanel
              reverted={reverted}
              resume={resume}
              aiResume={aiResume}
              issues={result.guardrail_issues}
              onResumeChange={onResumeChange}
              onShow={show}
            />
          )}

          {result.keyword_gap ? (
            <KeywordsPanel keywords={result.keyword_gap.missing_keywords} />
          ) : null}
        </aside>
      </div>
    </div>
  );
}

type MissingKeyword = NonNullable<RunResult["keyword_gap"]>["missing_keywords"][number];

/** Terms from the job the resume doesn't show, as chips in two groups. Pick a chip to read the
 * advice for it; nothing is added to the resume for you. */
function KeywordsPanel({ keywords }: { keywords: MissingKeyword[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const required = keywords.filter((k) => k.importance === "required");
  const preferred = keywords.filter((k) => k.importance !== "required");
  const chosen = keywords.find((k) => k.keyword === selected) ?? null;

  if (keywords.length === 0) {
    return (
      <Panel title="Missing keywords">
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 ring-1 ring-emerald-200">
          <CheckIcon className="size-4 shrink-0" />
          Nothing important is missing. Nice match.
        </p>
      </Panel>
    );
  }

  const group = (title: string, items: MissingKeyword[], tone: "required" | "preferred") =>
    items.length ? (
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-stone-500 uppercase">
          <span
            className={`size-1.5 rounded-full ${tone === "required" ? "bg-amber-400" : "bg-stone-300"}`}
            aria-hidden
          />
          {title} <span className="font-normal text-stone-400">{items.length}</span>
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item) => {
            const active = item.keyword === selected;
            return (
              <li key={item.keyword}>
                <button
                  type="button"
                  aria-expanded={active}
                  onClick={() => setSelected(active ? null : item.keyword)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-colors ${
                    active
                      ? "bg-stone-900 text-white ring-stone-900"
                      : tone === "required"
                        ? "bg-amber-50 text-amber-900 ring-amber-200 hover:bg-amber-100"
                        : "bg-stone-50 text-stone-700 ring-stone-200 hover:bg-stone-100"
                  }`}
                >
                  {item.keyword}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    ) : null;

  return (
    <Panel
      title="Missing keywords"
      aside={
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
          {keywords.length}
        </span>
      }
    >
      <p className="text-xs leading-relaxed text-stone-500">
        Terms from the job your resume doesn&apos;t show. Add one only if it is true for you.
      </p>
      <div className="mt-3 space-y-3.5">
        {group("Required", required, "required")}
        {group("Preferred", preferred, "preferred")}
      </div>
      {chosen ? (
        <div
          role="region"
          aria-label={`Advice for ${chosen.keyword}`}
          className="mt-3.5 rounded-lg bg-stone-50 p-3 ring-1 ring-stone-200/70"
        >
          <p className="text-xs font-semibold text-stone-900">
            {chosen.keyword}
            <span className="ml-1.5 font-normal text-stone-500">· {chosen.importance}</span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-stone-600">{chosen.suggestion}</p>
        </div>
      ) : (
        <p className="mt-3.5 text-[11px] text-stone-400">
          Select a keyword to see where it could go.
        </p>
      )}
    </Panel>
  );
}

function FactCheckPanel({
  reverted,
  resume,
  aiResume,
  issues,
  onResumeChange,
  onShow,
}: {
  reverted: RevertedLine[];
  resume: StructuredResume;
  aiResume: StructuredResume;
  issues: RunResult["guardrail_issues"];
  onResumeChange: (resume: StructuredResume) => void;
  onShow: (id: FieldId, range: FocusRequest["range"]) => void;
}) {
  const nothing = reverted.length === 0 && issues.length === 0;
  const edited = editedLineCount(aiResume, resume);
  return (
    <Panel title="Fact-check">
      <div className="mb-3 space-y-1.5">
        <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <ShieldCheckIcon className="size-3.5" /> AI version fact-checked
        </p>
        {edited > 0 ? (
          <p className="rounded-md bg-stone-50 px-2.5 py-1.5 text-xs text-stone-600 ring-1 ring-stone-200">
            {edited} line{edited === 1 ? "" : "s"} edited by you. Your own edits are not
            fact-checked.
          </p>
        ) : null}
      </div>
      {nothing ? (
        <p className="text-xs text-stone-600">
          {edited > 0
            ? "Nothing in the AI's version was unsupported by your original."
            : "Every line is supported by your original."}
        </p>
      ) : (
        <div className="space-y-4">
          {reverted.length ? (
            <div>
              <p className="text-xs font-medium text-stone-800">
                Restored to your original ({reverted.length})
              </p>
              <p className="mt-0.5 text-xs text-stone-500">
                The fact-check could not confirm these rewrites, so your wording is used.
              </p>
              <ul className="mt-2 space-y-3">
                {reverted.map((line, i) => {
                  const using = isUsingRewrite(resume, line);
                  const at = restoredFieldId(resume, line);
                  return (
                    <li key={i} className="text-xs wrap-anywhere">
                      <p className="font-medium text-stone-500">{SECTION_LABEL[line.section]}</p>
                      <p className={using ? "text-stone-400 line-through" : "text-stone-900"}>
                        {line.original ??
                          (line.skill ? `“${line.skill}” removed` : "Line removed (no source)")}
                      </p>
                      <p className={using ? "text-stone-900" : "text-stone-400 line-through"}>
                        Rewrite: “{line.rewrite}”
                      </p>
                      <p className="mt-0.5 text-stone-500">{line.reason}</p>
                      <div className="mt-1 flex gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            onResumeChange(
                              using ? keepOriginal(resume, line) : keepRewrite(resume, line),
                            )
                          }
                          className="font-semibold text-emerald-700 hover:underline"
                        >
                          {using ? "Use original" : "Use rewrite"}
                        </button>
                        {at ? (
                          <button
                            type="button"
                            onClick={() => onShow(at, null)}
                            className="font-semibold text-stone-600 hover:underline"
                          >
                            Show
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {issues.length ? (
            <div>
              <p className="text-xs font-medium text-stone-800">To review ({issues.length})</p>
              <p className="mt-0.5 text-xs text-stone-500">
                Text your original may not support. Edit it or keep it if it is true.
              </p>
              <ul className="mt-2 space-y-3">
                {issues.map((issue, i) => {
                  const now = locateClaim(resume, issue);
                  const wasThere = locateClaim(aiResume, issue);
                  const state = now ? "open" : wasThere ? "resolved" : "unlocated";
                  return (
                    <li key={i} className="text-xs wrap-anywhere">
                      <p
                        className={
                          state === "resolved" ? "line-through opacity-60" : "text-stone-900"
                        }
                      >
                        <span className="mr-1.5 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800 capitalize">
                          {issue.section}
                        </span>
                        “{issue.claim}”
                      </p>
                      <p className="mt-0.5 text-stone-500">
                        {state === "resolved" ? "Edited out." : issue.reason}
                      </p>
                      {now ? (
                        <button
                          type="button"
                          onClick={() => onShow(now.id, now.range)}
                          className="mt-1 font-semibold text-emerald-700 hover:underline"
                        >
                          Show
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

export function LetterFactCheckPanel({
  letters,
  onShow,
}: {
  letters: LetterModel[];
  onShow: (index: number, claim: string) => void;
}) {
  const written = letters.map((letter, index) => ({ letter, index })).filter((l) => l.letter.text);
  if (written.length === 0) {
    return (
      <Panel title="Fact-check">
        <p className="text-xs leading-relaxed text-stone-600">
          A cover letter is checked against your original resume as soon as it is written, and any
          claim your resume doesn&apos;t support is flagged here and highlighted in the letter.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Fact-check">
      <div className="space-y-5">
        {written.map(({ letter, index }) => {
          const states = letter.issues.map((issue) => ({
            issue,
            state: flagState(letter.text, letter.aiText, issue),
          }));
          const toReview = states.filter((s) => s.state !== "resolved").length;
          const edited = letter.edited && letter.text !== letter.aiText;
          return (
            <div key={index} className="space-y-2">
              {written.length > 1 ? (
                <p className="text-xs font-semibold text-stone-900">{letter.label}</p>
              ) : null}

              {!letter.factChecked ? (
                <p className="flex items-start gap-1.5 text-xs font-medium text-amber-800">
                  <AlertIcon className="mt-0.5 size-3.5 shrink-0" />
                  Not fact-checked. Read this letter carefully before you send it.
                </p>
              ) : toReview > 0 ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                  <AlertIcon className="size-3.5" />
                  {toReview} claim{toReview === 1 ? "" : "s"} to review
                </p>
              ) : (
                <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <ShieldCheckIcon className="size-3.5" />
                  {states.length > 0
                    ? "All flagged phrases edited out"
                    : "AI letter fact-checked · nothing flagged"}
                </p>
              )}

              {edited ? (
                <p className="rounded-md bg-stone-50 px-2.5 py-1.5 text-xs text-stone-600 ring-1 ring-stone-200">
                  Edited by you. Your own edits are not fact-checked.
                </p>
              ) : null}

              {states.length > 0 ? (
                <ul className="space-y-2.5">
                  {states.map(({ issue, state }, i) => (
                    <li key={i} className="text-xs wrap-anywhere">
                      <p
                        className={
                          state === "resolved" ? "line-through opacity-60" : "text-stone-900"
                        }
                      >
                        “{issue.claim}”
                      </p>
                      <p className="mt-0.5 text-stone-500">
                        {state === "resolved"
                          ? "Edited out."
                          : state === "unlocated"
                            ? `${issue.reason} (Not found word for word. Look for it in the letter.)`
                            : issue.reason}
                      </p>
                      {state === "open" ? (
                        <button
                          type="button"
                          onClick={() => onShow(index, issue.claim)}
                          className="mt-1 font-semibold text-emerald-700 hover:underline"
                        >
                          Show in letter
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
