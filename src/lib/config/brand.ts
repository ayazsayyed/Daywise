/**
 * Product-level UI strings. Client-safe (no secrets, no env access).
 * DESIGN.md deviation 5: tenant subdomains read `<slug>.planner.smallsoftware.in`
 * until the daywise.in domain is bought — keep the suffix in this one place.
 */
export const PRODUCT_NAME = "Daywise";
export const TENANT_DOMAIN_SUFFIX = "planner.smallsoftware.in";

export function tenantSubdomain(slug: string): string {
  return `${slug}.${TENANT_DOMAIN_SUFFIX}`;
}

/** Fixed Indian destinations rotated on the sign-in hero (DESIGN.md deviation 9). */
export const LOGIN_HERO_DESTINATIONS = [
  { query: "Dal Lake Srinagar", caption: "Dal Lake at first light, Srinagar" },
  { query: "Munnar tea gardens Kerala", caption: "Tea gardens above Munnar, Kerala" },
  { query: "Alleppey backwaters houseboat", caption: "Backwaters near Alleppey, Kerala" },
  { query: "Hawa Mahal Jaipur", caption: "Hawa Mahal in the morning, Jaipur" },
] as const;

/** Six theme-colour presets shown in Settings; dark enough to read on off-white. */
export const THEME_PRESETS = [
  "#7A3B1D",
  "#2E3A8C",
  "#1F6B4A",
  "#7B2D5E",
  "#8A5A12",
  "#3B3A37",
] as const;

/**
 * Two-letter initials for avatars and the logo fallback tile: first letters of
 * the first two words ("Shree Krishna Travel World" → SK). For an email only
 * the local part counts ("nikhil.joshi@…" → NJ, "ayaz@…" → AY).
 */
export function initialsOf(name: string, fallback = "DW"): string {
  const source = name.includes("@") ? name.split("@")[0]! : name;
  const words = source
    .replace(/[^\p{L}\p{N}\s._-]/gu, " ")
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (words.length === 0) return fallback;
  const letters = words.length === 1 ? words[0]!.slice(0, 2) : `${words[0]![0]}${words[1]![0]}`;
  return letters.toUpperCase();
}
