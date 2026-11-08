"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { TOP_BAR_SLOT_ID } from "./top-bar";

/** Mounts a page's single primary action (and save state) into the top bar slot. */
export function TopBarAction({ children }: { children: React.ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(document.getElementById(TOP_BAR_SLOT_ID));
  }, []);
  if (!slot) return null;
  return createPortal(children, slot);
}
