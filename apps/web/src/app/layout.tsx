import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { BackendWarmup } from "@/components/BackendWarmup";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthProvider } from "@/context/auth-context";
import { RunProvider } from "@/context/run-context";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "PatraShilpi · Shaped to the job. Never a fact invented.",
    template: "%s · PatraShilpi",
  },
  description:
    "Tailor your resume to any job description with AI agents that fact-check every line against your original.",
  // The 16 px tab icon drops the folded corner, which would be under 2 px at that size.
  icons: {
    icon: [
      { url: "/patrashilpi-favicon-16.svg", type: "image/svg+xml", sizes: "16x16" },
      { url: "/patrashilpi-favicon.svg", type: "image/svg+xml", sizes: "any" },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-stone-50 font-sans text-stone-900">
        <BackendWarmup />
        <AuthProvider>
          <RunProvider>
            <SiteHeader />
            <main className="flex flex-1 flex-col">{children}</main>
            <SiteFooter />
          </RunProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
