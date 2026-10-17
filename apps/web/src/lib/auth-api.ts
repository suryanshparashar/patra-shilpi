import { jsonBody, requestJson, requestNoContent } from "@/lib/http";
import { userSchema, type User } from "@/lib/schemas";

export function register(username: string, password: string): Promise<User> {
  return requestJson("/auth/register", userSchema, jsonBody({ username, password }));
}

export function login(username: string, password: string): Promise<User> {
  return requestJson("/auth/login", userSchema, jsonBody({ username, password }));
}

/** One-click login as the configured test account (the /qa link). */
export function loginQa(): Promise<User> {
  return requestJson("/auth/qa-login", userSchema, { method: "POST" });
}

export function logout(): Promise<void> {
  return requestNoContent("/auth/logout", { method: "POST" });
}

export function fetchMe(): Promise<User> {
  return requestJson("/auth/me", userSchema);
}
