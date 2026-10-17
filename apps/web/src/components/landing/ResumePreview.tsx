import { ShieldCheckIcon, TrendingUpIcon } from "@/components/icons";

function Bar({ className }: { className: string }) {
  return <div className={`h-2 rounded-full bg-stone-200 ${className}`} />;
}

const SKILLS: { label: string; matched: boolean }[] = [
  { label: "Python", matched: true },
  { label: "FastAPI", matched: true },
  { label: "MongoDB", matched: true },
  { label: "Figma", matched: false },
  { label: "Go", matched: false },
];

/** An illustrative tailored resume with the kind of results the app shows. Decorative only. */
export function ResumePreview() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-sm select-none">
      <div className="rotate-1 rounded-2xl border border-stone-200 bg-white p-6 shadow-xl shadow-stone-200/60">
        {/* header */}
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">
            SP
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-28 rounded-full bg-stone-800" />
            <Bar className="w-40" />
          </div>
        </div>

        {/* summary */}
        <p className="mt-5 text-[10px] font-semibold tracking-wider text-stone-400 uppercase">
          Summary
        </p>
        <div className="mt-2 space-y-1.5">
          <Bar className="w-full" />
          <Bar className="w-11/12" />
          <Bar className="w-3/4" />
        </div>

        {/* skills */}
        <p className="mt-5 text-[10px] font-semibold tracking-wider text-stone-400 uppercase">
          Skills
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SKILLS.map((skill) => (
            <span
              key={skill.label}
              className={`rounded-md px-2 py-0.5 text-[11px] ${
                skill.matched
                  ? "bg-emerald-100 font-medium text-emerald-800"
                  : "bg-stone-100 text-stone-600"
              }`}
            >
              {skill.label}
            </span>
          ))}
        </div>

        {/* experience */}
        <p className="mt-5 text-[10px] font-semibold tracking-wider text-stone-400 uppercase">
          Experience
        </p>
        <div className="mt-2 space-y-2">
          {["w-10/12", "w-9/12", "w-11/12"].map((width) => (
            <div key={width} className="flex items-center gap-2">
              <span className="size-1.5 shrink-0 rounded-full bg-stone-300" />
              <Bar className={width} />
            </div>
          ))}
        </div>
      </div>

      {/* result badges */}
      <div className="absolute -top-4 -right-3 flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 shadow-md sm:-right-8">
        <span className="grid size-6 place-items-center rounded-md bg-emerald-50 text-emerald-700">
          <TrendingUpIcon className="size-3.5" />
        </span>
        <div className="leading-tight">
          <p className="text-[10px] text-stone-500">Match</p>
          <p className="text-xs font-semibold text-stone-900">
            61% <span className="text-stone-400">→</span> 74%
          </p>
        </div>
      </div>
      <div className="absolute -bottom-4 -left-3 flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 shadow-md sm:-left-8">
        <span className="grid size-6 place-items-center rounded-md bg-emerald-50 text-emerald-700">
          <ShieldCheckIcon className="size-3.5" />
        </span>
        <div className="leading-tight">
          <p className="text-[10px] text-stone-500">Fact-check</p>
          <p className="text-xs font-semibold text-stone-900">Nothing invented</p>
        </div>
      </div>
    </div>
  );
}
