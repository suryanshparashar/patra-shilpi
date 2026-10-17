const origin = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

/** Every backend route lives under /api/v1; the prefix exists only here, never in page URLs. */
export const API_BASE_URL = `${origin}/api/v1`;

/** The YouTube video on /demo-video, from NEXT_PUBLIC_DEMO_VIDEO_ID: a video ID or any common
 * YouTube link (watch, youtu.be, embed, shorts). Null when unset or unrecognised. */
export const DEMO_VIDEO_ID = youTubeId(process.env.NEXT_PUBLIC_DEMO_VIDEO_ID);

function youTubeId(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const id = /^[\w-]{11}$/.test(raw)
    ? raw
    : raw.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([\w-]{11})/)?.[1];
  return id ?? null;
}
