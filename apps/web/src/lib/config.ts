const origin = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

/** Every backend route lives under /api/v1; the prefix exists only here, never in page URLs. */
export const API_BASE_URL = `${origin}/api/v1`;
