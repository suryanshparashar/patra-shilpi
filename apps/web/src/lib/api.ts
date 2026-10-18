import { devlog, seconds } from "@/lib/devlog";
import { ApiError, fetchApi, toApiError } from "@/lib/http";
import {
  errorEventSchema,
  type JDAnalysis,
  planEventSchema,
  progressEventSchema,
  runResultSchema,
  tokenEventSchema,
  type Section,
  type StreamEvent,
  type StructuredResume,
} from "@/lib/schemas";
import { parseSse, type RawSseEvent } from "@/lib/sse";

function toStreamEvent(raw: RawSseEvent): StreamEvent | null {
  const json: unknown = JSON.parse(raw.data);
  switch (raw.event) {
    case "plan":
      return { kind: "plan", steps: planEventSchema.parse(json).steps };
    case "progress":
      return { kind: "progress", data: progressEventSchema.parse(json) };
    case "token": {
      const t = tokenEventSchema.parse(json);
      return { kind: "token", worker: t.worker, text: t.text };
    }
    case "token_reset":
      return { kind: "token_reset" };
    case "result":
      return { kind: "result", data: runResultSchema.parse(json) };
    case "error":
      return { kind: "error", ...errorEventSchema.parse(json) };
    default:
      return null;
  }
}

async function* streamPost(path: string, init: RequestInit): AsyncGenerator<StreamEvent> {
  const started = performance.now();
  devlog("STREAM", `POST ${path}`);
  const res = await fetchApi(path, { method: "POST", ...init });
  if (!res.ok) {
    const error = await toApiError(res);
    devlog("API", `POST ${path} rejected`, { status: res.status, code: error.code });
    throw error;
  }
  if (!res.body) throw new ApiError("HTTP_ERROR", "The server sent an empty response.");
  devlog("STREAM", "stream opened", { status: res.status });

  for await (const raw of parseSse(res.body)) {
    const event = toStreamEvent(raw);
    if (!event) continue;
    if (event.kind === "plan") devlog("STREAM", "plan", { steps: event.steps.map((s) => s.id) });
    if (event.kind === "result") {
      devlog("STREAM", "result", {
        status: event.data.status,
        took: seconds(performance.now() - started),
      });
    }
    if (event.kind === "error") devlog("STREAM", "error event", { code: event.code });
    yield event;
  }
}

export interface CustomizeRequest {
  jdText: string;
  sections: Section[];
  file: File;
  fingerprint: string;
}

export function streamCustomize(
  req: CustomizeRequest,
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const form = new FormData();
  form.append("jd_text", req.jdText);
  for (const section of req.sections) form.append("sections", section);
  form.append("fingerprint", req.fingerprint);
  form.append("resume", req.file);
  return streamPost("/customize", { body: form, signal });
}

export function streamCoverLetter(
  req: {
    jdText: string;
    resume: StructuredResume;
    /** The resume as parsed, before tailoring: what the letter is fact-checked against. */
    originalResume: StructuredResume | null;
    jdAnalysis: JDAnalysis | null;
    runId: string | null;
  },
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  return streamPost("/cover-letter", {
    body: JSON.stringify({
      jd_text: req.jdText,
      customized_resume: req.resume,
      original_resume: req.originalResume,
      jd_analysis: req.jdAnalysis,
      run_id: req.runId,
    }),
    headers: { "Content-Type": "application/json" },
    signal,
  });
}

/** Run a saved history entry again with different sections (no PDF upload needed). */
export function streamRerun(
  runId: string,
  sections: Section[],
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const form = new FormData();
  for (const section of sections) form.append("sections", section);
  return streamPost(`/history/${encodeURIComponent(runId)}/rerun`, { body: form, signal });
}
