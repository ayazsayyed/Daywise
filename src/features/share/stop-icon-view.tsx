import {
  BedDouble,
  CarFront,
  Coffee,
  Footprints,
  Info,
  Landmark,
  Mountain,
  Plane,
  Ship,
  ShoppingBag,
  TrainFront,
  TreePine,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { StopIcon } from "./stop-icon";

const ICONS: Record<StopIcon, LucideIcon> = {
  flight: Plane,
  train: TrainFront,
  boat: Ship,
  car: CarFront,
  hotel: BedDouble,
  meal: UtensilsCrossed,
  sight: Landmark,
  activity: Mountain,
  walk: Footprints,
  nature: TreePine,
  shopping: ShoppingBag,
  leisure: Coffee,
  note: Info,
};

const LABELS: Record<StopIcon, string> = {
  flight: "Flight or airport",
  train: "Train",
  boat: "Boat",
  car: "Road transfer",
  hotel: "Hotel",
  meal: "Meal",
  sight: "Sightseeing",
  activity: "Activity",
  walk: "Walk",
  nature: "Nature",
  shopping: "Shopping",
  leisure: "Free time",
  note: "Note",
};

/**
 * Plain line icon for a stop or transport line (DESIGN.md: no coloured circles,
 * colour never the only signal: the title always says what it is). Muted ink on
 * the client page; the PDF styles may tint it with their accent via `.share-stop-icon`.
 */
export function StopIconView({ icon, className }: { icon: StopIcon; className?: string }) {
  const Icon = ICONS[icon];
  return (
    <Icon
      role="img"
      aria-label={LABELS[icon]}
      strokeWidth={1.75}
      className={cn("share-stop-icon text-ink-muted size-4 shrink-0", className)}
    />
  );
}
