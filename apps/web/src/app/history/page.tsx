import type { Metadata } from "next";

import { BackgroundGraphics } from "@/components/BackgroundGraphics";
import { HistoryList } from "@/components/history/HistoryList";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <section className="relative isolate flex-1 overflow-hidden">
      {/* The list is narrow, so the corner sheets fit in the margins from wide screens up. */}
      <BackgroundGraphics sheets sheetsFrom="xl" />
      <HistoryList />
    </section>
  );
}
