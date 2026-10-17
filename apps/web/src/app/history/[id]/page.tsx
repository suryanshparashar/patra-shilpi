import { Suspense } from "react";

import { HistoryDetailView } from "@/components/history/HistoryDetailView";

async function Detail({ params }: { params: PageProps<"/history/[id]">["params"] }) {
  const { id } = await params;
  return <HistoryDetailView id={id} />;
}

export default function HistoryDetailPage({ params }: PageProps<"/history/[id]">) {
  // Reading the route params is request-time work, so it sits behind Suspense (Cache Components).
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-stone-600 sm:px-6">Loading…</p>}>
      <Detail params={params} />
    </Suspense>
  );
}
