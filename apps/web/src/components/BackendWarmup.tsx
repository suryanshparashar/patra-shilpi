"use client";

import { useEffect } from "react";

import { API_BASE_URL } from "@/lib/config";
import { devlog } from "@/lib/devlog";

const KEY = "rc:warmed";

/** Wakes a sleeping backend (a cold start on the host) as soon as the site opens, so the user's
 * first real request is not the one that waits. Once per tab session; fire and forget. */
export function BackendWarmup() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
    } catch {
      // storage unavailable: ping anyway
    }
    devlog("API", "backend warm-up ping");
    // no-cors: the answer is never read, so there are no CORS checks and no console noise.
    fetch(`${API_BASE_URL}/healthcheck`, { mode: "no-cors", cache: "no-store" }).catch(() => {});
  }, []);

  return null;
}
