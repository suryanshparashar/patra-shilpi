import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { AuthNav } from "@/components/AuthNav";

export function SiteHeader() {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-stone-900">
          <Image src="/patrashilpi-mark.svg" alt="" width={28} height={28} priority />
          PatraShilpi
        </Link>
        {/* usePathname() inside AuthNav needs a Suspense boundary on dynamic routes. */}
        <Suspense fallback={<div className="h-9 w-40" aria-hidden />}>
          <AuthNav />
        </Suspense>
      </div>
    </header>
  );
}
