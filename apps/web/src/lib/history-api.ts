import { requestJson, requestNoContent } from "@/lib/http";
import { historyDetailSchema, historyPageSchema } from "@/lib/schemas";

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
