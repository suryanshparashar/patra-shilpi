"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { formatDate, StatusBadge } from "@/components/history/StatusBadge";
import { SpinnerIcon } from "@/components/icons";
import { Button, Card, LinkButton } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { deleteHistoryItem, fetchHistoryPage } from "@/lib/history-api";
import { ApiError } from "@/lib/http";
import { SECTION_INFO, type HistoryItem } from "@/lib/schemas";

function Score({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-xs text-stone-600">
      {label} <span className="font-medium text-stone-900">{value}</span>
    </span>
  );
}

function HistoryRow({
  item,
  onDelete,
}: {
  item: HistoryItem;
  onDelete: (id: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const match =
    item.match_score_before === null
      ? null
      : item.match_score_after === null
        ? `${item.match_score_before}%`
        : `${item.match_score_before}% → ${item.match_score_after}%`;

  async function confirmDelete() {
    setDeleting(true);
    await onDelete(item.id);
  }

  return (
    <li>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={item.status} />
              <span className="text-xs text-stone-500">{formatDate(item.created_at)}</span>
              {item.candidate_name ? (
                <span className="text-sm font-medium text-stone-900">{item.candidate_name}</span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-stone-700">{item.jd_snippet}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              {match ? <Score label="Match" value={match} /> : null}
              {item.ats_score !== null ? (
                <Score label="ATS" value={String(item.ats_score)} />
              ) : null}
              {item.cover_letter_count > 0 ? (
                <Score label="Cover letters" value={String(item.cover_letter_count)} />
              ) : null}
              <span className="text-xs text-stone-500">
                {item.selected_sections.map((s) => SECTION_INFO[s].label).join(", ")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {confirming ? (
              <>
                <span className="text-sm text-stone-600">Delete this run?</span>
                <Button
                  variant="secondary"
                  disabled={deleting}
                  onClick={() => void confirmDelete()}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  {deleting ? <SpinnerIcon /> : null}
                  Delete
                </Button>
                <Button variant="ghost" disabled={deleting} onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <LinkButton href={`/history/${item.id}`} variant="secondary">
                  View
                </LinkButton>
                <Button variant="ghost" onClick={() => setConfirming(true)}>
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>
    </li>
  );
}

export function HistoryList() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    fetchHistoryPage(null)
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setCursor(page.next_cursor);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof ApiError ? e.message : "Could not load your history.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, user, router]);

  async function loadMore() {
    if (!cursor) return;
    try {
      const page = await fetchHistoryPage(cursor);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.next_cursor);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load more.");
    }
  }

  async function remove(id: string) {
    try {
      await deleteHistoryItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete that run.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-stone-900">Your history</h1>
        <LinkButton href="/customize">New customization</LinkButton>
      </div>

      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading || !ready ? (
        <p className="flex items-center gap-2 text-sm text-stone-600">
          <SpinnerIcon /> Loading…
        </p>
      ) : items.length === 0 && !error ? (
        <Card>
          <p className="text-sm text-stone-600">
            Nothing here yet. Runs you make while logged in are saved automatically.{" "}
            <Link href="/customize" className="font-medium text-emerald-700 hover:underline">
              Customize a resume
            </Link>
          </p>
        </Card>
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((item) => (
              <HistoryRow key={item.id} item={item} onDelete={remove} />
            ))}
          </ul>
          {cursor ? (
            <div className="mt-5 text-center">
              <Button variant="secondary" onClick={() => void loadMore()}>
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
