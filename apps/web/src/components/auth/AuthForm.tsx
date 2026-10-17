"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Field } from "@/components/auth/Field";
import { AuthCard, AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { focusFirst } from "@/lib/focus";
import { ApiError } from "@/lib/http";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  validateCredentials,
} from "@/lib/schemas";

type Mode = "login" | "register";

const COPY: Record<
  Mode,
  {
    title: string;
    subtitle: string;
    submit: string;
    switchText: string;
    switchHref: string;
    switchLabel: string;
  }
> = {
  login: {
    title: "Welcome back",
    subtitle: "Log in to see your history and write cover letters.",
    submit: "Log in",
    switchText: "New here?",
    switchHref: "/register",
    switchLabel: "Create an account",
  },
  register: {
    title: "Create your account",
    subtitle: "Save every run and unlock cover letters.",
    submit: "Create account",
    switchText: "Already have an account?",
    switchHref: "/login",
    switchLabel: "Log in",
  },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { user, ready, login, register } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    password?: string;
    confirm?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const copy = COPY[mode];
  const isRegister = mode === "register";

  // Live rules: what may be typed into, and when the form may be sent.
  const hasUsername = username.trim().length > 0;
  const passwordsLocked = isRegister && !hasUsername;
  const passwordsMatch = password.length > 0 && confirm === password;
  const confirmMismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = isRegister ? hasUsername && passwordsMatch : hasUsername && password.length > 0;

  // Already logged in: nothing to do here.
  useEffect(() => {
    if (ready && user) router.replace("/customize");
  }, [ready, user, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    // Sign-up checks the rules up front; log-in only needs both fields filled in.
    const errors = isRegister
      ? {
          ...validateCredentials(username, password),
          ...(confirm === password ? {} : { confirm: "The passwords don't match." }),
        }
      : {
          ...(username.trim() ? {} : { username: "Enter your username." }),
          ...(password ? {} : { password: "Enter your password." }),
        };
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirst([
        "username" in errors && "username",
        "password" in errors && "password",
        "confirm" in errors && "confirm",
      ]);
      return;
    }

    setBusy(true);
    try {
      await (isRegister ? register : login)(username, password);
      router.push("/customize");
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "";
      if (code === "USERNAME_TAKEN" || code === "USER_NOT_FOUND") {
        setFieldErrors({ username: (error as ApiError).message });
        focusFirst(["username"]);
      } else if (code === "WRONG_PASSWORD") {
        setFieldErrors({ password: (error as ApiError).message });
        focusFirst(["password"]);
      } else {
        setFormError(
          error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  const confirmHint =
    fieldErrors.confirm ??
    (confirmMismatch ? "The passwords don't match." : passwordsMatch ? "Passwords match." : null);

  return (
    <AuthShell>
      <AuthCard title={copy.title} subtitle={copy.subtitle}>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field
            id="username"
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={isRegister ? "e.g. suryansh_parashar" : undefined}
            hint={
              fieldErrors.username ??
              (isRegister ? `${USERNAME_MIN}-${USERNAME_MAX} characters: a-z, 0-9, _ or -` : null)
            }
            tone={fieldErrors.username ? "error" : "neutral"}
          />

          <Field
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
            disabled={passwordsLocked}
            placeholder={passwordsLocked ? "Enter a username first" : undefined}
            hint={
              fieldErrors.password ??
              (isRegister ? `At least ${PASSWORD_MIN} characters (max ${PASSWORD_MAX}).` : null)
            }
            tone={fieldErrors.password ? "error" : "neutral"}
          />

          {isRegister ? (
            <Field
              id="confirm"
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              disabled={passwordsLocked}
              placeholder={passwordsLocked ? "Enter a username first" : undefined}
              hint={confirmHint}
              tone={
                fieldErrors.confirm || confirmMismatch
                  ? "error"
                  : passwordsMatch
                    ? "success"
                    : "neutral"
              }
            />
          ) : null}

          {formError ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          ) : null}

          <Button type="submit" disabled={busy || !canSubmit} className="mt-2 h-10 w-full">
            {busy ? "Please wait…" : copy.submit}
          </Button>
        </form>

        {isRegister ? (
          <p className="mt-5 text-center text-xs leading-relaxed text-stone-400">
            There&apos;s no email or password reset, so keep your password somewhere safe.
          </p>
        ) : null}
      </AuthCard>

      <p className="mt-6 text-center text-sm text-stone-500">
        {copy.switchText}{" "}
        <Link href={copy.switchHref} className="font-medium text-emerald-700 hover:underline">
          {copy.switchLabel}
        </Link>
      </p>
    </AuthShell>
  );
}
