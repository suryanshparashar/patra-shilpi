import type { Metadata } from "next";

import { QaLogin } from "@/components/auth/QaLogin";

export const metadata: Metadata = { title: "Test login", robots: { index: false, follow: false } };

export default function QaPage() {
  return <QaLogin />;
}
