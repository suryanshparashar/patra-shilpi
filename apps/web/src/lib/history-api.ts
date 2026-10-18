import { requestJson, requestNoContent } from "@/lib/http";
import { historyDetailSchema, historyPageSchema, type StructuredResume } from "@/lib/schemas";

export function fetchHistoryPage(cursor: string | null) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return requestJson(`/history${query}`, historyPageSchema);
}

export function fetchHistoryItem(id: string) {
  return requestJson(`/history/${encodeURIComponent(id)}`, historyDetailSchema);
}

export function deleteHistoryItem(id: string): Promise<void> {
  return requestNoContent(`/history/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** What the user changed after the run. Fields left out are not touched on the server. */
export interface HistoryEdits {
  resume?: StructuredResume;
  reset_resume?: boolean;
  letter_index?: number;
  letter?: string;
  reset_letter?: boolean;
}

/** Save the user's edits to a run's resume or one of its cover letters. The AI versions stay. */
export function patchHistory(id: string, edits: HistoryEdits): Promise<void> {
  return requestNoContent(`/history/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(edits),
  });
}
