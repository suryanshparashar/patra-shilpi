import type { StructuredResume } from "@/lib/schemas";

function slug(value: string | null | undefined, fallback: string): string {
  const cleaned = (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || fallback;
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// @react-pdf/renderer is large and browser-only, so it loads on the first download click.

export async function downloadResumePdf(resume: StructuredResume): Promise<void> {
  const [{ pdf }, { ResumePdf }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/pdf/ResumePdf"),
  ]);
  const blob = await pdf(ResumePdf({ resume })).toBlob();
  saveBlob(blob, `${slug(resume.contact.name, "resume")}-tailored-resume.pdf`);
}

export async function downloadCoverLetterPdf(text: string, name: string | null): Promise<void> {
  const [{ pdf }, { CoverLetterPdf }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/pdf/CoverLetterPdf"),
  ]);
  const blob = await pdf(CoverLetterPdf({ text, name })).toBlob();
  saveBlob(blob, `${slug(name, "cover-letter")}-cover-letter.pdf`);
}
