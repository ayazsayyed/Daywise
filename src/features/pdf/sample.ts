import type { EditorDay, EditorDoc } from "@/lib/itinerary/doc";

/**
 * Sample Kashmir itinerary for Settings → "Preview PDF" and the golden style
 * renders. A fixture, never tenant data; no photos (the styles' missing-photo
 * frames are part of what the preview shows). Stretches to any day count.
 */

const PLAN: {
  city: string;
  title: string;
  transport: string;
  stops: [string, string, string][];
  hotel: string | null;
}[] = [
  {
    city: "Srinagar",
    title: "Arrive in Srinagar, evening shikara on Dal Lake",
    transport: "Airport pickup by private car, about 40 min",
    stops: [
      ["13:00", "Check in to your houseboat", "Settle in on Nigeen Lake with kahwa on the deck."],
      ["17:00", "Shikara ride on Dal Lake", "An hour past the floating gardens at golden hour."],
    ],
    hotel: "Sukoon Houseboat",
  },
  {
    city: "Gulmarg",
    title: "Gondola morning in Gulmarg",
    transport: "Private car Srinagar → Gulmarg, about 2 h",
    stops: [
      [
        "09:00",
        "Gulmarg Gondola, phases 1 and 2",
        "Cable car to Kongdoori and Apharwat for snow views.",
      ],
      ["14:00", "St Mary's Church", "A short walk to the 1902 stone church in the meadow."],
      ["16:30", "Golf course meadow walk", "Easy walk with views of the Pir Panjal range."],
    ],
    hotel: "The Khyber Himalayan Resort and Spa",
  },
  {
    city: "Pahalgam",
    title: "Lidder valley and Betaab valley",
    transport: "Private car Gulmarg → Pahalgam, about 4 h",
    stops: [
      ["10:00", "Betaab Valley", "Pine-ringed meadow on the Lidder river."],
      ["13:30", "Aru Valley", "Open alpine meadows and a village lunch stop."],
      ["17:00", "Lidder riverside walk", "Evening stroll by the river near your hotel."],
    ],
    hotel: "Welcomhotel by ITC Hotels, Pine N Peak",
  },
  {
    city: "Srinagar",
    title: "Mughal gardens and the old city",
    transport: "Private car Pahalgam → Srinagar, about 3 h",
    stops: [
      ["11:00", "Nishat Bagh", "Terraced Mughal garden above Dal Lake."],
      ["13:00", "Shalimar Bagh", "Jahangir's garden with chinar avenues."],
      ["16:00", "Old city walk", "Jamia Masjid and the spice market at Maharaj Gunj."],
    ],
    hotel: "Vivanta Dal View",
  },
];

const DEPART = {
  city: "Srinagar",
  title: "Depart from Srinagar",
  transport: "Private car to Srinagar airport, about 40 min",
  stops: [["09:00", "Breakfast and check out", "Drive to the airport for your flight home."]] as [
    string,
    string,
    string,
  ][],
};

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function sampleDoc({
  days = 5,
  priced = true,
  start = "2027-03-14",
  client = "Ananya and Rohit Kapoor",
  title,
}: {
  days?: number;
  priced?: boolean;
  start?: string;
  client?: string;
  title?: string;
} = {}): EditorDoc {
  const count = Math.max(2, Math.min(15, days));
  const list: EditorDay[] = Array.from({ length: count }, (_, i) => {
    const last = i === count - 1;
    const p: (typeof PLAN)[number] = last ? { ...DEPART, hotel: null } : PLAN[i % PLAN.length]!;
    return {
      id: uuid(100 + i),
      date: addDays(start, i),
      city: p.city,
      title: p.title,
      summary: "",
      transport: p.transport,
      hero: null,
      stops: p.stops.map(([time, t, description], j) => ({
        id: uuid(1000 + i * 10 + j),
        kind: "sight",
        title: t,
        description,
        time,
        duration: null,
        placeId: null,
        verified: true,
        image: null,
      })),
      hotel:
        last || !p.hotel
          ? null
          : {
              id: uuid(2000 + i),
              name: p.hotel,
              city: p.city,
              address: `${p.city}, Jammu and Kashmir`,
              placeId: null,
              verified: true,
              manual: false,
              roomType: "Deluxe room",
              mealPlan: "MAP",
              checkIn: "14:00",
              checkOut: "11:00",
              image: null,
            },
    };
  });
  return {
    id: uuid(1),
    title: title ?? `Kashmir, ${count} days`,
    status: "draft",
    isTemplate: false,
    startDate: start,
    endDate: addDays(start, count - 1),
    destination: "Kashmir",
    country: "India",
    budget: "mid-range",
    pace: "relaxed",
    client: { name: client, pax: { adults: 2, children: 0, child_ages: [] } },
    pricing: {
      mode: "total",
      show: priced,
      total: priced ? 84_500 : null,
      per_person: null,
      per_adult: null,
      per_child: null,
      currency: "INR",
      tax_note: priced ? "Includes 5% GST. Airfare not included." : "",
    },
    sections: {
      inclusions:
        "Accommodation on twin sharing as listed\nDaily breakfast and dinner\nPrivate car for all transfers and sightseeing\nDriver allowance, tolls and parking",
      exclusions:
        "Airfare and train tickets\nPony rides and gondola tickets\nPersonal expenses and tips",
      payment_terms: "30% to confirm. Balance 15 days before travel by UPI, NEFT or card.",
      cancellation:
        "Free up to 30 days before travel. 50% between 30 and 15 days. No refund within 15 days of travel.",
    },
    days: list,
  };
}

export const SAMPLE_SUMMARY =
  "Houseboat nights on Dal Lake, a gondola morning in Gulmarg and the Lidder valley at Pahalgam, at an easy pace.";
export const SAMPLE_EYEBROW = "A spring journey through";
