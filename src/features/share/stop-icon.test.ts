import { describe, expect, it } from "vitest";

import { stopIcon, transportIcon } from "./stop-icon";

describe("stopIcon", () => {
  it("uses the kind by default", () => {
    expect(stopIcon("sight", "Jamia Masjid")).toBe("sight");
    expect(stopIcon("activity", "Gulmarg Gondola, phases 1 and 2")).toBe("activity");
    expect(stopIcon("note", "Timings depend on weather")).toBe("note");
    expect(stopIcon("meal", "Wazwan at Ahdoos")).toBe("meal");
    expect(stopIcon(null, "Something")).toBe("note");
  });

  it("refines transfers by mode, never to hotel or meal", () => {
    expect(stopIcon("transfer", "Transfer to Srinagar airport")).toBe("flight");
    expect(stopIcon("transfer", "Flight to Cappadocia")).toBe("flight");
    expect(stopIcon("transfer", "Train to Jammu Tawi")).toBe("train");
    expect(stopIcon("transfer", "Ferry to Kadıköy")).toBe("boat");
    expect(stopIcon("transfer", "Drive to Pahalgam")).toBe("car");
    expect(stopIcon("transfer", "Hotel to airport transfer")).toBe("flight");
    expect(stopIcon("transfer", "Transfer to your hotel")).toBe("car");
  });

  it("recognises hotels, meals, walks, markets and leisure from the title", () => {
    expect(stopIcon("note", "Check in to your houseboat")).toBe("hotel");
    expect(stopIcon("sight", "Shikara ride on Dal Lake")).toBe("boat");
    expect(stopIcon("activity", "Dinner on the houseboat")).toBe("meal");
    expect(stopIcon("activity", "Lidder riverside walk")).toBe("walk");
    expect(stopIcon("sight", "Grand Bazaar")).toBe("shopping");
    expect(stopIcon("note", "Evening at leisure")).toBe("leisure");
    expect(stopIcon("sight", "Shalimar Bagh")).toBe("nature");
    expect(stopIcon("sight", "Gulhane Park")).toBe("nature");
    expect(stopIcon("sight", "Betaab Valley")).toBe("nature");
    expect(stopIcon("sight", "Hagia Sophia")).toBe("sight");
  });
});

describe("transportIcon", () => {
  it("reads the day's transport line", () => {
    expect(transportIcon("Hotel to airport transfer, about 1h")).toBe("flight");
    expect(transportIcon("Private car Srinagar → Gulmarg, about 2 h")).toBe("car");
    expect(transportIcon("Morning flight Istanbul → Kayseri, about 1 h 20 min")).toBe("flight");
  });
});
