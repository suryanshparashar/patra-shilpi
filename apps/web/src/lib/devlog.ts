/** A readable step-by-step trail in the browser console, mirroring the API's console trail.
 *
 *   [STREAM] request started  {sections: ["summary"]}
 *   [STEP]   Analyzing the job description · done in 1.5s
 *
 * Only active in development, or when NEXT_PUBLIC_DEVLOG=true. Never pass personal data
 * (resume or job description text); pass sizes, ids and codes. */

export type DevTag = "API" | "STREAM" | "STEP" | "AUTH";

const COLOURS: Record<DevTag, string> = {
  API: "#0891b2",
  STREAM: "#2563eb",
  STEP: "#059669",
  AUTH: "#c026d3",
};

const enabled = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEVLOG === "true";

export function devlog(tag: DevTag, message: string, data?: Record<string, unknown>): void {
  if (!enabled || typeof console === "undefined") return;
  const style = `color:${COLOURS[tag]};font-weight:600`;
  if (data) console.log(`%c[${tag}]`, style, message, data);
  else console.log(`%c[${tag}]`, style, message);
}

export function seconds(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}
