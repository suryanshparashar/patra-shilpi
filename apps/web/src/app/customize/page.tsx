import type { Metadata } from "next";

import { BackgroundGraphics } from "@/components/BackgroundGraphics";
import { CustomizerForm } from "@/components/form/CustomizerForm";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Tailor your resume" };

export default function CustomizePage() {
  return (
    <section className="relative isolate flex-1 overflow-hidden">
      {/* The card is wide, so the corner sheets only appear where the margins can fit them. */}
      <BackgroundGraphics sheets sheetsFrom="xl" />
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            Tailor your resume to any job
          </h1>
          <p className="mt-3 max-w-2xl text-base text-stone-600">
            Paste a job description and upload your resume. We rewrite it to match the role without
            inventing anything, then score the match and check ATS-friendliness.
          </p>
        </div>
        <Card>
          <CustomizerForm />
        </Card>
      </div>
    </section>
  );
}
