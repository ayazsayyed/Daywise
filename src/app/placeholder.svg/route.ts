import { NextResponse, type NextRequest } from "next/server";

/**
 * Branded placeholder (last link of the image chain): one of the four photo
 * grounds, rotated by `i`, with the place name bottom-left. Optional `color`
 * draws a thin rule in the tenant's theme colour. No broken-image glyphs.
 */
const GROUNDS = ["#D9D2C5", "#C9D1CA", "#CDD1D8", "#D7CEC7"];

export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const label = (q.get("label") ?? "").slice(0, 60);
  const i = Math.abs(Number.parseInt(q.get("i") ?? "0", 10) || 0) % GROUNDS.length;
  const color = /^#[0-9a-fA-F]{6}$/.test(q.get("color") ?? "") ? q.get("color")! : null;
  const w = 1200;
  const h = 800;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
<rect width="${w}" height="${h}" fill="${GROUNDS[i]}"/>
${color ? `<rect x="0" y="0" width="${w}" height="6" fill="${color}"/>` : ""}
${label ? `<text x="40" y="${h - 40}" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="28" fill="#5E5B55">${esc(label)}</text>` : ""}
</svg>`;
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}

function esc(s: string): string {
  return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
