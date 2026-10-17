"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { AuthCard, AuthShell } from "@/components/auth/AuthShell";
import { Field } from "@/components/auth/Field";
import { Button } from "@/components/ui";
import { adminKeywordLogin, adminLogin } from "@/lib/admin-api";
import { focusFirst } from "@/lib/focus";
import { ApiError } from "@/lib/http";

type Method = "password" | "keyword";

export function AdminLoginForm() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (method === "password" ? !username.trim() || !password : !keyword) {
      setError(method === "password" ? "Enter the username and password." : "Enter the keyword.");
      focusFirst(
        method === "password"
          ? [!username.trim() && "admin-username", "admin-password"]
          : ["admin-keyword"],
      );
      return;
    }
    setBusy(true);
    try {
      if (method === "password") await adminLogin(username, password);
      else await adminKeywordLogin(keyword);
      router.push("/admin");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
      focusFirst([method === "password" ? "admin-password" : "admin-keyword"]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <AuthCard title="Admin" subtitle="Sign in to the PatraShilpi dashboard.">
        <div
          role="tablist"
          aria-label="Login method"
          className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1"
        >
          {(["password", "keyword"] as const).map((value) => (
            <button
              key={value}
              role="tab"
              type="button"
              aria-selected={method === value}
              onClick={() => {
                setMethod(value);
                setError(null);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                method === value
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {value === "password" ? "Password" : "Keyword"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {method === "password" ? (
            <>
              <Field
                id="admin-username"
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
              />
              <Field
                id="admin-password"
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </>
          ) : (
            <Field
              id="admin-keyword"
              label="Secret keyword"
              type="password"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              autoComplete="off"
            />
          )}

          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={busy} className="mt-2 h-10 w-full">
            {busy ? "Please wait…" : "Log in"}
          </Button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
