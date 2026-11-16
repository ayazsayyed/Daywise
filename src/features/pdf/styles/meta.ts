import type { StampSpec } from "../geometry";

/**
 * Style metadata: plain data the worker, Settings and /admin need without
 * loading React components or CSS (the worker cannot import those).
 * Components live in ./<id>.tsx and are joined in ./index.ts.
 */

export type Insets = { top: number; right: number; bottom: number; left: number };

export type StyleMeta = {
  id: string;
  name: string;
  description: string;
  /** Uses the tenant's optional cover backdrop. */
  supportsBackdrop: boolean;
  /**
   * Print through the original single document (Editorial): same page count
   * and text as before styles existed.
   */
  singleDocument: boolean;
  /** Body and last pages keep content inside these insets (mm from each sheet edge). */
  insets: Insets;
  /** Page number on body and last pages; colour is a hex or a PdfTokens key. null = none. */
  stamp: StampSpec | null;
};

export const EDITORIAL: StyleMeta = {
  id: "editorial",
  name: "Editorial",
  description:
    "The quiet white layout: logo header, large title, one photo per day. Accent on rules and day numbers.",
  supportsBackdrop: false,
  singleDocument: true,
  insets: { top: 15, right: 15, bottom: 18, left: 15 },
  stamp: null,
};

export const HERITAGE: StyleMeta = {
  id: "heritage",
  name: "Heritage",
  description:
    "Deep brand band, a slanted two-photo band on cream, accent rules. Supports a cover backdrop.",
  supportsBackdrop: true,
  singleDocument: false,
  insets: { top: 46, right: 16, bottom: 20, left: 16 },
  stamp: { align: "right", bottomMm: 5.2, sideMm: 16, color: "onPrimary" },
};

export const PHOTO_FIRST: StyleMeta = {
  id: "photo-first",
  name: "Photo-first",
  description: "A full-bleed cover photo with the title over it; light chrome inside.",
  supportsBackdrop: false,
  singleDocument: false,
  insets: { top: 24, right: 18, bottom: 20, left: 18 },
  stamp: { align: "center", bottomMm: 9, sideMm: 18, color: "inkSecondary" },
};

export const MINIMAL: StyleMeta = {
  id: "minimal",
  name: "Minimal",
  description: "A typographic cover on white and thin lines; the most restrained look.",
  supportsBackdrop: false,
  singleDocument: false,
  insets: { top: 22, right: 20, bottom: 20, left: 20 },
  stamp: { align: "right", bottomMm: 9, sideMm: 20, color: "inkSecondary" },
};

export const DEFAULT_STYLE_ID = EDITORIAL.id;
export const BUILT_IN_META: StyleMeta[] = [EDITORIAL, HERITAGE, PHOTO_FIRST, MINIMAL];

export type BespokeMeta = { meta: StyleMeta; tenantIds: string[] };

/**
 * Bespoke styles (a paid one-time service, README "Bespoke PDF templates"):
 * id → metadata and the tenants that own it. Empty in v1.
 */
export const BESPOKE_META: Record<string, BespokeMeta> = {};

export type Registry = { builtIn: StyleMeta[]; bespoke: Record<string, BespokeMeta> };
const REGISTRY: Registry = { builtIn: BUILT_IN_META, bespoke: BESPOKE_META };

/** Styles this tenant may select: built-ins plus bespoke styles it owns. */
export function stylesForTenant(tenantId: string, reg: Registry = REGISTRY): StyleMeta[] {
  const own = Object.values(reg.bespoke)
    .filter((b) => b.tenantIds.includes(tenantId))
    .map((b) => b.meta);
  return [...reg.builtIn, ...own];
}

export function canUseStyle(id: string, tenantId: string, reg: Registry = REGISTRY): boolean {
  return stylesForTenant(tenantId, reg).some((s) => s.id === id);
}

/** The style to render for a tenant; unknown or not owned falls back to Editorial. */
export function resolveStyleMeta(
  id: string | null | undefined,
  tenantId: string,
  reg: Registry = REGISTRY,
): StyleMeta {
  return (
    stylesForTenant(tenantId, reg).find((s) => s.id === id) ??
    reg.builtIn.find((s) => s.id === DEFAULT_STYLE_ID)!
  );
}

export function isBespokeId(id: string, reg: Registry = REGISTRY): boolean {
  return id in reg.bespoke;
}

/** Every id an admin may assign to this tenant (built-ins + bespoke it owns). */
export function assignableStyleIds(tenantId: string, reg: Registry = REGISTRY): string[] {
  return stylesForTenant(tenantId, reg).map((s) => s.id);
}
