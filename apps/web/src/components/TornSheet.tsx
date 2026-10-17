// The tear runs top to bottom as a hand-tuned zig-zag. Both halves share these points, so the
// edges match exactly; the right half is then nudged away and tilted so the gap reads.
const TEAR_DOWN =
  "L153 43 L138 66 L146 89 L131 112 L140 135 L125 158 L134 181 L118 204 L127 227 L118 250";
const TEAR_UP = "L127 227 L118 204 L134 181 L125 158 L140 135 L131 112 L146 89 L138 66 L153 43";

// Left half: rounded left corners. Right half: rounded bottom-right, folded top-right corner.
const LEFT = `M52 20 H150 ${TEAR_DOWN} H52 Q40 250 40 238 V32 Q40 20 52 20 Z`;
const RIGHT = `M150 20 H210 L230 40 V238 Q230 250 218 250 H118 ${TEAR_UP} Z`;

const LINES: [number, number, string][] = [
  // [y, width, colour]: text lines on the sheet; the darker one is a sub-heading
  [96, 150, "#e7e5e4"],
  [114, 120, "#e7e5e4"],
  [132, 140, "#e7e5e4"],
  [164, 90, "#d6d3d1"],
  [182, 150, "#e7e5e4"],
  [200, 130, "#e7e5e4"],
  [218, 110, "#e7e5e4"],
];

/** A resume sheet torn in two, with "404" in its heading. Decorative. */
export function TornSheet({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 280 280" fill="none" className={className} aria-hidden>
      <defs>
        {/* The sheet's content, drawn once and clipped to each half, so the tear cuts through it. */}
        <g id="torn-content">
          <text x="60" y="76" fontSize="40" fontWeight="700" fill="#059669" letterSpacing="-1">
            404
          </text>
          {LINES.map(([y, width, colour]) => (
            <rect key={y} x="60" y={y} width={width} height="8" rx="4" fill={colour} />
          ))}
        </g>
        <clipPath id="torn-left">
          <path d={LEFT} />
        </clipPath>
        <clipPath id="torn-right">
          <path d={RIGHT} />
        </clipPath>
      </defs>

      {/* soft ground shadow */}
      <ellipse cx="140" cy="264" rx="96" ry="7" fill="#1c1917" opacity="0.06" />

      {/* left half */}
      <path d={LEFT} fill="#ffffff" stroke="#d6d3d1" strokeWidth="1.5" strokeLinejoin="round" />
      <g clipPath="url(#torn-left)">
        <use href="#torn-content" />
      </g>

      {/* right half, pulled away and tilted */}
      <g transform="translate(16 8) rotate(5 185 135)">
        <path d={RIGHT} fill="#ffffff" stroke="#d6d3d1" strokeWidth="1.5" strokeLinejoin="round" />
        <g clipPath="url(#torn-right)">
          <use href="#torn-content" />
        </g>
        {/* the folded corner */}
        <path
          d="M210 20 V36 Q210 40 214 40 H230 Z"
          fill="#a7f3d0"
          stroke="#d6d3d1"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
