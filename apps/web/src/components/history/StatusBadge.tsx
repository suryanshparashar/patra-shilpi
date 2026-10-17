import type { HistoryItem } from "@/lib/schemas";

const STYLES: Record<HistoryItem["status"], { label: string; className: string }> = {
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-800" },
  partial: { label: "Partial", className: "bg-amber-100 text-amber-800" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800" },
};

export function StatusBadge({ status }: { status: HistoryItem["status"] }) {
  const { label, className } = STYLES[status];
  return <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
