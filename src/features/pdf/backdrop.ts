import sharp from "sharp";

import { BACKDROP_TEXT_REGION, backdropTextFor } from "./tokens";

/**
 * Mean colour of the cover text region (top 45%, left 75%, where every
 * backdrop style places its title) → the text colour that reads best and its
 * contrast. Settings warns below 4.5:1.
 */
export async function analyseBackdrop(bytes: Buffer, w: number, h: number) {
  const r = BACKDROP_TEXT_REGION;
  // stats() reads the input image, not the pipeline: extract to a buffer first.
  const region = await sharp(bytes)
    .extract({
      left: Math.round(r.left * w),
      top: Math.round(r.top * h),
      width: Math.round(r.width * w),
      height: Math.round(r.height * h),
    })
    .removeAlpha()
    .toBuffer();
  const stats = await sharp(region).stats();
  const [cr, cg, cb] = stats.channels.map((c) => Math.round(c.mean));
  const hex =
    `#${[cr, cg, cb].map((v) => v!.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  return { mean: hex, ...backdropTextFor(hex) };
}
