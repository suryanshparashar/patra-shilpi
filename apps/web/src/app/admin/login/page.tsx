import type { Metadata } from "next";

import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export const metadata: Metadata = { title: "Admin login" };

export default function AdminLoginPage() {
  return <AdminLoginForm />;
}
