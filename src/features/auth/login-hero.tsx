import { PhotoFrame } from "@/components/ds";
import { LOGIN_HERO_DESTINATIONS, LOGIN_HERO_FALLBACK } from "@/lib/config/brand";
import { destinationImage, imageUrl } from "@/lib/images/resolve";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

/**
 * Sign-in hero (DESIGN.md deviation 9): a cached Pexels image of one of four
 * fixed Indian destinations, rotated daily, with its caption bottom-left.
 * Never a Google photo. The first lookup of a destination (Pexels → R2) may
 * be slow, so the page waits at most 2.5 s and otherwise shows the fixed
 * fallback image (#17); the lookup finishes in the background and is cached.
 */
export async function LoginHero({ className }: { className?: string }) {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const pick = LOGIN_HERO_DESTINATIONS[dayIndex % LOGIN_HERO_DESTINATIONS.length]!;
  const lookup = destinationImage(pick.query).catch((err) => {
    logger.warn({ err, query: pick.query }, "login hero lookup failed");
    return null;
  });
  const ref = await Promise.race([
    lookup,
    new Promise<null>((r) => setTimeout(() => r(null), 2500)),
  ]);
  if (!ref) {
    return (
      <PhotoFrame
        ratio="fill"
        index={0}
        src={LOGIN_HERO_FALLBACK}
        alt=""
        caption={null}
        className={cn("w-full", className)}
        imgClassName="object-[30%_center]"
      />
    );
  }
  return (
    <PhotoFrame
      ratio="fill"
      index={0}
      src={imageUrl(ref, 1600)}
      alt={pick.caption}
      caption={ref.attribution ? `${pick.caption} · ${ref.attribution}` : pick.caption}
      className={cn("w-full", className)}
    />
  );
}
