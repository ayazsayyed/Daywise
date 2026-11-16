import localFont from "next/font/local";

/**
 * The one serif on Daywise surfaces: the templated PDF cover title when the
 * tenant picks it (decision 3). Self-hosted Fraunces 600 (SIL OFL, fonts/OFL.txt).
 */
export const pdfSerif = localFont({
  src: "./fonts/Fraunces-600.woff2",
  weight: "600",
  style: "normal",
  display: "block",
  variable: "--font-pdf-serif",
});
