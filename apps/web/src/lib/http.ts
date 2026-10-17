import type { z } from "zod";

import { API_BASE_URL } from "@/lib/config";
import { devlog } from "@/lib/devlog";
import { errorEnvelopeSchema } from "@/lib/schemas";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 0,
    /** The LLM provider's error code, e.g. "429 RESOURCE_EXHAUSTED", when a step failed. */
    readonly detail: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function toApiError(res: Response): Promise<ApiError> {
  try {
    const parsed = errorEnvelopeSchema.safeParse(await res.json());
    if (parsed.success) {
      return new ApiError(parsed.data.error.code, parsed.data.error.message, res.status);
    }
  } catch {
    // fall through to the generic message
  }
  return new ApiError("HTTP_ERROR", "The server returned an unexpected response.", res.status);
}

// --- Session refresh --------------------------------------------------------------------
// When the API answers 401 TOKEN_EXPIRED (or TOKEN_INVALID), refresh the session once and retry
// the request once. If the refresh fails the API has already wiped the cookies, so listeners are
// told the user is logged out.

type Listener = () => void;
const sessionLostListeners = new Set<Listener>();

export function onSessionLost(listener: Listener): () => void {
  sessionLostListeners.add(listener);
  return () => sessionLostListeners.delete(listener);
}

let refreshing: Promise<boolean> | null = null;
/** Counts successful refreshes, so a request can tell whether the session was renewed while
 * it was in flight (its 401 is then stale: just retry, don't refresh again). */
let epoch = 0;

/** One refresh at a time: parallel 401s share the same attempt. */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_BASE_URL}/auth/refresh`, { method: "POST", credentials: "include" })
    .then((res) => {
      if (res.ok) epoch++;
      devlog("AUTH", res.ok ? "session refreshed" : "session refresh failed", {
        status: res.status,
      });
      return res.ok;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function isSessionExpired(res: Response): Promise<boolean> {
  if (res.status !== 401) return false;
  try {
    const parsed = errorEnvelopeSchema.safeParse(await res.clone().json());
    return (
      parsed.success &&
      (parsed.data.error.code === "TOKEN_EXPIRED" || parsed.data.error.code === "TOKEN_INVALID")
    );
  } catch {
    return false;
  }
}

/** fetch against the API with cookies, refreshing an expired session transparently. */
export async function fetchApi(path: string, init: RequestInit = {}): Promise<Response> {
  const send = () => fetch(`${API_BASE_URL}${path}`, { credentials: "include", ...init });

  const startedAt = epoch;
  let res: Response;
  try {
    res = await send();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("NETWORK_ERROR", "Could not reach the server. Check your connection.");
  }

  if (await isSessionExpired(res)) {
    if (epoch !== startedAt || (await refreshSession())) return send();
    devlog("AUTH", "session lost");
    sessionLostListeners.forEach((listener) => listener());
    return res; // the original 401 TOKEN_EXPIRED, now with the cookies cleared
  }
  return res;
}

export async function requestJson<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetchApi(path, init);
  if (!res.ok) throw await toApiError(res);
  return schema.parse(await res.json());
}

export async function requestNoContent(path: string, init: RequestInit = {}): Promise<void> {
  const res = await fetchApi(path, init);
  if (!res.ok) throw await toApiError(res);
}

export function jsonBody(value: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  };
}
