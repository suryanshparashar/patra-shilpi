"use client";

import { CtaButton } from "@/components/landing/CtaButton";
import { LinkButton } from "@/components/ui";
import { useAuth } from "@/context/auth-context";

/** The hero buttons: the secondary one depends on whether the visitor is logged in. */
export function HeroActions() {
  const { user, ready } = useAuth();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <CtaButton />
      {ready && user ? (
        <LinkButton href="/history" variant="secondary" className="px-5 py-3 text-base">
          Your history
        </LinkButton>
      ) : (
        <LinkButton href="/login" variant="secondary" className="px-5 py-3 text-base">
          Log in
        </LinkButton>
      )}
    </div>
  );
}
