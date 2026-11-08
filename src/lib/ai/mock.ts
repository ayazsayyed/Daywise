import type { Brief, ItineraryDraft } from "./schemas";

/**
 * Deterministic fixtures for MOCK_AI=1. The brief is derived from the prompt
 * with the same defaults the enhancer uses; the itinerary is a plausible
 * Kashmir-shaped plan stretched to the requested night count so the rest of
 * the pipeline (dates, verification, persistence) runs unchanged.
 */
const DESTINATIONS: Record<
  string,
  { country: string; cities: string[]; nights: number; entry: string; season: string }
> = {
  kashmir: {
    country: "India",
    cities: ["Srinagar", "Gulmarg", "Pahalgam"],
    nights: 4,
    entry: "Srinagar",
    season: "spring, pleasant days and cold nights",
  },
  kerala: {
    country: "India",
    cities: ["Kochi", "Munnar", "Alleppey"],
    nights: 5,
    entry: "Kochi",
    season: "dry season, warm and humid",
  },
  dubai: {
    country: "United Arab Emirates",
    cities: ["Dubai"],
    nights: 3,
    entry: "Dubai",
    season: "winter, warm days and mild evenings",
  },
  bali: {
    country: "Indonesia",
    cities: ["Ubud", "Seminyak"],
    nights: 6,
    entry: "Denpasar",
    season: "dry season, hot and sunny",
  },
  europe: {
    country: "France and Switzerland",
    cities: ["Paris", "Interlaken", "Lucerne"],
    nights: 9,
    entry: "Paris",
    season: "early summer, long mild days",
  },
};

export function mockBrief(prompt: string, today = new Date()): Brief {
  const p = prompt.toLowerCase();
  const key = Object.keys(DESTINATIONS).find((k) => p.includes(k)) ?? "kashmir";
  const d = DESTINATIONS[key]!;
  const assumed: string[] = [];

  const nightsMatch = p.match(/(\d{1,2})\s*-?\s*(day|days|d\b|n\b|night|nights)/);
  let nights = d.nights;
  if (nightsMatch) {
    const n = Number(nightsMatch[1]);
    nights = /day|d\b/.test(nightsMatch[2]!) ? Math.max(1, n - 1) : n;
  } else assumed.push("nights");

  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() + 30);
  assumed.push("start_date");

  const family = /family|kids|children|bachch/.test(p);
  const pax = family
    ? { adults: 2, children: 2, child_ages: [8, 12] }
    : { adults: 2, children: 0, child_ages: [] };
  if (!/couple|honeymoon|family|adults?|pax|people/.test(p)) assumed.push("pax");

  const budget = /luxury|premium|5 star/.test(p)
    ? "luxury"
    : /budget|sasta|economy|cheap/.test(p)
      ? "budget"
      : "mid-range";
  if (budget === "mid-range" && !/mid/.test(p)) assumed.push("budget");
  assumed.push("pace", "season");

  return {
    destination: key.charAt(0).toUpperCase() + key.slice(1),
    cities: d.cities,
    country: d.country,
    nights,
    start_date: start.toISOString().slice(0, 10),
    pax,
    budget,
    pace: "relaxed",
    season: d.season,
    entry_city: d.entry,
    exit_city: d.entry,
    must_sees: [],
    notes: null,
    currency: "INR",
    assumed,
  };
}

const HOTELS: Record<string, { name: string; room: string }[]> = {
  Srinagar: [{ name: "The Lalit Grand Palace", room: "Deluxe room" }],
  Gulmarg: [{ name: "The Khyber Himalayan Resort & Spa", room: "Premier room" }],
  Pahalgam: [{ name: "WelcomHotel Pine N Peak", room: "Deluxe room" }],
  Kochi: [{ name: "Brunton Boatyard", room: "Sea-facing room" }],
  Munnar: [{ name: "Fragrant Nature Munnar", room: "Deluxe room" }],
  Alleppey: [{ name: "Punnamada Resort", room: "Lake-view villa" }],
  Dubai: [{ name: "Rove Downtown", room: "Rover room" }],
  Ubud: [{ name: "Alaya Resort Ubud", room: "Deluxe room" }],
  Seminyak: [{ name: "The Seminyak Beach Resort & Spa", room: "Deluxe room" }],
  Paris: [{ name: "Hotel Le Marais", room: "Classic room" }],
  Interlaken: [{ name: "Hotel Interlaken", room: "Standard room" }],
  Lucerne: [{ name: "Hotel des Balances", room: "Classic room" }],
};

const SIGHTS: Record<string, string[]> = {
  Srinagar: ["Dal Lake", "Nishat Bagh", "Shankaracharya Temple", "Shalimar Bagh"],
  Gulmarg: ["Gulmarg Gondola", "Strawberry Valley", "St Mary's Church Gulmarg"],
  Pahalgam: ["Betaab Valley", "Aru Valley", "Lidder River"],
  Kochi: ["Fort Kochi Beach", "Mattancherry Palace", "Chinese Fishing Nets"],
  Munnar: ["Tea Museum", "Eravikulam National Park", "Mattupetty Dam"],
  Alleppey: ["Alappuzha Backwaters", "Alappuzha Beach", "Marari Beach"],
  Dubai: ["Burj Khalifa", "Dubai Mall", "Dubai Marina", "Al Fahidi Historical Neighbourhood"],
  Ubud: ["Tegallalang Rice Terrace", "Sacred Monkey Forest Sanctuary", "Ubud Palace"],
  Seminyak: ["Seminyak Beach", "Tanah Lot Temple", "Petitenget Temple"],
  Paris: ["Eiffel Tower", "Louvre Museum", "Montmartre", "Seine River Cruise"],
  Interlaken: ["Harder Kulm", "Jungfraujoch", "Lake Brienz"],
  Lucerne: ["Chapel Bridge", "Mount Pilatus", "Lion Monument"],
};

export function mockItinerary(brief: Brief): ItineraryDraft {
  const total = brief.nights + 1;
  const cities = brief.cities.length ? brief.cities : ["Srinagar"];
  // Spread nights across cities in order; the last day returns to the entry city.
  const perCity = Math.max(1, Math.floor(brief.nights / cities.length));
  const days = Array.from({ length: total }, (_, i) => {
    const last = i === total - 1;
    const cityIdx = Math.min(cities.length - 1, Math.floor(i / perCity));
    const city = last ? (brief.exit_city ?? cities[0]!) : cities[cityIdx]!;
    const base = SIGHTS[city] ?? [`${city} old town`, `${city} viewpoint`, `${city} market`];
    // Rotate so consecutive days in the same city do not repeat the same stops.
    const sights = [...base.slice(i % base.length), ...base.slice(0, i % base.length)];
    const hotel = HOTELS[city]?.[0] ?? { name: `${city} Heritage Hotel`, room: "Deluxe room" };
    const first = i === 0;
    const stops: ItineraryDraft["days"][number]["stops"] = [];
    if (first) {
      stops.push({
        kind: "transfer",
        title: `Arrive ${brief.entry_city ?? city}`,
        description: "Meet the driver on arrival and transfer to the hotel.",
        time: "11:00",
        duration: "1 h",
        place_query: null,
      });
    }
    if (last) {
      stops.push({
        kind: "transfer",
        title: `Depart from ${city}`,
        description: "Check out after breakfast and transfer for the onward journey.",
        time: "09:00",
        duration: "1 h",
        place_query: null,
      });
    } else {
      sights.slice(0, first ? 2 : 3).forEach((s, j) => {
        stops.push({
          kind: "sight",
          title: s,
          description: `Unhurried visit to ${s} with time for photographs and a short walk.`,
          time: `${String(10 + j * 3).padStart(2, "0")}:00`,
          duration: "2 h",
          place_query: `${s}, ${city}`,
        });
      });
    }
    return {
      day_number: i + 1,
      title: last ? `Departure from ${city}` : first ? `Arrival in ${city}` : `${city} highlights`,
      city,
      summary: last
        ? "A slow breakfast, then the drive out."
        : `A ${brief.pace} day around ${city}, with the main sights in the morning and time to rest after lunch.`,
      transport: first
        ? `Private car from ${brief.entry_city ?? city} airport to the hotel, about 1 h`
        : last
          ? `Private car to ${city} airport, about 1 h`
          : `Private car for the day's sightseeing in and around ${city}`,
      stops,
      hotel: last
        ? null
        : {
            name: hotel.name,
            city,
            room_type: hotel.room,
            meal_plan: cityIdx === 0 ? ("CP" as const) : ("MAP" as const),
            check_in: "14:00",
            check_out: "11:00",
            place_query: `${hotel.name}, ${city}`,
          },
    };
  });

  return {
    title: `${brief.destination} in ${total} days`,
    summary: `${brief.nights} nights across ${cities.join(", ")} at a ${brief.pace} pace, ${brief.budget} stays throughout.`,
    days,
    notes: ["Timings and sightseeing are subject to weather and local conditions."],
  };
}
