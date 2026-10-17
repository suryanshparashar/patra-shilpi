"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { SpinnerIcon } from "@/components/icons";
import { Button, Card } from "@/components/ui";
import {
  adminLogout,
  fetchAdminSession,
  fetchAdminUsers,
  fetchStats,
  isAdminAuthError,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import type { AdminSession, AdminUsersPage, Stats } from "@/lib/schemas";

type UserRow = AdminUsersPage["items"][number];

const number = (value: number) => value.toLocaleString();

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-stone-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

function formatCost(stats: Stats): { value: string; hint: string } {
  if (stats.estimated_cost_usd === null) {
    return {
      value: "Not configured",
      hint: "Set LLM_PRICE_INPUT_PER_MILLION and LLM_PRICE_OUTPUT_PER_MILLION",
    };
  }
  return {
    value: stats.estimated_cost_usd.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
    }),
    hint: "Tokens x the configured price per 1M tokens",
  };
}

const loadAll = () => Promise.all([fetchAdminSession(), fetchStats(), fetchAdminUsers(null)]);
type Loaded = Awaited<ReturnType<typeof loadAll>>;

export function AdminDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const apply = useCallback(([who, totals, page]: Loaded) => {
    setSession(who);
    setStats(totals);
    setUsers(page.items);
    setCursor(page.next_cursor);
    setError(null);
  }, []);

  // Session problems send the admin back to the login page; anything else is shown inline.
  const fail = useCallback(
    (e: unknown, fallback: string) => {
      if (e instanceof ApiError && isAdminAuthError(e.code)) router.replace("/admin/login");
      else setError(e instanceof ApiError ? e.message : fallback);
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;
    loadAll()
      .then((data) => !cancelled && apply(data))
      .catch((e) => !cancelled && fail(e, "Could not load the dashboard."));
    return () => {
      cancelled = true;
    };
  }, [apply, fail]);

  async function refresh() {
    setRefreshing(true);
    try {
      // The minimum delay keeps the spinner visible, so a fast response still shows feedback.
      const [data] = await Promise.all([loadAll(), new Promise((r) => setTimeout(r, 500))]);
      apply(data);
    } catch (e) {
      fail(e, "Could not refresh the dashboard.");
    } finally {
      setRefreshing(false);
    }
  }

  async function loadMore() {
    if (!cursor) return;
    try {
      const page = await fetchAdminUsers(cursor);
      setUsers((prev) => [...prev, ...page.items]);
      setCursor(page.next_cursor);
    } catch (e) {
      fail(e, "Could not load more users.");
    }
  }

  async function logout() {
    try {
      await adminLogout();
    } finally {
      router.push("/admin/login");
    }
  }

  const cost = stats ? formatCost(stats) : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Admin</h1>
          {session ? (
            <p className="text-sm text-stone-500">
              Signed in via {session.method === "keyword" ? "secret keyword" : session.name}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? <SpinnerIcon /> : null}
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <Button variant="secondary" onClick={() => void logout()}>
            Log out
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {!stats && !error ? (
        <p className="flex items-center gap-2 text-sm text-stone-600">
          <SpinnerIcon /> Loading…
        </p>
      ) : null}

      {stats && cost ? (
        <div
          aria-busy={refreshing}
          className={`space-y-6 transition-opacity ${refreshing ? "opacity-50" : ""}`}
        >
          <section aria-label="Totals" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Registered users" value={number(stats.registered_users)} />
            <StatCard
              label="Guest users"
              value={number(stats.guest_users)}
              hint="Guests who tried a run (success or not), all-time"
            />
            <StatCard label="Resume runs" value={number(stats.resume_runs)} />
            <StatCard label="Cover letters" value={number(stats.cover_letter_runs)} />
            <StatCard
              label="LLM calls"
              value={number(stats.llm_calls)}
              hint={`+ ${number(stats.embedding_calls)} embedding calls`}
            />
            <StatCard
              label="Tokens"
              value={number(stats.total_tokens)}
              hint={`${number(stats.input_tokens)} in · ${number(stats.output_tokens)} out`}
            />
            <StatCard label="Estimated cost" value={cost.value} hint={cost.hint} />
          </section>

          <Card title="Users" description="Newest first. Run counts come from LLM usage records.">
            {users.length === 0 ? (
              <p className="text-sm text-stone-600">No registered users yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs tracking-wider text-stone-500 uppercase">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Username</th>
                      <th className="py-2 pr-4 text-right font-medium">Resume runs</th>
                      <th className="py-2 text-right font-medium">Cover letters</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="py-2 pr-4 font-medium text-stone-900">{user.username}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {number(user.resume_runs)}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {number(user.cover_letter_runs)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {cursor ? (
              <div className="mt-4 text-center">
                <Button variant="secondary" onClick={() => void loadMore()}>
                  Load more
                </Button>
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
