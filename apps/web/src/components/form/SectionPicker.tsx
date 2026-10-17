import { SECTIONS, SECTION_INFO, type Section } from "@/lib/schemas";

export function SectionPicker({
  value,
  onChange,
  error,
}: {
  value: Section[];
  onChange: (value: Section[]) => void;
  error?: string;
}) {
  function toggle(section: Section) {
    onChange(value.includes(section) ? value.filter((s) => s !== section) : [...value, section]);
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium text-stone-900">Sections to customize</legend>
      <p className="mt-0.5 text-sm text-stone-500">
        Untouched sections stay exactly as you wrote them.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {SECTIONS.map((section) => {
          const checked = value.includes(section);
          return (
            <label
              key={section}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-emerald-600 ${
                checked
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-stone-300 bg-white hover:border-stone-400"
              }`}
            >
              <input
                id={`section-${section}`}
                type="checkbox"
                checked={checked}
                onChange={() => toggle(section)}
                className="mt-1 size-4 accent-emerald-600"
              />
              <span>
                <span className="block text-sm font-medium text-stone-900">
                  {SECTION_INFO[section].label}
                </span>
                <span className="block text-xs text-stone-500">{SECTION_INFO[section].hint}</span>
              </span>
            </label>
          );
        })}
      </div>
      <p role="alert" className="mt-1 min-h-4 text-xs text-red-600">
        {error}
      </p>
    </fieldset>
  );
}
