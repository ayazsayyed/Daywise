import { z } from "zod";

/** Zod mirrors of the jsonb column shapes in schema.ts. Validate at every boundary. */

export const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, "Use a 6-digit hex colour like #2E3A8C");

export const FOOTER_MAX = 240;

const optionalUrl = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === "" || /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v), {
    message: "Enter a website like shreekrishnatravelworld.com",
  });

export const tenantBrandingSchema = z.object({
  logo_url: z.string().url().nullable(),
  theme_color: hexColor,
  phone: z.string().max(40),
  whatsapp: z.string().max(40),
  email: z.string().email().or(z.literal("")),
  website: optionalUrl.default(""),
  address: z.string().max(500),
  gstin: z.string().trim().max(20).default(""),
  licence_no: z.string().trim().max(60).default(""),
  footer: z.string().max(FOOTER_MAX, `Keep the footer under ${FOOTER_MAX} characters`),
});

export const tenantDefaultsSchema = z.object({
  inclusions: z.string().max(4000),
  exclusions: z.string().max(4000),
  payment_terms: z.string().max(4000),
  cancellation: z.string().max(4000),
});

export const itineraryClientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().max(40).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  city: z.string().max(80).optional(),
  referred_by: z.string().max(120).optional(),
  pax: z.object({
    adults: z.number().int().min(1).max(40),
    children: z.number().int().min(0).max(20),
    child_ages: z.array(z.number().int().min(0).max(17)),
  }),
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
  website: "",
  address: "",
  gstin: "",
  licence_no: "",
  footer: "",
} as const;

export const DEFAULT_DEFAULTS = {
  inclusions: "",
  exclusions: "",
  payment_terms: "",
  cancellation: "",
} as const;
