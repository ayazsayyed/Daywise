import { z } from "zod";

import type { ImageRef } from "@/lib/db/schema";
import { MEAL_PLANS, STOP_KINDS } from "@/lib/ai/schemas";

import { pricingSchema, type Pricing } from "./pricing";

/**
 * The editor's document: one itinerary with its days, stops and hotels, as the
 * client holds it. Every edit is an `EditorOp`. The client applies ops
 * optimistically with `applyOp`; the server validates the same ops with
 * `editorOpSchema`, checks every referenced id belongs to the itinerary
 * (`checkOpRefs`) and persists them in one transaction.
 */

// ── Document ─────────────────────────────────────────────────────────────
export type EditorImage = ImageRef & { url: string; credit: string | null };

export type EditorStop = {
  id: string;
  kind: (typeof STOP_KINDS)[number];
  title: string;
  description: string;
  time: string | null;
  duration: string | null;
  placeId: string | null;
  verified: boolean;
  image: EditorImage | null;
};

export type EditorHotel = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  placeId: string | null;
  verified: boolean;
  manual: boolean;
  roomType: string;
  mealPlan: string | null;
  checkIn: string | null;
  checkOut: string | null;
  image: EditorImage | null;
};

export type EditorDay = {
  id: string;
  date: string | null;
  city: string;
  title: string;
  summary: string;
  transport: string;
  hero: EditorImage | null;
  stops: EditorStop[];
  hotel: EditorHotel | null;
};

export type EditorClient = {
  name: string;
  phone?: string;
  email?: string;
  city?: string;
  referred_by?: string;
  pax: { adults: number; children: number; child_ages: number[]; infants?: number };
};

export type EditorSections = {
  inclusions: string;
  exclusions: string;
  payment_terms: string;
  cancellation: string;
};

export const ITINERARY_STATUSES = ["draft", "sent", "confirmed", "lost"] as const;
export type ItineraryStatusValue = (typeof ITINERARY_STATUSES)[number];

export type EditorDoc = {
  id: string;
  title: string;
  status: ItineraryStatusValue;
  isTemplate: boolean;
  startDate: string | null;
  endDate: string | null;
  destination: string;
  country: string;
  budget: string | null;
  pace: string | null;
  client: EditorClient | null;
  pricing: Pricing;
  sections: EditorSections;
  days: EditorDay[];
};

// ── Ops ──────────────────────────────────────────────────────────────────
const id = z.string().uuid();
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM")
  .nullable();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const line = (max: number) => z.string().max(max);

export const clientSchema = z.object({
  name: z.string().trim().max(120),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(160).optional(),
  city: z.string().trim().max(80).optional(),
  referred_by: z.string().trim().max(120).optional(),
  pax: z.object({
    adults: z.number().int().min(1).max(40),
    children: z.number().int().min(0).max(20),
    child_ages: z.array(z.number().int().min(0).max(17)).max(20),
    infants: z.number().int().min(0).max(10).optional(),
  }),
});

export const sectionsSchema = z.object({
  inclusions: line(4000),
  exclusions: line(4000),
  payment_terms: line(4000),
  cancellation: line(4000),
});

const imageSchema = z.object({
  source: z.enum(["place", "pexels", "wikimedia", "placeholder"]),
  ref: z.string().max(500),
  attribution: z.string().nullable().optional(),
  attribution_url: z.string().nullable().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  url: z.string().max(800),
  credit: z.string().nullable(),
});

export const editorOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("itinerary.set"),
    title: z.string().trim().min(1).max(120).optional(),
    status: z.enum(ITINERARY_STATUSES).optional(),
    startDate: isoDate.nullable().optional(),
  }),
  z.object({ op: z.literal("client.set"), client: clientSchema.nullable() }),
  z.object({ op: z.literal("pricing.set"), pricing: pricingSchema }),
  z.object({ op: z.literal("sections.set"), sections: sectionsSchema }),
  z.object({
    op: z.literal("day.set"),
    dayId: id,
    patch: z
      .object({
        title: line(120),
        summary: line(600),
        transport: line(240),
        city: line(60),
      })
      .partial(),
  }),
  z.object({ op: z.literal("day.reorder"), order: z.array(id).min(1).max(31) }),
  z.object({
    op: z.literal("day.add"),
    dayId: id,
    after: id.nullable(),
    title: line(120),
    city: line(60),
  }),
  z.object({ op: z.literal("day.remove"), dayId: id }),
  z.object({
    op: z.literal("stop.set"),
    stopId: id,
    patch: z
      .object({
        title: line(160),
        description: line(800),
        time,
        duration: line(30).nullable(),
        kind: z.enum(STOP_KINDS),
      })
      .partial(),
  }),
  z.object({
    op: z.literal("stop.add"),
    stopId: id,
    dayId: id,
    index: z.number().int().min(0).max(30),
    title: line(160),
    kind: z.enum(STOP_KINDS),
  }),
  z.object({ op: z.literal("stop.remove"), stopId: id }),
  z.object({
    op: z.literal("stop.move"),
    stopId: id,
    toDayId: id,
    toIndex: z.number().int().min(0).max(30),
  }),
  z.object({
    op: z.literal("hotel.set"),
    dayId: id,
    patch: z
      .object({
        roomType: line(80),
        mealPlan: z.enum(MEAL_PLANS).nullable(),
        checkIn: time,
        checkOut: time,
      })
      .partial(),
  }),
  /**
   * Swap the night's hotel. `placeId` → the server rebuilds name/address/photo
   * from the Places cache and marks it verified; `manual` → unverified. The
   * `preview` is only for the optimistic client copy and is ignored server-side.
   */
  z.object({
    op: z.literal("hotel.replace"),
    dayId: id,
    hotelId: id,
    placeId: z.string().min(3).max(200).optional(),
    manual: z.object({ name: z.string().trim().min(2).max(120), address: line(240) }).optional(),
    preview: z
      .object({
        name: z.string().max(120),
        address: z.string().max(240).nullable(),
        image: imageSchema.nullable(),
      })
      .optional(),
  }),
  z.object({ op: z.literal("hotel.remove"), dayId: id }),
]);

export type EditorOp = z.infer<typeof editorOpSchema>;

export const opsPayloadSchema = z.array(editorOpSchema).min(1).max(200);

/** Structural ops change order or count and are saved immediately; the rest are debounced. */
export function isStructural(op: EditorOp): boolean {
  return [
    "day.reorder",
    "day.add",
    "day.remove",
    "stop.add",
    "stop.remove",
    "stop.move",
    "hotel.replace",
    "hotel.remove",
  ].includes(op.op);
}

/**
 * Coalescing key: two queued ops with the same key can be merged (the later
 * patch wins field by field). Structural ops never merge.
 */
export function coalesceKey(op: EditorOp): string | null {
  switch (op.op) {
    case "itinerary.set":
      return "itinerary";
    case "client.set":
    case "pricing.set":
    case "sections.set":
      return op.op;
    case "day.set":
      return `day:${op.dayId}`;
    case "stop.set":
      return `stop:${op.stopId}`;
    case "hotel.set":
      return `hotel:${op.dayId}`;
    default:
      return null;
  }
}

export function mergeOps(a: EditorOp, b: EditorOp): EditorOp {
  if (a.op !== b.op) return b;
  if ("patch" in a && "patch" in b) {
    return { ...b, patch: { ...a.patch, ...b.patch } } as EditorOp;
  }
  if (a.op === "itinerary.set" && b.op === "itinerary.set") return { ...a, ...b };
  return b;
}

// ── Dates ────────────────────────────────────────────────────────────────
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Day N is start + (N-1); the end date is the last day. Null start → no dates. */
export function reflow(doc: EditorDoc): EditorDoc {
  const start = doc.startDate;
  const days = doc.days.map((d, i) => ({ ...d, date: start ? addDays(start, i) : null }));
  return {
    ...doc,
    days,
    endDate: start && days.length ? addDays(start, days.length - 1) : null,
  };
}

// ── Reducer (optimistic client copy; mirrors the server's persistence) ───
export function applyOp(doc: EditorDoc, op: EditorOp): EditorDoc {
  switch (op.op) {
    case "itinerary.set": {
      const next: EditorDoc = {
        ...doc,
        ...(op.title !== undefined && { title: op.title }),
        ...(op.status !== undefined && { status: op.status }),
      };
      if (op.startDate !== undefined) return reflow({ ...next, startDate: op.startDate });
      return next;
    }
    case "client.set":
      return { ...doc, client: op.client };
    case "pricing.set":
      return { ...doc, pricing: op.pricing };
    case "sections.set":
      return { ...doc, sections: op.sections };
    case "day.set":
      return mapDay(doc, op.dayId, (d) => ({ ...d, ...op.patch }));
    case "day.reorder": {
      const byId = new Map(doc.days.map((d) => [d.id, d]));
      if (op.order.length !== doc.days.length || op.order.some((x) => !byId.has(x))) return doc;
      return reflow({ ...doc, days: op.order.map((x) => byId.get(x)!) });
    }
    case "day.add": {
      const at = op.after === null ? 0 : doc.days.findIndex((d) => d.id === op.after) + 1;
      const day: EditorDay = {
        id: op.dayId,
        date: null,
        city: op.city,
        title: op.title,
        summary: "",
        transport: "",
        hero: null,
        stops: [],
        hotel: null,
      };
      const days = [...doc.days];
      days.splice(at, 0, day);
      return reflow({ ...doc, days });
    }
    case "day.remove":
      return reflow({ ...doc, days: doc.days.filter((d) => d.id !== op.dayId) });
    case "stop.set":
      return mapStops(doc, (s) => (s.id === op.stopId ? { ...s, ...op.patch } : s));
    case "stop.add":
      return mapDay(doc, op.dayId, (d) => {
        const stops = [...d.stops];
        stops.splice(Math.min(op.index, stops.length), 0, {
          id: op.stopId,
          kind: op.kind,
          title: op.title,
          description: "",
          time: null,
          duration: null,
          placeId: null,
          verified: false,
          image: null,
        });
        return { ...d, stops };
      });
    case "stop.remove":
      return {
        ...doc,
        days: doc.days.map((d) => ({ ...d, stops: d.stops.filter((s) => s.id !== op.stopId) })),
      };
    case "stop.move": {
      const stop = doc.days.flatMap((d) => d.stops).find((s) => s.id === op.stopId);
      if (!stop || !doc.days.some((d) => d.id === op.toDayId)) return doc;
      const days = doc.days.map((d) => ({
        ...d,
        stops: d.stops.filter((s) => s.id !== op.stopId),
      }));
      return {
        ...doc,
        days: days.map((d) => {
          if (d.id !== op.toDayId) return d;
          const stops = [...d.stops];
          stops.splice(Math.min(op.toIndex, stops.length), 0, stop);
          return { ...d, stops };
        }),
      };
    }
    case "hotel.set":
      return mapDay(doc, op.dayId, (d) =>
        d.hotel ? { ...d, hotel: { ...d.hotel, ...op.patch } } : d,
      );
    case "hotel.replace":
      return mapDay(doc, op.dayId, (d) => {
        const name = op.preview?.name ?? op.manual?.name ?? "Hotel";
        return {
          ...d,
          hotel: {
            id: op.hotelId,
            name,
            city: d.city,
            address: op.preview?.address ?? op.manual?.address ?? null,
            placeId: op.placeId ?? null,
            verified: !!op.placeId,
            manual: !op.placeId,
            roomType: d.hotel?.roomType ?? "",
            mealPlan: d.hotel?.mealPlan ?? "CP",
            checkIn: d.hotel?.checkIn ?? "14:00",
            checkOut: d.hotel?.checkOut ?? "11:00",
            image: op.preview?.image ?? null,
          },
        };
      });
    case "hotel.remove":
      return mapDay(doc, op.dayId, (d) => ({ ...d, hotel: null }));
  }
}

function mapDay(doc: EditorDoc, dayId: string, fn: (d: EditorDay) => EditorDay): EditorDoc {
  return { ...doc, days: doc.days.map((d) => (d.id === dayId ? fn(d) : d)) };
}

function mapStops(doc: EditorDoc, fn: (s: EditorStop) => EditorStop): EditorDoc {
  return { ...doc, days: doc.days.map((d) => ({ ...d, stops: d.stops.map(fn) })) };
}

// ── Ownership check (server) ─────────────────────────────────────────────
export type OwnedRefs = {
  dayIds: Set<string>;
  stopIds: Set<string>;
};

/**
 * Every id an op references must belong to this itinerary; ids an op creates
 * must be new. Tracks ids created/removed earlier in the same batch. Returns
 * the first problem, or null. Never trust ids from the client.
 */
export function checkOpRefs(ops: EditorOp[], owned: OwnedRefs): string | null {
  const days = new Set(owned.dayIds);
  const stops = new Set(owned.stopIds);
  const needDay = (x: string) => (days.has(x) ? null : `Unknown day ${x}`);
  const needStop = (x: string) => (stops.has(x) ? null : `Unknown stop ${x}`);

  for (const op of ops) {
    let err: string | null = null;
    switch (op.op) {
      case "day.set":
      case "hotel.set":
      case "hotel.replace":
      case "hotel.remove":
        err = needDay(op.dayId);
        break;
      case "day.reorder":
        if (op.order.length !== days.size || op.order.some((x) => !days.has(x)))
          err = "Day order must list every day exactly once";
        else if (new Set(op.order).size !== op.order.length) err = "Duplicate day in order";
        break;
      case "day.add":
        if (days.has(op.dayId) || owned.dayIds.has(op.dayId)) err = "Day id already exists";
        else if (op.after !== null) err = needDay(op.after);
        if (!err) days.add(op.dayId);
        break;
      case "day.remove":
        err = needDay(op.dayId);
        if (!err && days.size <= 1) err = "An itinerary needs at least one day";
        if (!err) days.delete(op.dayId);
        break;
      case "stop.set":
      case "stop.remove":
        err = needStop(op.stopId);
        if (!err && op.op === "stop.remove") stops.delete(op.stopId);
        break;
      case "stop.add":
        if (stops.has(op.stopId) || owned.stopIds.has(op.stopId)) err = "Stop id already exists";
        else err = needDay(op.dayId);
        if (!err) stops.add(op.stopId);
        break;
      case "stop.move":
        err = needStop(op.stopId) ?? needDay(op.toDayId);
        break;
      default:
        break;
    }
    if (err) return err;
  }
  return null;
}
