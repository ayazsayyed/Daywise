/** Token overlap between the asked-for name and what Places returned. */
export function nameMatches(query: string, resultName: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w));
  const a = new Set(norm(query.split(",")[0]!));
  const b = new Set(norm(resultName));
  if (a.size === 0 || b.size === 0) return false;
  let hit = 0;
  for (const w of a) if (b.has(w)) hit++;
  // At least half the meaningful words, and at least two of them when there are two or more
  // ("Nishat Bagh" must not match "Shalimar Bagh").
  return hit >= Math.min(2, a.size) && hit / a.size >= 0.5;
}

const STOP = new Set([
  "the",
  "hotel",
  "resort",
  "and",
  "spa",
  "inn",
  "lodge",
  "camp",
  "view",
  "point",
]);
