import Image from "next/image";
import type { ReactNode } from "react";

import { BackgroundGraphics } from "@/components/BackgroundGraphics";

/** A centered auth layout over quiet background graphics, so the page isn't bare. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex flex-1 items-start justify-center overflow-hidden px-4 py-12 sm:items-center sm:px-6">
      <BackgroundGraphics sheets />
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

/** The auth card: logo, title and a one-line subtitle above the form. */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white/90 p-6 shadow-sm shadow-stone-200/50 backdrop-blur-sm sm:p-8">
      <div className="mb-7 text-center">
        <Image src="/patrashilpi-mark.svg" alt="" width={40} height={40} className="mx-auto" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-stone-900">{title}</h1>
        <p className="mt-1 text-sm text-stone-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
