import type { Metadata } from "next";

import { BackgroundGraphics } from "@/components/BackgroundGraphics";
import { ArrowRightIcon, PlayIcon } from "@/components/icons";
import { LinkButton } from "@/components/ui";
import { DEMO_VIDEO_ID } from "@/lib/config";

export const metadata: Metadata = {
  title: "Demo video",
  description: "A walkthrough of PatraShilpi: tailoring a resume to a job, step by step.",
};

export default function DemoVideoPage() {
  return (
    <section className="relative isolate flex-1 overflow-hidden">
      <BackgroundGraphics />
      <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            See PatraShilpi in action
          </h1>
          <p className="mt-3 text-base text-stone-600">
            From a pasted job description to a tailored, fact-checked resume.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200">
          {DEMO_VIDEO_ID ? (
            <iframe
              className="aspect-video w-full"
              src={`https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_ID}?rel=0`}
              title="PatraShilpi demo video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              loading="lazy"
            />
          ) : (
            <div className="grid aspect-video place-items-center bg-stone-50 px-6 text-center">
              <div>
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                  <PlayIcon className="size-5" />
                </span>
                <p className="mt-4 text-base font-medium text-stone-900">
                  The demo video is coming soon.
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  In the meantime, try it yourself. Your first run is free.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href="/customize" className="h-10">
            Tailor my resume
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
