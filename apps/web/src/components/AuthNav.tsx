"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button, LinkButton } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { useRun } from "@/context/run-context";

export function AuthNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready, logout } = useAuth();
  const { resetRun } = useRun();

  // The admin panel has its own login; the user account links would only confuse there.
  if (pathname.startsWith("/admin")) return null;

  // Reserve the space while we find out who the user is, to avoid the nav jumping.
  if (!ready) return <div className="h-9 w-40" aria-hidden />;

  if (!user) {
    return (
      <nav className="flex items-center gap-2" aria-label="Account">
        <LinkButton href="/login" variant="ghost">
          Log in
        </LinkButton>
        <LinkButton href="/register" variant="secondary">
          Register
        </LinkButton>
      </nav>
    );
  }

  async function onLogout() {
    await logout();
    resetRun(); // the previous account's result must not linger on screen
    router.push("/");
  }

  return (
    <nav className="flex items-center gap-1 sm:gap-3" aria-label="Account">
      <Link
        href="/history"
        className="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
      >
        History
      </Link>
      <span className="hidden text-sm text-stone-500 sm:inline">{user.username}</span>
      <Button variant="secondary" onClick={() => void onLogout()}>
        Log out
      </Button>
    </nav>
  );
}
