/**
 * wa.me links. Numbers are reduced to digits; a bare 10-digit Indian mobile
 * gets the 91 country code. An empty number opens WhatsApp's contact picker.
 */
export function waDigits(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

export function waHref(phone: string | null | undefined, text: string): string {
  const to = waDigits(phone);
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

export function telHref(phone: string): string {
  const raw = phone.trim();
  return `tel:${raw.startsWith("+") ? "+" : ""}${raw.replace(/\D/g, "")}`;
}

/** First name for a friendly greeting: "Ananya & Rohit Kapoor" → "Ananya". */
export function firstName(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "";
  return n.split(/\s*(?:&|and|,)\s*|\s+/i)[0] ?? n;
}

/** Day 4 brief: "Hi <client>, here is your <destination> itinerary from <agency>: <link>". */
export function agentShareMessage(opts: {
  clientName: string | null | undefined;
  destination: string;
  agency: string;
  link: string;
}): string {
  const who = firstName(opts.clientName);
  const dest = opts.destination.trim();
  return `Hi${who ? ` ${who}` : ""}, here is your ${dest ? `${dest} ` : ""}itinerary from ${opts.agency}: ${opts.link}`;
}

/** Client → agency, from the share page. */
export function clientAskMessage(opts: { title: string; link?: string }): string {
  return `Hi, I have a question about my itinerary "${opts.title}"${opts.link ? ` (${opts.link})` : ""}.`;
}
