"use client";

import { useState, type InputHTMLAttributes } from "react";

import { EyeIcon, EyeOffIcon } from "@/components/icons";

type Tone = "neutral" | "error" | "success";

const HINT_TONE: Record<Tone, string> = {
  neutral: "text-stone-500",
  error: "text-red-600",
  success: "text-emerald-700",
};

/** A labelled input with an optional hint line and, for passwords, a show/hide toggle. */
export function Field({
  id,
  label,
  hint,
  tone = "neutral",
  type = "text",
  ...input
}: {
  id: string;
  label: string;
  hint?: string | null;
  tone?: Tone;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id">) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-stone-800">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type={isPassword && visible ? "text" : type}
          aria-invalid={tone === "error"}
          aria-describedby={hintId}
          className={`block h-10 w-full rounded-lg border bg-white px-3 text-sm text-stone-900 transition placeholder:text-stone-400 focus:ring-4 focus:outline-none disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-50 disabled:placeholder:text-stone-300 ${
            tone === "error"
              ? "border-red-300 focus:border-red-400 focus:ring-red-500/10"
              : "border-stone-200 hover:border-stone-300 focus:border-emerald-500 focus:ring-emerald-500/15"
          } ${isPassword ? "pr-10" : ""}`}
          {...input}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            disabled={input.disabled}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-md text-stone-400 transition hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        ) : null}
      </div>
      {hint ? (
        <p
          id={hintId}
          role={tone === "error" ? "alert" : undefined}
          className={`mt-1.5 text-xs ${HINT_TONE[tone]}`}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
