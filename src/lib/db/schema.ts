import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ── Enums ────────────────────────────────────────────────────────────────
export const tenantStatusEnum = pgEnum("tenant_status", ["trial", "active", "suspended"]);
export const userRoleEnum = pgEnum("user_role", ["admin", "superadmin"]);
export const itineraryStatusEnum = pgEnum("itinerary_status", [
  "draft",
  "sent",
  "confirmed",
  "lost",
]);
export const stopKindEnum = pgEnum("stop_kind", ["sight", "activity", "meal", "transfer", "note"]);
export const usageKindEnum = pgEnum("usage_kind", ["ai", "places_search", "places_photo", "pdf"]);

// ── JSON shapes (mirrored by zod in src/lib/db/json.ts) ──────────────────
export type TenantBranding = {
  logo_url: string | null;
  theme_color: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  address: string;
  /** Printed in the client footer when present (DESIGN.md deviation 6). */
  gstin: string;
  licence_no: string;
  footer: string;
};

export type TenantDefaults = {
  inclusions: string;
  exclusions: string;
  payment_terms: string;
  cancellation: string;
};

export type ImageRef = {
  source: "place" | "pexels" | "wikimedia" | "placeholder";
  /** Google photo resource name, R2 key, or placeholder id — never photo bytes. */
  ref: string;
  attribution?: string | null;
  attribution_url?: string | null;
  width?: number;
  height?: number;
};

export type ItineraryClient = {
  name: string;
  phone?: string;
  email?: string;
  /** DESIGN.md deviation 7. */
  city?: string;
  referred_by?: string;
  pax: { adults: number; children: number; child_ages: number[] };
};

export type ItineraryPricing = {
  mode: "total" | "per_person" | "per_adult_child";
  show: boolean;
  total: number | null;
  per_person: number | null;
  per_adult: number | null;
  per_child: number | null;
  currency: string;
};

export type ItinerarySections = {
  inclusions: string;
  exclusions: string;
  payment_terms: string;
  cancellation: string;
};

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

// ── Tenancy ──────────────────────────────────────────────────────────────
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  customDomain: text("custom_domain").unique(),
  status: tenantStatusEnum("status").notNull().default("active"),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  plan: text("plan").notNull().default("standard"),
  /** Shown in admin as "AI calls / month" (DESIGN.md deviation 4). */
  dailyGenCap: integer("daily_gen_cap").notNull().default(50),
  monthlyPdfCap: integer("monthly_pdf_cap").notNull().default(200),
  branding: jsonb("branding").$type<TenantBranding>().notNull(),
  defaults: jsonb("defaults").$type<TenantDefaults>().notNull(),
  ...timestamps,
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: userRoleEnum("role").notNull().default("admin"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_email_idx").on(sql`lower(${t.email})`),
    index("users_tenant_idx").on(t.tenantId),
  ],
);

// ── Auth ─────────────────────────────────────────────────────────────────
export const loginTokens = pgTable(
  "login_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_tokens_email_idx").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ── Itineraries ──────────────────────────────────────────────────────────
export const itineraries = pgTable(
  "itineraries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: itineraryStatusEnum("status").notNull().default("draft"),
    client: jsonb("client").$type<ItineraryClient>(),
    brief: jsonb("brief").$type<Record<string, unknown>>(),
    startDate: date("start_date"),
    endDate: date("end_date"),
    pricing: jsonb("pricing").$type<ItineraryPricing>(),
    sections: jsonb("sections").$type<ItinerarySections>(),
    isTemplate: boolean("is_template").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("itineraries_tenant_idx").on(t.tenantId),
    index("itineraries_status_idx").on(t.tenantId, t.status),
  ],
);

export const days = pgTable(
  "days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itineraryId: uuid("itinerary_id")
      .notNull()
      .references(() => itineraries.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    date: date("date"),
    title: text("title").notNull(),
    summary: text("summary"),
    transport: text("transport"),
    heroImage: jsonb("hero_image").$type<ImageRef>(),
    ...timestamps,
  },
  (t) => [index("days_itinerary_idx").on(t.itineraryId, t.position)],
);

export const stops = pgTable(
  "stops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dayId: uuid("day_id")
      .notNull()
      .references(() => days.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    kind: stopKindEnum("kind").notNull().default("sight"),
    title: text("title").notNull(),
    description: text("description"),
    duration: text("duration"),
    placeId: text("place_id"),
    verified: boolean("verified").notNull().default(false),
    image: jsonb("image").$type<ImageRef>(),
    ...timestamps,
  },
  (t) => [index("stops_day_idx").on(t.dayId, t.position)],
);

export const hotels = pgTable(
  "hotels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dayId: uuid("day_id")
      .notNull()
      .references(() => days.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    placeId: text("place_id"),
    verified: boolean("verified").notNull().default(false),
    roomType: text("room_type"),
    mealPlan: text("meal_plan"),
    checkIn: text("check_in"),
    checkOut: text("check_out"),
    address: text("address"),
    image: jsonb("image").$type<ImageRef>(),
    manual: boolean("manual").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("hotels_day_idx").on(t.dayId)],
);

// ── Sharing ──────────────────────────────────────────────────────────────
export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itineraryId: uuid("itinerary_id")
      .notNull()
      .references(() => itineraries.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    enabled: boolean("enabled").notNull().default(true),
    viewCount: integer("view_count").notNull().default(0),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("share_links_itinerary_idx").on(t.itineraryId)],
);

// ── Places + usage + audit + learning ────────────────────────────────────
export const placesCache = pgTable("places_cache", {
  placeId: text("place_id").primaryKey(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UsageMeta = {
  provider?: string;
  model?: string;
  tokens_in?: number;
  tokens_out?: number;
  ms?: number;
  op?: string;
  ok?: boolean;
};

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
    kind: usageKindEnum("kind").notNull(),
    costUnits: integer("cost_units").notNull().default(1),
    meta: jsonb("meta").$type<UsageMeta>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("usage_events_tenant_kind_idx").on(t.tenantId, t.kind, t.createdAt),
    index("usage_events_kind_idx").on(t.kind, t.createdAt),
  ],
);

/** Text Search read-through cache: normalised query → top results (30 days). */
export const placesQueries = pgTable("places_queries", {
  query: text("query").primaryKey(),
  payload: jsonb("payload").$type<Record<string, unknown>[]>().notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Destination images cached in R2 (Pexels / Wikimedia), keyed by search query. */
export const destinationImages = pgTable("destination_images", {
  query: text("query").primaryKey(),
  image: jsonb("image").$type<ImageRef>().notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const generationStatusEnum = pgEnum("generation_status", [
  "queued",
  "enhancing",
  "drafting",
  "verifying",
  "photos",
  "done",
  "failed",
]);

export type GenerationProgress = {
  /** Steps completed so far with their one-line result, for the progress screen. */
  steps: { name: string; result: string; ms: number }[];
  /** Day titles as soon as drafting completes ("Drafted so far"). */
  days?: string[];
  verified?: { hotels: number; hotels_total: number; stops: number; stops_total: number };
};

/** One row per generation job; the UI polls it (PNG 10). */
export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    itineraryId: uuid("itinerary_id").references(() => itineraries.id, { onDelete: "set null" }),
    prompt: text("prompt").notNull(),
    brief: jsonb("brief").$type<Record<string, unknown>>(),
    status: generationStatusEnum("status").notNull().default("queued"),
    progress: jsonb("progress").$type<GenerationProgress>().notNull().default({ steps: [] }),
    error: text("error"),
    ...timestamps,
  },
  (t) => [index("generation_jobs_tenant_idx").on(t.tenantId, t.createdAt)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_tenant_idx").on(t.tenantId, t.createdAt)],
);

export const tenantLearnings = pgTable(
  "tenant_learnings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    destination: text("destination").notNull(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tenant_learnings_dest_idx").on(t.tenantId, t.destination)],
);

// ── Relations ────────────────────────────────────────────────────────────
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  itineraries: many(itineraries),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const itinerariesRelations = relations(itineraries, ({ one, many }) => ({
  tenant: one(tenants, { fields: [itineraries.tenantId], references: [tenants.id] }),
  days: many(days),
  shareLinks: many(shareLinks),
}));

export const daysRelations = relations(days, ({ one, many }) => ({
  itinerary: one(itineraries, { fields: [days.itineraryId], references: [itineraries.id] }),
  stops: many(stops),
  hotels: many(hotels),
}));

export const stopsRelations = relations(stops, ({ one }) => ({
  day: one(days, { fields: [stops.dayId], references: [days.id] }),
}));

export const hotelsRelations = relations(hotels, ({ one }) => ({
  day: one(days, { fields: [hotels.dayId], references: [days.id] }),
}));

export const shareLinksRelations = relations(shareLinks, ({ one }) => ({
  itinerary: one(itineraries, { fields: [shareLinks.itineraryId], references: [itineraries.id] }),
}));
