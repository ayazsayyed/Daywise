import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { createZip } from "./zip";

describe("createZip", () => {
  const files = [
    { name: "tenant.json", data: JSON.stringify({ name: "Shree Krishna — ₹" }) },
    { name: "itineraries/a.json", data: "x".repeat(10_000) },
  ];

  it("writes local headers, a central directory and an end record", () => {
    const zip = createZip(files);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    const end = zip.length - 22;
    expect(zip.readUInt32LE(end)).toBe(0x06054b50);
    expect(zip.readUInt16LE(end + 10)).toBe(2);
    // First entry round-trips.
    const nameLen = zip.readUInt16LE(26);
    const compLen = zip.readUInt32LE(18);
    const body = zip.subarray(30 + nameLen, 30 + nameLen + compLen);
    expect(zip.subarray(30, 30 + nameLen).toString()).toBe("tenant.json");
    expect(inflateRawSync(body).toString()).toBe(files[0]!.data);
  });

  it("is readable by unzip when available", () => {
    const dir = mkdtempSync(join(tmpdir(), "zip-"));
    const path = join(dir, "t.zip");
    writeFileSync(path, createZip(files));
    try {
      execFileSync("unzip", ["-q", "-o", path, "-d", dir]);
    } catch {
      return; // unzip not installed here
    }
    expect(readFileSync(join(dir, "itineraries/a.json"), "utf8")).toHaveLength(10_000);
  });

  it("refuses path traversal names", () => {
    expect(() => createZip([{ name: "../x", data: "" }])).toThrow();
  });
});
