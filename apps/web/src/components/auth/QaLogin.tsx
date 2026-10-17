"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AuthCard, AuthShell } from "@/components/auth/AuthShell";
import { SpinnerIcon } from "@/components/icons";
import { LinkButton } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/http";

/** Signs the visitor in as the shared test account as soon as the page opens. */
export function QaLogin() {
  const router = useRouter();
  const { loginQa } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false); // React runs effects twice in development; log in only once

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    loginQa()
      .then(() => router.replace("/customize"))
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again."),
      );
  }, [loginQa, router]);

  return (
    <AuthShell>
      <AuthCard
        title={error ? "Test login unavailable" : "Test login"}
        subtitle={error ?? "Signing you in as the test user…"}
      >
        {error ? (
          <div className="grid grid-cols-2 gap-2">
            <LinkButton href="/login" variant="secondary" className="h-10">
              Log in
            </LinkButton>
            <LinkButton href="/customize" className="h-10">
              Try as a guest
            </LinkButton>
          </div>
        ) : (
          <p role="status" className="flex justify-center text-emerald-600">
            <SpinnerIcon className="size-6" />
          </p>
        )}
      </AuthCard>
    </AuthShell>
  );
}
