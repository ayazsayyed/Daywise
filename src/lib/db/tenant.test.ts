import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { assertTenantId, tenantWhere, TenantIsolationError } from "./tenant";
import * as schema from "./schema";

const dialect = new PgDialect();
const TENANT = "0f1e2d3c-4b5a-4697-8899-aabbccddeeff";

describe("assertTenantId", () => {
  it("accepts a UUID", () => {
    expect(assertTenantId(TENANT)).toBe(TENANT);
  });

  it.each(["", "sktw", "1", null, undefined, 42, "0f1e2d3c-4b5a-4697-8899"])(
    "rejects %p",
    (bad) => {
      expect(() => assertTenantId(bad)).toThrow(TenantIsolationError);
    },
  );
});

describe("tenantWhere", () => {
  it("always includes the tenant_id predicate", () => {
    const q = dialect.sqlToQuery(tenantWhere(schema.itineraries, TENANT));
    expect(q.sql).toContain('"itineraries"."tenant_id" = ');
    expect(q.params).toEqual([TENANT]);
  });

  it("ANDs extra conditions and drops undefined ones", () => {
    const q = dialect.sqlToQuery(
      tenantWhere(schema.itineraries, TENANT, undefined, eq(schema.itineraries.status, "sent")),
    );
    expect(q.sql).toContain('"itineraries"."tenant_id" = ');
    expect(q.sql).toContain('"itineraries"."status" = ');
    expect(q.sql).toMatch(/ and /i);
    expect(q.params).toEqual([TENANT, "sent"]);
  });

  it("refuses a non-UUID tenant id even with other conditions", () => {
    expect(() =>
      tenantWhere(schema.itineraries, "not-a-tenant", eq(schema.itineraries.status, "sent")),
    ).toThrow(TenantIsolationError);
  });
});
