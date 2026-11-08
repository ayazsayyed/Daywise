import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** Type-scale utilities from globals.css; without this tailwind-merge treats them as colours. */
const FONT_SIZES = [
  "display-1",
  "display-2",
  "heading-1",
  "heading-2",
  "heading-3",
  "body",
  "body-sm",
  "caption",
  "label",
  "numeric",
  "button",
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: FONT_SIZES }],
      shadow: ["shadow-float"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
