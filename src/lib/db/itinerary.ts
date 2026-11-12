import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { type LearningCandidate, shouldRecordLearning } from "@/lib/ai/learning-policy";
import { env } from "@/lib/env";
import type { VerifiedDay } from "@/lib/itinerary/verify";
import { addDays, checkOpRefs, type EditorOp } from "@/lib/itinerary/doc";

import type { Db } from "./index";
import * as schema from "./schema";

/**
 * Itinerary editing for one tenant. Only reachable through `tenantScope()`
 * (src/lib/db/tenant.ts), which validates the tenant id from the session.
 * Every entry point first loads the itinerary with `tenant_id = $tenant`, so a
 * guessed itinerary id from another tenant is simply "not found".
 */
export class NotFoundError extends Error {
  constructor(message = "Itinerary not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class InvalidEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidEditError";
  }
}

export type ResolvedPlace = {
  name: string;
  address: string | null;
  image: schema.ImageRef | null;
};

export type ItineraryTree = typeof schema.itineraries.$inferSelect & {
  days: (typeof schema.days.$inferSelect & {
    stops: (typeof schema.stops.$inferSelect)[];
    hotel: typeof schema.hotels.$inferSelect | null;
  })[];
};

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export function itineraryRepo(tenantId: string, conn: Db) {
  async function own(tx: Db | Tx, itineraryId: string, opts: { includeDeleted?: boolean } = {}) {
    const row = await tx.query.itineraries.findFirst({
      where: and(
        eq(schema.itineraries.id, itineraryId),
        eq(schema.itineraries.tenantId, tenantId),
        opts.includeDeleted ? undefined : isNull(schema.itineraries.deletedAt),
      ),
    });
    if (!row) throw new NotFoundError();
    return row;
  }

  async function tree(tx: Db | Tx, itineraryId: string): Promise<ItineraryTree> {
    const it = await own(tx, itineraryId);
    const days = await tx.query.days.findMany({
      where: eq(schema.days.itineraryId, it.id),
      orderBy: [asc(schema.days.position)],
      with: {
        stops: { orderBy: [asc(schema.stops.position)] },
        hotels: { orderBy: [desc(schema.hotels.createdAt)], limit: 1 },
      },
    });
    return {
      ...it,
      days: days.map(({ hotels, ...d }) => ({ ...d, hotel: hotels[0] ?? null })),
    };
  }

  async function reflowDates(tx: Tx, it: { id: string; startDate: string | null }) {
    const days = await tx
      .select({ id: schema.days.id })
      .from(schema.days)
      .where(eq(schema.days.itineraryId, it.id))
      .orderBy(asc(schema.days.position));
    for (const [i, d] of days.entries()) {
      await tx
        .update(schema.days)
        .set({ position: i, date: it.startDate ? addDays(it.startDate, i) : null })
        .where(eq(schema.days.id, d.id));
    }
    await tx
      .update(schema.itineraries)
      .set({
        endDate: it.startDate && days.length ? addDays(it.startDate, days.length - 1) : null,
      })
      .where(eq(schema.itineraries.id, it.id));
  }

  async function stopOrder(tx: Tx, dayId: string): Promise<string[]> {
    const rows = await tx
      .select({ id: schema.stops.id })
      .from(schema.stops)
      .where(eq(schema.stops.dayId, dayId))
      .orderBy(asc(schema.stops.position));
    return rows.map((r) => r.id);
  }

  async function writeStopOrder(tx: Tx, dayId: string, ids: string[]) {
    for (const [i, sid] of ids.entries()) {
      await tx
        .update(schema.stops)
        .set({ position: i, dayId, updatedAt: new Date() })
        .where(eq(schema.stops.id, sid));
    }
  }

  async function learn(
    tx: Tx,
    it: typeof schema.itineraries.$inferSelect,
    candidate: LearningCandidate,
    payload: Record<string, unknown>,
  ) {
    if (!shouldRecordLearning(candidate, { mockAi: env.MOCK_AI === "1" })) return;
    const kind = candidate.kind;
    const destination = String((it.brief as { destination?: string } | null)?.destination ?? "");
    if (!destination) return;
    await tx.insert(schema.tenantLearnings).values({ tenantId, destination, kind, payload });
  }

  return {
    getItineraryTree(itineraryId: string) {
      return tree(conn, itineraryId);
    },

    /**
     * Applies an editor batch atomically. Ids are checked against this
     * itinerary before anything is written; `resolvePlace` turns a Places id
     * into trusted hotel data (the client's preview is never stored).
     */
    async applyOps(
      itineraryId: string,
      ops: EditorOp[],
      resolvePlace: (placeId: string) => Promise<ResolvedPlace | null>,
    ) {
      return conn.transaction(async (tx) => {
        const it = await own(tx, itineraryId);
        const dayRows = await tx
          .select({ id: schema.days.id, city: schema.days.city })
          .from(schema.days)
          .where(eq(schema.days.itineraryId, it.id));
        const dayIds = new Set(dayRows.map((d) => d.id));
        const cityOf = new Map(dayRows.map((d) => [d.id, d.city ?? ""]));
        const stopRows = dayIds.size
          ? await tx
              .select({ id: schema.stops.id, dayId: schema.stops.dayId })
              .from(schema.stops)
              .where(inArray(schema.stops.dayId, [...dayIds]))
          : [];
        const problem = checkOpRefs(ops, { dayIds, stopIds: new Set(stopRows.map((s) => s.id)) });
        if (problem) throw new InvalidEditError(problem);

        const stopDay = new Map(stopRows.map((s) => [s.id, s.dayId]));
        let startDate = it.startDate;
        let needsReflow = false;
        const now = new Date();

        for (const op of ops) {
          switch (op.op) {
            case "itinerary.set": {
              const patch: Partial<typeof schema.itineraries.$inferInsert> = {};
              if (op.title !== undefined) patch.title = op.title;
              if (op.status !== undefined) patch.status = op.status;
              if (op.startDate !== undefined) {
                patch.startDate = op.startDate;
                startDate = op.startDate;
                needsReflow = true;
              }
              if (Object.keys(patch).length)
                await tx
                  .update(schema.itineraries)
                  .set(patch)
                  .where(eq(schema.itineraries.id, it.id));
              break;
            }
            case "client.set":
              await tx
                .update(schema.itineraries)
                .set({ client: op.client })
                .where(eq(schema.itineraries.id, it.id));
              break;
            case "pricing.set":
              await tx
                .update(schema.itineraries)
                .set({ pricing: op.pricing })
                .where(eq(schema.itineraries.id, it.id));
              break;
            case "sections.set":
              await tx
                .update(schema.itineraries)
                .set({ sections: op.sections })
                .where(eq(schema.itineraries.id, it.id));
              break;
            case "day.set":
              if (op.patch.city !== undefined) cityOf.set(op.dayId, op.patch.city);
              await tx
                .update(schema.days)
                .set({ ...op.patch, updatedAt: now })
                .where(eq(schema.days.id, op.dayId));
              break;
            case "day.reorder":
              for (const [i, did] of op.order.entries()) {
                await tx.update(schema.days).set({ position: i }).where(eq(schema.days.id, did));
              }
              needsReflow = true;
              break;
            case "day.add": {
              let position = 0;
              if (op.after) {
                const [after] = await tx
                  .select({ position: schema.days.position })
                  .from(schema.days)
                  .where(eq(schema.days.id, op.after));
                position = (after?.position ?? -1) + 1;
              }
              // Make room, then insert; reflow renumbers densely afterwards.
              const later = await tx
                .select({ id: schema.days.id, position: schema.days.position })
                .from(schema.days)
                .where(eq(schema.days.itineraryId, it.id));
              for (const d of later.filter((d) => d.position >= position)) {
                await tx
                  .update(schema.days)
                  .set({ position: d.position + 1 })
                  .where(eq(schema.days.id, d.id));
              }
              await tx.insert(schema.days).values({
                id: op.dayId,
                itineraryId: it.id,
                position,
                title: op.title,
                city: op.city,
                summary: "",
                transport: "",
              });
              cityOf.set(op.dayId, op.city);
              needsReflow = true;
              break;
            }
            case "day.remove":
              await tx.delete(schema.days).where(eq(schema.days.id, op.dayId));
              needsReflow = true;
              break;
            case "stop.set":
              await tx
                .update(schema.stops)
                .set({ ...op.patch, updatedAt: now })
                .where(eq(schema.stops.id, op.stopId));
              break;
            case "stop.add": {
              const order = await stopOrder(tx, op.dayId);
              await tx.insert(schema.stops).values({
                id: op.stopId,
                dayId: op.dayId,
                position: order.length,
                kind: op.kind,
                title: op.title,
                description: "",
              });
              order.splice(Math.min(op.index, order.length), 0, op.stopId);
              await writeStopOrder(tx, op.dayId, order);
              stopDay.set(op.stopId, op.dayId);
              if (op.title.trim().length >= 3)
                await learn(
                  tx,
                  it,
                  { kind: "stop_added" },
                  {
                    title: op.title.trim(),
                    city: cityOf.get(op.dayId) ?? "",
                  },
                );
              break;
            }
            case "stop.remove":
              await tx.delete(schema.stops).where(eq(schema.stops.id, op.stopId));
              stopDay.delete(op.stopId);
              break;
            case "stop.move": {
              const from = stopDay.get(op.stopId)!;
              const source = (await stopOrder(tx, from)).filter((x) => x !== op.stopId);
              if (from !== op.toDayId) await writeStopOrder(tx, from, source);
              const target = from === op.toDayId ? source : await stopOrder(tx, op.toDayId);
              target.splice(Math.min(op.toIndex, target.length), 0, op.stopId);
              await writeStopOrder(tx, op.toDayId, target);
              stopDay.set(op.stopId, op.toDayId);
              break;
            }
            case "hotel.set":
              await tx
                .update(schema.hotels)
                .set({ ...op.patch, updatedAt: now })
                .where(eq(schema.hotels.dayId, op.dayId));
              break;
            case "hotel.replace": {
              const [prev] = await tx
                .select()
                .from(schema.hotels)
                .where(eq(schema.hotels.dayId, op.dayId))
                .limit(1);
              let data: { name: string; address: string | null; image: schema.ImageRef | null };
              let verified = false;
              if (op.placeId) {
                const place = await resolvePlace(op.placeId);
                if (!place) throw new InvalidEditError("That hotel is no longer in search results");
                data = place;
                verified = true;
              } else if (op.manual) {
                data = { name: op.manual.name, address: op.manual.address || null, image: null };
              } else {
                throw new InvalidEditError("Choose a hotel or enter one manually");
              }
              await tx.delete(schema.hotels).where(eq(schema.hotels.dayId, op.dayId));
              await tx.insert(schema.hotels).values({
                id: op.hotelId,
                dayId: op.dayId,
                name: data.name,
                city: cityOf.get(op.dayId) || null,
                address: data.address,
                image: data.image,
                placeId: op.placeId ?? null,
                verified,
                manual: !op.placeId,
                roomType: prev?.roomType ?? null,
                mealPlan: prev?.mealPlan ?? "CP",
                checkIn: prev?.checkIn ?? "14:00",
                checkOut: prev?.checkOut ?? "11:00",
              });
              await learn(
                tx,
                it,
                { kind: "hotel_swap", placeId: op.placeId },
                {
                  from: prev?.name ?? "",
                  to: data.name,
                  city: cityOf.get(op.dayId) ?? "",
                },
              );
              break;
            }
            case "hotel.remove":
              await tx.delete(schema.hotels).where(eq(schema.hotels.dayId, op.dayId));
              break;
          }
        }

        if (needsReflow) await reflowDates(tx, { id: it.id, startDate });
        const [row] = await tx
          .update(schema.itineraries)
          .set({ updatedAt: now })
          .where(eq(schema.itineraries.id, it.id))
          .returning({ updatedAt: schema.itineraries.updatedAt });
        return { updatedAt: row!.updatedAt };
      });
    },

    /**
     * Deep copy. `template: true` makes a template (no client, no dates,
     * pricing amounts cleared); copying a template makes a fresh draft.
     */
    async duplicate(itineraryId: string, opts: { template?: boolean } = {}) {
      const src = await tree(conn, itineraryId);
      const toTemplate = !!opts.template;
      const fromTemplate = src.isTemplate && !toTemplate;
      const keepDates = !toTemplate && !fromTemplate;
      return conn.transaction(async (tx) => {
        const [row] = await tx
          .insert(schema.itineraries)
          .values({
            tenantId,
            title:
              toTemplate || fromTemplate
                ? src.title.replace(/(\s\(copy\))+$/, "")
                : `${src.title.replace(/(\s\(copy\))+$/, "")} (copy)`,
            status: "draft",
            client: toTemplate ? null : fromTemplate ? null : src.client,
            brief: src.brief,
            startDate: keepDates ? src.startDate : null,
            endDate: keepDates ? src.endDate : null,
            pricing:
              toTemplate && src.pricing
                ? {
                    ...src.pricing,
                    total: null,
                    per_person: null,
                    per_adult: null,
                    per_child: null,
                    show: false,
                  }
                : src.pricing,
            sections: src.sections,
            isTemplate: toTemplate,
          })
          .returning();
        if (!row) throw new Error("copy failed");
        for (const d of src.days) {
          const [day] = await tx
            .insert(schema.days)
            .values({
              itineraryId: row.id,
              position: d.position,
              date: keepDates ? d.date : null,
              city: d.city,
              title: d.title,
              summary: d.summary,
              transport: d.transport,
              heroImage: d.heroImage,
            })
            .returning({ id: schema.days.id });
          if (d.stops.length)
            await tx.insert(schema.stops).values(
              d.stops.map(({ id: _id, dayId: _d, createdAt: _c, updatedAt: _u, ...s }) => ({
                ...s,
                dayId: day!.id,
              })),
            );
          if (d.hotel) {
            const { id: _id, dayId: _d, createdAt: _c, updatedAt: _u, ...h } = d.hotel;
            await tx.insert(schema.hotels).values({ ...h, dayId: day!.id });
          }
        }
        return row;
      });
    },

    async softDelete(itineraryId: string) {
      const it = await own(conn, itineraryId);
      await conn
        .update(schema.itineraries)
        .set({ deletedAt: new Date() })
        .where(eq(schema.itineraries.id, it.id));
    },

    /** Dashboard rows: live itineraries or templates, plus the client-view info. */
    async listForDashboard(opts: { templates?: boolean } = {}) {
      const rows = await conn.query.itineraries.findMany({
        where: and(
          eq(schema.itineraries.tenantId, tenantId),
          isNull(schema.itineraries.deletedAt),
          eq(schema.itineraries.isTemplate, !!opts.templates),
        ),
        orderBy: [desc(schema.itineraries.updatedAt)],
        with: {
          days: {
            columns: { id: true, city: true, heroImage: true, position: true },
            orderBy: [asc(schema.days.position)],
          },
          shareLinks: { columns: { lastViewedAt: true, viewCount: true } },
        },
      });
      return rows.map((r) => {
        const views = r.shareLinks
          .map((s) => s.lastViewedAt)
          .filter((d): d is Date => !!d)
          .sort((a, b) => b.getTime() - a.getTime());
        return {
          ...r,
          lastViewedAt: views[0] ?? null,
          hero: r.days.find((d) => d.heroImage)?.heroImage ?? null,
          cities: [...new Set(r.days.map((d) => d.city).filter((c): c is string => !!c))],
        };
      });
    },

    /** Regenerate-day result: replace one day's content, keep its id, position and date. */
    async replaceDay(itineraryId: string, dayId: string, d: VerifiedDay) {
      const it = await own(conn, itineraryId);
      return conn.transaction(async (tx) => {
        const [day] = await tx
          .select({ id: schema.days.id })
          .from(schema.days)
          .where(and(eq(schema.days.id, dayId), eq(schema.days.itineraryId, it.id)));
        if (!day) throw new NotFoundError("Day not found");
        await tx
          .update(schema.days)
          .set({
            title: d.title,
            city: d.city,
            summary: d.summary,
            transport: d.transport,
            heroImage: d.hero_image,
            updatedAt: new Date(),
          })
          .where(eq(schema.days.id, day.id));
        await tx.delete(schema.stops).where(eq(schema.stops.dayId, day.id));
        if (d.stops.length)
          await tx.insert(schema.stops).values(d.stops.map((s, i) => stopRow(day.id, i, s)));
        await tx.delete(schema.hotels).where(eq(schema.hotels.dayId, day.id));
        if (d.hotel) await tx.insert(schema.hotels).values(hotelRow(day.id, d.city, d.hotel));
        await tx
          .update(schema.itineraries)
          .set({ updatedAt: new Date() })
          .where(eq(schema.itineraries.id, it.id));
      });
    },
  };
}

export function stopRow(dayId: string, position: number, s: VerifiedDay["stops"][number]) {
  return {
    dayId,
    position,
    kind: s.kind,
    title: s.title,
    description: s.description || null,
    time: s.time,
    duration: s.duration,
    placeId: s.place_id,
    verified: s.verified,
    image: s.image,
  };
}

export function hotelRow(dayId: string, city: string, h: NonNullable<VerifiedDay["hotel"]>) {
  return {
    dayId,
    name: h.name,
    city,
    placeId: h.place_id,
    verified: h.verified,
    roomType: h.room_type,
    mealPlan: h.meal_plan,
    checkIn: h.check_in,
    checkOut: h.check_out,
    address: h.address,
    image: h.image,
    manual: false,
  };
}
