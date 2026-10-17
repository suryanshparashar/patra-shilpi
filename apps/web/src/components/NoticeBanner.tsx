"use client";

import { useSyncExternalStore } from "react";

import { AlertIcon, XIcon } from "@/components/icons";
import { NOTICE_BANNER_ENABLED } from "@/lib/config";

const KEY = "rc:notice-dismissed";
const listeners = new Set<() => void>();

function isDismissed(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false; // storage unavailable: keep showing the notice
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function dismiss(): void {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // storage unavailable: hide it for this page view only
  }
  listeners.forEach((listener) => listener());
}

/** A site-wide notice, switched on by NEXT_PUBLIC_NOTICE_BANNER=true. Closing it hides it for the
 * rest of the tab session (sessionStorage); a new tab shows it again. */
export function NoticeBanner() {
  // The server render can't see sessionStorage, so it renders nothing and the client decides.
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true);
  if (!NOTICE_BANNER_ENABLED || dismissed) return null;

  return (
    <div role="status" className="border-b border-amber-200 bg-amber-50 text-amber-900">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-sm sm:px-6">
        <AlertIcon className="size-4 shrink-0 text-amber-600" />
        <p className="flex-1">
          We&apos;re improving LLM response quality. The changes will reflect within 24 hours.
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss notice"
          className="grid size-7 shrink-0 place-items-center rounded-md text-amber-700 transition hover:bg-amber-100 hover:text-amber-900 focus-visible:outline-2 focus-visible:outline-amber-600"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
