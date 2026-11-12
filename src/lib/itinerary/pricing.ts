import { z } from "zod";

/**
 * Pricing is agent-entered only (never from AI). Three modes per PNG 11 / 21:
 * total, per person (× all travellers), per adult + per child. INR whole
 * rupees. The tax note is free text — no GST maths in v1 (deviation 2).
 */
export const PRICING_MODES = ["total", "per_person", "per_adult_child"] as const;
export type PricingMode = (typeof PRICING_MODES)[number];

const amount = z.number().int().min(0).max(100_000_000).nullable();

export const pricingSchema = z.object({
  mode: z.enum(["total", "per_person", "per_adult_child"]),
  show: z.boolean(),
  total: amount,
  per_person: amount,
  per_adult: amount,
  per_child: amount,
  currency: z.literal("INR").or(z.string().length(3)),
  tax_note: z.string().trim().max(160).optional(),
});

export type Pricing = z.infer<typeof pricingSchema>;

export const EMPTY_PRICING: Pricing = {
  mode: "total",
  show: false,
  total: null,
  per_person: null,
  per_adult: null,
  per_child: null,
  currency: "INR",
  tax_note: "",
};

export type PaxCount = { adults: number; children: number };

export type PriceLine = { label: string; qty: number; unit: number; amount: number };

export type PriceSummary = {
  /** null when the agent has not entered enough to price the trip. */
  total: number | null;
  lines: PriceLine[];
  /** One line for the client, e.g. "₹42,250 per adult". */
  headline: { amount: number; unit: "total" | "per person" | "per adult" } | null;
};

export function computePricing(p: Pricing, pax: PaxCount): PriceSummary {
  const adults = Math.max(0, pax.adults);
  const children = Math.max(0, pax.children);
  switch (p.mode) {
    case "total":
      return {
        total: p.total,
        lines: [],
        headline: p.total === null ? null : { amount: p.total, unit: "total" },
      };
    case "per_person": {
      if (p.per_person === null) return { total: null, lines: [], headline: null };
      const qty = adults + children;
      return {
        total: p.per_person * qty,
        lines: [
          {
            label: qty === 1 ? "1 person" : `${qty} people`,
            qty,
            unit: p.per_person,
            amount: p.per_person * qty,
          },
        ],
        headline: { amount: p.per_person, unit: "per person" },
      };
    }
    case "per_adult_child": {
      if (p.per_adult === null) return { total: null, lines: [], headline: null };
      const lines: PriceLine[] = [
        {
          label: adults === 1 ? "1 adult" : `${adults} adults`,
          qty: adults,
          unit: p.per_adult,
          amount: p.per_adult * adults,
        },
      ];
      if (children > 0) {
        if (p.per_child === null) return { total: null, lines, headline: null };
        lines.push({
          label: children === 1 ? "1 child" : `${children} children`,
          qty: children,
          unit: p.per_child,
          amount: p.per_child * children,
        });
      }
      return {
        total: lines.reduce((s, l) => s + l.amount, 0),
        lines,
        headline: { amount: p.per_adult, unit: "per adult" },
      };
    }
  }
}

/** "₹42,250" style input → 42250; empty → null; junk → undefined (invalid). */
export function parseRupees(input: string): number | null | undefined {
  const clean = input.replace(/[₹,\s]/g, "").replace(/^rs\.?/i, "");
  if (clean === "") return null;
  if (!/^\d{1,9}$/.test(clean)) return undefined;
  return Number(clean);
}
