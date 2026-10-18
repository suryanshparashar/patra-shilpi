"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type KeyboardEvent } from "react";

export type Tone = "restored" | "kept" | "flag" | null;

const TONE: Record<Exclude<Tone, null>, string> = {
  restored: "bg-emerald-50 ring-1 ring-emerald-200",
  kept: "bg-amber-50 ring-1 ring-amber-200",
  flag: "bg-amber-50 ring-2 ring-amber-300",
};

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Read out by screen readers, e.g. "Experience 1, bullet 2". */
  label: string;
  className?: string;
  placeholder?: string;
  tone?: Tone;
  /** Off for names, places, dates and other proper nouns the dictionary would underline. */
  spellCheck?: boolean;
  /** Called on Enter (the field is single-paragraph, so Enter never inserts a line break). */
  onEnter?: () => void;
  /** Lets the editor find and focus this field (for "Show" on a flag). */
  fieldId?: string;
}

/** Text that reads like the document until you touch it: a textarea with no chrome that grows
 * with its content, outlined on hover and focus. */
export function EditableText({
  value,
  onChange,
  label,
  className = "",
  placeholder,
  tone = null,
  spellCheck = true,
  onEnter,
  fieldId,
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const fit = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, []);

  useLayoutEffect(fit, [value, fit]);

  // The text rewraps when the column gets wider or narrower.
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth !== width) {
        width = element.clientWidth;
        fit();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [fit]);

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onEnter?.();
  }

  return (
    <textarea
      ref={ref}
      data-field-id={fieldId}
      rows={1}
      value={value}
      aria-label={label}
      placeholder={placeholder}
      spellCheck={spellCheck}
      onChange={(event) => onChange(event.target.value.replace(/\n/g, " "))}
      onKeyDown={onKeyDown}
      className={`-mx-1.5 block w-[calc(100%+0.75rem)] resize-none overflow-hidden rounded-md border-0 px-1.5 py-0.5 text-inherit transition-colors outline-none placeholder:text-stone-400 hover:bg-stone-100/70 focus:bg-white focus:ring-2 focus:ring-emerald-500/60 ${
        tone ? TONE[tone] : ""
      } ${className}`}
    />
  );
}
