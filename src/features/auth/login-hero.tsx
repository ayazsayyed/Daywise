import { PhotoFrame } from "@/components/ds";
import { LOGIN_HERO_DESTINATIONS } from "@/lib/config/brand";
import { cn } from "@/lib/utils";

/**
 * Sign-in hero (DESIGN.md deviation 9): a cached Pexels image of one of four
 * fixed Indian destinations, rotated daily, with its caption bottom-left.
 * Never a Google photo. Until the image resolver has a cached picture the
 * frame shows the sand ground with the caption — exactly the PNG's state.
 */
export function LoginHero({ className }: { className?: string }) {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const pick = LOGIN_HERO_DESTINATIONS[dayIndex % LOGIN_HERO_DESTINATIONS.length]!;
  return (
    <PhotoFrame
      ratio="fill"
      index={0}
      src={null}
      alt=""
      caption={pick.caption}
      className={cn("w-full", className)}
    />
  );
}
