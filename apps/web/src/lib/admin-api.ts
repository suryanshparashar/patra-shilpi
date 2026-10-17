import { jsonBody, requestJson, requestNoContent } from "@/lib/http";
import { adminSessionSchema, adminUsersPageSchema, statsSchema } from "@/lib/schemas";

export function adminLogin(username: string, password: string) {
  return requestJson("/admin/login", adminSessionSchema, jsonBody({ username, password }));
}

export function adminKeywordLogin(keyword: string) {
  return requestJson("/admin/login/keyword", adminSessionSchema, jsonBody({ keyword }));
}

export function adminLogout(): Promise<void> {
  return requestNoContent("/admin/logout", { method: "POST" });
}

export function fetchAdminSession() {
  return requestJson("/admin/me", adminSessionSchema);
}

export function fetchStats() {
  return requestJson("/admin/stats", statsSchema);
}

export function fetchAdminUsers(cursor: string | null) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return requestJson(`/admin/users${query}`, adminUsersPageSchema);
}

/** Admin session problems all mean "log in again". */
export function isAdminAuthError(code: string): boolean {
  return code === "ADMIN_REQUIRED" || code === "ADMIN_EXPIRED" || code === "ADMIN_INVALID";
}
