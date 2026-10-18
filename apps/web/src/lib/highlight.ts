import type { GuardrailIssue } from "@/lib/schemas";

export interface Range {
  start: number;
  end: number;
}

const QUOTES = /['‘’]/;

/** The first place `phrase` occurs in `text`, ignoring case, runs of whitespace and the
 * difference between straight and curly apostrophes (a model quotes loosely). */
export function findPhrase(text: string, phrase: string): Range | null {
  const tokens = phrase.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  const pattern = tokens
    .map((token) =>
      [...token]
        .map((char) => (QUOTES.test(char) ? "['‘’]" : char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
        .join(""),
    )
    .join("\\s+");
  const match = new RegExp(pattern, "i").exec(text);
  return match ? { start: match.index, end: match.index + match[0].length } : null;
}

export interface Segment {
  text: string;
  flagged: boolean;
}

/** `text` cut into pieces, with every flagged phrase marked. Overlaps are merged. */
export function segments(text: string, phrases: string[]): Segment[] {
  const ranges = phrases
    .map((phrase) => findPhrase(text, phrase))
    .filter((range): range is Range => range !== null)
    .sort((a, b) => a.start - b.start);

  const merged: Range[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }

  const out: Segment[] = [];
  let cursor = 0;
  for (const { start, end } of merged) {
    if (start > cursor) out.push({ text: text.slice(cursor, start), flagged: false });
    out.push({ text: text.slice(start, end), flagged: true });
    cursor = end;
  }
  if (cursor < text.length || out.length === 0) {
    out.push({ text: text.slice(cursor), flagged: false });
  }
  return out;
}

export type FlagState =
  /** The phrase is still in the text. */
  | "open"
  /** It was in the AI's text and has since been edited out. */
  | "resolved"
  /** It was never found in the AI's text (quoted loosely), so it can't be highlighted. */
  | "unlocated";

/** Where a flag stands now, given the AI's original text and the user's current text. */
export function flagState(current: string, original: string, issue: GuardrailIssue): FlagState {
  if (findPhrase(current, issue.claim)) return "open";
  return findPhrase(original, issue.claim) ? "resolved" : "unlocated";
}
