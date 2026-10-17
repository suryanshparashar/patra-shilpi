/** A resume page drawn in thin lines: a sheet, a heading bar and a few text lines. */
function Sheet({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 160 200" fill="none" className={className} aria-hidden>
      {/* the sheet behind */}
      <rect
        x="28"
        y="8"
        width="124"
        height="164"
        rx="10"
        className="stroke-stone-300"
        strokeWidth="1.5"
      />
      {/* the sheet in front */}
      <rect
        x="8"
        y="28"
        width="124"
        height="164"
        rx="10"
        className="fill-white stroke-stone-300"
        strokeWidth="1.5"
      />
      <rect x="24" y="48" width="56" height="8" rx="4" className="fill-emerald-200" />
      <path
        d="M24 72h92M24 86h80M24 100h88M24 124h56M24 138h92M24 152h72"
        className="stroke-stone-200"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Quiet decoration behind a section: a fading dot grid, two soft emerald glows and, optionally,
 * resume sheets in the corners. Place inside a `relative isolate overflow-hidden` parent. */
// Full class names so Tailwind generates them.
const SHEETS_FROM = { lg: "lg:block", xl: "xl:block" } as const;

export function BackgroundGraphics({
  sheets = false,
  sheetsFrom = "lg",
}: {
  sheets?: boolean;
  /** The breakpoint where the corner sheets appear: later on pages with a wide central card. */
  sheetsFrom?: keyof typeof SHEETS_FROM;
}) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {/* faint dot grid, fading out toward the edges */}
      <svg className="absolute inset-0 h-full w-full [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] text-stone-300">
        <defs>
          <pattern id="bg-dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.2" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg-dots)" />
      </svg>

      {/* two soft emerald glows */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <radialGradient id="bg-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="18" cy="12" rx="38" ry="30" fill="url(#bg-glow)" />
        <ellipse cx="86" cy="92" rx="40" ry="32" fill="url(#bg-glow)" />
      </svg>

      {sheets ? (
        <>
          {/* resume sheets in the corners, only where there is room */}
          <Sheet
            className={`absolute bottom-10 left-[6%] hidden w-36 -rotate-6 opacity-70 ${SHEETS_FROM[sheetsFrom]}`}
          />
          <Sheet
            className={`absolute top-12 right-[7%] hidden w-28 rotate-6 opacity-50 ${SHEETS_FROM[sheetsFrom]}`}
          />
        </>
      ) : null}
    </div>
  );
}
