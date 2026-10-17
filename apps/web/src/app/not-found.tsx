import type { Metadata } from "next";

import { BackgroundGraphics } from "@/components/BackgroundGraphics";
import { ArrowRightIcon } from "@/components/icons";
import { TornSheet } from "@/components/TornSheet";
import { LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <section className="relative isolate flex flex-1 items-center justify-center overflow-hidden px-4 py-16 sm:px-6">
      <BackgroundGraphics />
      <div className="w-full max-w-md text-center">
        <TornSheet className="mx-auto w-56 sm:w-64" />
        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-stone-900">
          Page not found.
        </h1>
        <p className="mt-3 text-base text-stone-600">
          The link may be broken or the page may have moved.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href="/customize" className="h-10">
            Tailor a resume
            <ArrowRightIcon />
          </LinkButton>
          <LinkButton href="/" variant="secondary" className="h-10">
            Go home
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
