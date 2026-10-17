import { BackgroundGraphics } from "@/components/BackgroundGraphics";
import { HeroActions } from "@/components/landing/HeroActions";
import { ResumePreview } from "@/components/landing/ResumePreview";
import { Features, FinalCta, HowItWorks, TrustStrip } from "@/components/landing/Sections";

export default function LandingPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden">
        <BackgroundGraphics />
        <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-28">
          <div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
              Shaped to the job.
              <span className="block text-emerald-700">Never a fact invented.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-stone-600">
              PatraShilpi tailors your resume to any job description. AI agents rewrite your
              summary, skills and experience in the job&apos;s own language, then fact-check every
              line against your original.
            </p>
            <div className="mt-8">
              <HeroActions />
            </div>
            <p className="mt-4 text-sm text-stone-500">
              One free run as a guest. Your PDF file is never stored.
            </p>
          </div>
          <ResumePreview />
        </div>
      </section>

      <HowItWorks />
      <Features />
      <TrustStrip />
      <FinalCta />
    </>
  );
}
