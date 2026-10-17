import type { ReactNode } from "react";

import {
  CheckIcon,
  FileIcon,
  GaugeIcon,
  HistoryIcon,
  LockIcon,
  MailIcon,
  ShieldCheckIcon,
  SlidersIcon,
  TargetIcon,
  UploadIcon,
} from "@/components/icons";
import { CtaButton } from "@/components/landing/CtaButton";

function SectionHeading({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold text-emerald-700">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-base text-stone-600">{intro}</p>
    </div>
  );
}

function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
      {children}
    </span>
  );
}

// --- How it works --------------------------------------------------------------------------

const STEPS = [
  {
    icon: <FileIcon />,
    title: "Paste the job description",
    text: "The full posting: responsibilities, requirements and nice-to-haves.",
  },
  {
    icon: <UploadIcon className="size-5" />,
    title: "Upload your resume",
    text: "A text-based PDF. Pick which sections to tailor; the rest stays exactly as you wrote it.",
  },
  {
    icon: <ShieldCheckIcon />,
    title: "Get a tailored, fact-checked resume",
    text: "Scores before and after, the keywords still missing, and a clean PDF to download.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHeading
        eyebrow="How it works"
        title="Three steps, nothing to fill in"
        intro="No templates to fill in. Bring the job and the resume you already have."
      />
      <ol className="mt-12 grid gap-6 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="relative rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
          >
            <span className="absolute top-6 right-6 text-sm font-semibold text-stone-300">
              0{i + 1}
            </span>
            <IconTile>{step.icon}</IconTile>
            <h3 className="mt-4 text-base font-semibold text-stone-900">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// --- Features ------------------------------------------------------------------------------

const FEATURES = [
  {
    icon: <TargetIcon />,
    title: "Match score",
    text: "See how close your resume is to the job, before and after tailoring.",
  },
  {
    icon: <GaugeIcon />,
    title: "ATS score",
    text: "An estimate of how well applicant tracking systems will read it, with specific fixes.",
  },
  {
    icon: <SlidersIcon />,
    title: "You choose the sections",
    text: "Summary, skills, experience or projects. Untouched sections stay as you wrote them.",
  },
  {
    icon: <ShieldCheckIcon />,
    title: "Fact-check guardrail",
    text: "A separate AI agent flags anything your original resume doesn't support.",
  },
  {
    icon: <MailIcon />,
    title: "Cover letter",
    text: "Written from the job and your tailored resume, ready to download. For logged-in users.",
  },
  {
    icon: <HistoryIcon />,
    title: "History and re-runs",
    text: "Every run is saved. Revisit it, download it again, or re-run it with other sections.",
  },
];

export function Features() {
  return (
    <section id="features" className="border-y border-stone-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="Features"
          title="Everything a tailored application needs"
          intro="A team of specialised AI agents, each doing one job well."
        />
        <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="flex gap-4">
              <IconTile>{feature.icon}</IconTile>
              <div>
                <h3 className="text-base font-semibold text-stone-900">{feature.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-stone-600">{feature.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// --- Trust ---------------------------------------------------------------------------------

const PROMISES = [
  {
    icon: <LockIcon />,
    title: "Your PDF file is never stored",
    text: "It is read in memory, and its text goes to Google Gemini for processing. Guests keep nothing. Logged-in users' history keeps the extracted text, so runs can be re-run or deleted.",
  },
  {
    icon: <ShieldCheckIcon />,
    title: "No invented facts",
    text: "Employers, titles, dates and numbers stay exactly as you wrote them.",
  },
  {
    icon: <CheckIcon className="size-5" />,
    title: "Try it without an account",
    text: "One free run as a guest. Sign up only if you want more.",
  },
];

export function TrustStrip() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="grid gap-6 rounded-2xl bg-emerald-50/70 p-8 ring-1 ring-emerald-100 md:grid-cols-3 md:p-10">
        {PROMISES.map((promise) => (
          <div key={promise.title} className="flex gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100">
              {promise.icon}
            </span>
            <div>
              <h3 className="text-base font-semibold text-stone-900">{promise.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">{promise.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// --- Closing call to action ----------------------------------------------------------------

export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
          Your next application, shaped to the job.
        </h2>
        <p className="mt-2 text-base text-stone-600">It takes a job description and a PDF.</p>
        <div className="mt-6 flex justify-center">
          <CtaButton />
        </div>
      </div>
    </section>
  );
}
