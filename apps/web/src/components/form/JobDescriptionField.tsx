import { JD_MAX_CHARS, JD_MIN_CHARS } from "@/lib/schemas";

export function JobDescriptionField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const length = value.trim().length;
  const tooShort = length > 0 && length < JD_MIN_CHARS;
  const tooLong = length > JD_MAX_CHARS;

  return (
    <div>
      <label htmlFor="jd" className="block text-sm font-medium text-stone-900">
        Job description
      </label>
      <p id="jd-hint" className="mt-0.5 text-sm text-stone-500">
        Paste the full posting: responsibilities, requirements and nice-to-haves.
      </p>
      <textarea
        id="jd"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "jd-error jd-hint" : "jd-hint"}
        placeholder="We are looking for a backend engineer to…"
        className={`mt-2 w-full resize-y rounded-lg border bg-white px-3 py-2 text-sm text-stone-900 shadow-sm placeholder:text-stone-400 focus:outline-2 focus:outline-offset-0 focus:outline-emerald-600 ${
          error ? "border-red-400" : "border-stone-300"
        }`}
      />
      <div className="mt-1 flex items-start justify-between gap-4 text-xs">
        <p id="jd-error" role="alert" className="text-red-600">
          {error}
        </p>
        <p className={`shrink-0 ${tooShort || tooLong ? "text-amber-600" : "text-stone-500"}`}>
          {length.toLocaleString()} / {JD_MAX_CHARS.toLocaleString()} characters
          {tooShort ? ` (min ${JD_MIN_CHARS})` : ""}
        </p>
      </div>
    </div>
  );
}
