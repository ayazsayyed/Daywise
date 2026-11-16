/** What an uploaded file really is, from its first bytes (not the declared type). */
export type Sniffed = "png" | "jpg" | "svg" | null;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

export function sniffImage(bytes: Buffer): Sniffed {
  if (bytes.subarray(0, 8).equals(PNG_MAGIC)) return "png";
  if (bytes.subarray(0, 3).equals(JPG_MAGIC)) return "jpg";
  const head = bytes.subarray(0, 512).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "svg";
  return null;
}
