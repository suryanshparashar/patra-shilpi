import Link from "next/link";

const REPO_URL = "https://github.com/suryanshparashar/patra-shilpi";

export function SiteFooter() {
  return (
    <footer className="border-t border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <span className="font-semibold text-stone-800">PatraShilpi</span> · © 2026 · Built by{" "}
          <a
            href="https://suryanshparashar.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-emerald-700 hover:underline"
          >
            Suryansh Parashar
          </a>
        </p>
        <nav aria-label="Footer" className="flex gap-5">
          <Link href="/demo-video" className="hover:text-stone-800">
            Demo video
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-stone-800"
          >
            GitHub
          </a>
          <a
            href={`${REPO_URL}/blob/master/LICENSE`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-stone-800"
          >
            MIT License
          </a>
        </nav>
      </div>
    </footer>
  );
}
