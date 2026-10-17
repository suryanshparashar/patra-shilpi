"use client";

import { ArrowRightIcon } from "@/components/icons";
import { LinkButton } from "@/components/ui";
import { useAuth } from "@/context/auth-context";

/** The main call to action. Guests are told their first run needs no account. */
export function CtaButton() {
  const { user, ready } = useAuth();
  return (
    <LinkButton href="/customize" className="px-5 py-3 text-base">
      {ready && user ? "Tailor my resume" : "Try it free, no login needed"}
      <ArrowRightIcon />
    </LinkButton>
  );
}
