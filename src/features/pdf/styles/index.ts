import { editorial } from "./editorial";
import { heritage } from "./heritage";
import { minimal } from "./minimal";
import { photoFirst } from "./photo-first";
import { BESPOKE_META, resolveStyleMeta, type Registry, type StyleMeta } from "./meta";
import type { PdfStyle, StyleComponents } from "./types";

export type { PdfStyle, StyleProps, StyleComponents } from "./types";
export * from "./meta";

/**
 * Style components by id (README "Bespoke PDF templates"). A bespoke style
 * adds its metadata to BESPOKE_META in ./meta.ts (with owning tenant ids) and
 * its components here, from ./bespoke/<id>.tsx.
 */
const COMPONENTS: Record<string, StyleComponents> = {
  editorial,
  heritage,
  "photo-first": photoFirst,
  minimal,
};

/** Every style id with metadata must have components (checked in tests). */
export function componentsFor(meta: StyleMeta): StyleComponents | undefined {
  return COMPONENTS[meta.id];
}

export function resolveStyle(
  id: string | null | undefined,
  tenantId: string,
  reg?: Registry,
): PdfStyle {
  const meta = resolveStyleMeta(id, tenantId, reg);
  const c = COMPONENTS[meta.id] ?? COMPONENTS.editorial!;
  return { ...meta, ...c };
}

export const BESPOKE_IDS = Object.keys(BESPOKE_META);
