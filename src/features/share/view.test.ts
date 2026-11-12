import { describe, expect, it } from "vitest";

import { DEFAULT_BRANDING } from "@/lib/db/json";
import type { EditorDoc } from "@/lib/itinerary/doc";
import { mintShareToken, SHARE_TOKEN_RE, suspendedPastGrace } from "@/lib/db/share";

import {
  buildPrice,
  buildShareView,
  creditLine,
  dateRangeWords,
  initials,
  lines,
  paxLabel,
  stockCredit,
} from "./view";
import { agentShareMessage, firstName, waDigits, waHref } from "./whatsapp";

const img = (
  ref: string,
  source: "place" | "pexels" | "placeholder",
  attribution: string | null,
) => ({
  source,
  ref,
  attribution,
  url: `/img/${ref}`,
  credit: null,
});

const doc: EditorDoc = {
  id: "00000000-0000-0000-0000-000000000001",
  title: "Kashmir for Ananya & Rohit",
  status: "draft",
  isTemplate: false,
  startDate: "2027-03-14",
  endDate: "2027-03-16",
  destination: "Kashmir",
  country: "India",
  budget: "mid-range",
  pace: "balanced",
  client: {
    name: "Ananya & Rohit Kapoor",
    phone: "98200 41736",
    pax: { adults: 2, children: 0, child_ages: [] },
  },
  pricing: {
    mode: "per_person",
    show: true,
    total: null,
    per_person: 42250,
    per_adult: null,
    per_child: null,
    currency: "INR",
    tax_note: "Includes 5% GST. Airfare not included.",
  },
  sections: {
    inclusions: "- 2 nights on twin sharing\n• Breakfast every day\n\n",
    exclusions: "Flights",
    payment_terms: "30% to confirm.",
    cancellation: "Free up to 30 days before travel.",
  },
  days: [
    {
      id: "d1",
      date: "2027-03-14",
      city: "Srinagar",
      title: "Arrive in Srinagar, an evening on Dal Lake",
      summary: "",
      transport: "Private sedan · airport to Dal Lake · 35 min",
      hero: img("places/a/photos/1", "place", "Op Singh"),
      stops: [
        {
          id: "s1",
          kind: "sight",
          title: "Shikara ride on Dal Lake",
          description: "Golden hour past the floating gardens.",
          time: "16:30",
          duration: "1 h",
          placeId: "a",
          verified: true,
          image: img("places/a/photos/1", "place", "Op Singh"),
        },
      ],
      hotel: {
        id: "h1",
        name: "Sukoon Houseboat",
        city: "Srinagar",
        address: "Boulevard Rd, Dal Lake, Srinagar, Jammu and Kashmir 190001, India",
        placeId: "b",
        verified: true,
        manual: false,
        roomType: "Deluxe double, lake facing",
        mealPlan: "MAP",
        checkIn: "13:00",
        checkOut: null,
        image: img("places/b/photos/1", "place", "Asha R"),
      },
    },
    {
      id: "d2",
      date: "2027-03-15",
      city: "Gulmarg",
      title: "Gulmarg: gondola and snow",
      summary: "",
      transport: "",
      hero: img("pexels/gulmarg.jpg", "pexels", "Photo: Ravi K / Pexels"),
      stops: [],
      hotel: {
        id: "h2",
        name: "The Khyber Himalayan Resort & Spa",
        city: "Gulmarg",
        address: null,
        placeId: null,
        verified: false,
        manual: true,
        roomType: "",
        mealPlan: "CP",
        checkIn: "14:00",
        checkOut: "11:00",
        image: null,
      },
    },
    {
      id: "d3",
      date: "2027-03-16",
      city: "Srinagar",
      title: "Lal Chowk, and home",
      summary: "",
      transport: "",
      hero: null,
      stops: [],
      hotel: null,
    },
  ],
};

const branding = {
  ...DEFAULT_BRANDING,
  theme_color: "#7A2B33",
  phone: "+91 22 2867 4410",
  whatsapp: "+91 98190 22651",
  email: "holidays@sktw.example",
  website: "https://sktw.example/",
  gstin: "27AAJFS4417M1Z2",
};

describe("share view", () => {
  const v = buildShareView({
    doc,
    agencyName: "Shree Krishna Travel World",
    branding,
    summary: "Two unhurried nights.",
    updatedAt: new Date("2026-11-09T06:00:00Z"),
    now: new Date("2026-11-12T06:00:00Z"),
  });

  it("builds the cover lines", () => {
    expect(v.preparedFor).toBe("PREPARED FOR ANANYA & ROHIT KAPOOR");
    expect(v.meta).toBe("14 to 16 Mar 2027 · 2 nights · 2 adults");
    expect(v.route).toBe("Srinagar · Gulmarg · Srinagar");
    expect(v.agency.initials).toBe("SK");
    expect(v.lastUpdated).toBe("9 Nov 2026");
  });

  it("builds days, nights and hotel rows", () => {
    expect(v.days[0]!.eyebrow).toBe("DAY 1 · SUN 14 MAR");
    expect(v.days[0]!.eyebrowPrint).toBe("DAY 1 · SUN 14 MAR 2027");
    expect(v.days[0]!.hero!.caption).toBe("Shikara ride on Dal Lake, Srinagar");
    expect(v.days[0]!.hotel!.eyebrow).toBe("NIGHT 1 · SUN 14 MAR");
    expect(v.days[0]!.hotel!.area).toBe("Dal Lake, Srinagar");
    expect(v.days[0]!.hotel!.rows).toEqual([
      { label: "Room", value: "Deluxe double, lake facing" },
      { label: "Meals", value: "Breakfast and dinner (MAP)" },
      { label: "Check-in", value: "From 1:00 pm" },
    ]);
    expect(v.days[1]!.hotel!.rows.at(-1)!.value).toBe("From 2:00 pm · out 11:00 am");
    expect(v.days[0]!.stops[0]!.time).toBe("4:30 pm");
    expect(v.days[2]!.nightLine).toBe("Departure · no hotel");
    expect(v.days[1]!.nightLine).toBe("Night 2 · The Khyber Himalayan Resort & Spa");
  });

  it("credits Google authors and Pexels photographers", () => {
    expect(v.credits).toBe("Photos: Google Maps contributors · Op Singh, Asha R · Ravi K / Pexels");
    expect(v.days[0]!.hero!.credit).toBe("Photo: Op Singh · Google Maps");
  });

  it("formats stock credits", () => {
    expect(stockCredit("Photo by Suhail Lone on Pexels")).toBe("Suhail Lone / Pexels");
    expect(stockCredit("Photo: Ravi K / Pexels")).toBe("Ravi K / Pexels");
    expect(stockCredit(null)).toBeNull();
  });

  it("splits free-text sections into items", () => {
    expect(v.sections.included).toEqual(["2 nights on twin sharing", "Breakfast every day"]);
    expect(lines("")).toEqual([]);
  });

  it("builds the contact table with links", () => {
    expect(v.agency.contacts.map((c) => c.label)).toEqual([
      "WhatsApp",
      "Phone",
      "Email",
      "Website",
      "GSTIN",
    ]);
    expect(v.agency.contacts[3]!.value).toBe("sktw.example");
    expect(v.agency.whatsappHref).toMatch(/^https:\/\/wa\.me\/919819022651\?text=/);
  });
});

describe("price modes", () => {
  it("per person with breakdown", () => {
    const p = buildPrice(doc, 2)!;
    expect(p.amount).toBe("₹42,250");
    expect(p.lines).toEqual([{ label: "2 adults × ₹42,250", amount: "₹84,500" }]);
    expect(p.total).toBe("₹84,500");
    expect(p.bar).toEqual({ amount: "₹42,250", line: "per person · 2 adults" });
  });
  it("total", () => {
    const p = buildPrice({ ...doc, pricing: { ...doc.pricing, mode: "total", total: 84500 } }, 4)!;
    expect(p.amount).toBe("₹84,500");
    expect(p.unitLine).toBe("for 2 adults, 4 nights");
    expect(p.lines).toEqual([]);
  });
  it("adult and child", () => {
    const p = buildPrice(
      {
        pricing: { ...doc.pricing, mode: "per_adult_child", per_adult: 42250, per_child: 21500 },
        client: { name: "x", pax: { adults: 2, children: 1, child_ages: [6] } },
      },
      4,
    )!;
    expect(p.lines.map((l) => l.label)).toEqual(["2 adults × ₹42,250", "1 child (6) × ₹21,500"]);
    expect(p.total).toBe("₹1,06,000");
  });
  it("hidden mode and unpriced trips render no price at all", () => {
    expect(buildPrice({ ...doc, pricing: { ...doc.pricing, show: false } }, 2)).toBeNull();
    expect(buildPrice({ ...doc, pricing: { ...doc.pricing, per_person: null } }, 2)).toBeNull();
  });
});

describe("helpers", () => {
  it("formats ranges and pax", () => {
    expect(dateRangeWords("2027-02-28", "2027-03-03")).toBe("28 Feb to 3 Mar 2027");
    expect(dateRangeWords("2026-12-30", "2027-01-02")).toBe("30 Dec 2026 to 2 Jan 2027");
    expect(paxLabel({ adults: 1, children: 2 })).toBe("1 adult, 2 children");
    expect(initials("Shree Krishna Travel World")).toBe("SK");
    expect(creditLine([null])).toBe("");
  });

  it("builds the agent's WhatsApp message (Day 4 brief)", () => {
    const text = agentShareMessage({
      clientName: "Ananya & Rohit Kapoor",
      destination: "Kashmir",
      agency: "Shree Krishna Travel World",
      link: "https://x.test/s/abc",
    });
    expect(text).toBe(
      "Hi Ananya, here is your Kashmir itinerary from Shree Krishna Travel World: https://x.test/s/abc",
    );
    expect(waHref("98200 41736", text)).toBe(
      `https://wa.me/919820041736?text=${encodeURIComponent(text)}`,
    );
    expect(waHref("", "hi")).toBe("https://wa.me/?text=hi");
    expect(waDigits("+91 98190 22651")).toBe("919819022651");
    expect(firstName("")).toBe("");
  });

  it("mints unguessable tokens", () => {
    const t = mintShareToken();
    expect(t).toMatch(SHARE_TOKEN_RE);
    expect(t.length).toBeGreaterThanOrEqual(24);
    expect(mintShareToken()).not.toBe(t);
    expect(SHARE_TOKEN_RE.test("../../etc")).toBe(false);
  });

  it("keeps a suspended tenant's links for 30 days", () => {
    const now = new Date("2026-11-12T00:00:00Z");
    const t = (days: number | null) =>
      ({
        status: "suspended",
        suspendedAt: days === null ? null : new Date(now.getTime() - days * 86_400_000),
      }) as Parameters<typeof suspendedPastGrace>[0];
    expect(suspendedPastGrace(t(10), now)).toBe(false);
    expect(suspendedPastGrace(t(31), now)).toBe(true);
    expect(suspendedPastGrace({ ...t(40), status: "active" }, now)).toBe(false);
  });
});
