import { z } from "zod";

/** Zod mirrors of the jsonb column shapes in schema.ts. Validate at every boundary. */

export const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, "Use a 6-digit hex colour like #2E3A8C");

export const tenantBrandingSchema = z.object({
  logo_url: z.string().url().nullable(),
  theme_color: hexColor,
  phone: z.string().max(40),
  whatsapp: z.string().max(40),
  email: z.string().email().or(z.literal("")),
  address: z.string().max(500),
  footer: z.string().max(2000),
});

export const tenantDefaultsSchema = z.object({
  inclusions: z.string().max(4000),
  exclusions: z.string().max(4000),
  payment_terms: z.string().max(4000),
  cancellation: z.string().max(4000),
});

export const imageRefSchema = z.object({
  source: z.enum(["place", "pexels", "wikimedia", "placeholder"]),
  ref: z.string(),
  attribution: z.string().nullable().optional(),
  attribution_url: z.string().nullable().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const DEFAULT_BRANDING = {
  logo_url: null,
  theme_color: "#2E3A8C",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  footer: "",
} as const;

export const DEFAULT_DEFAULTS = {
  inclusions: "",
  exclusions: "",
  payment_terms: "",
  cancellation: "",
} as const;
