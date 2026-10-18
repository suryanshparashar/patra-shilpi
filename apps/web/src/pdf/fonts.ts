import { Font } from "@react-pdf/renderer";

let registered = false;

/** Embed Inter (SIL OFL, see public/fonts/Inter-OFL.txt) in every generated PDF.
 *
 * The built-in Helvetica has no glyphs beyond Latin-1, so characters such as "→" came out as
 * garbage for ATS text extraction. Words are also never hyphenated: a split "de-ploy" is read
 * by an ATS as two different words. `base` is the folder the font files are loaded from. */
export function registerPdfFonts(base = "/fonts"): void {
  if (registered) return;
  registered = true;
  Font.register({
    family: "Inter",
    fonts: [
      { src: `${base}/Inter-Regular.ttf`, fontWeight: 400 },
      { src: `${base}/Inter-Bold.ttf`, fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
}
