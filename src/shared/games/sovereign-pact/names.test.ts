// Names in play: no two living people (or volunteers in a muster) share a first name, and the log
// reads statuses as words ("is asleep", "gains Protect").
import { describe, expect, it } from "vitest";
import { statusLine } from "./combat/render.ts";
import { createRng } from "../../rng.ts";
import { NAMES } from "./content.ts";
import { namesTaken, rollRecruit } from "./generate.ts";
import { campaign, sealYear } from "./testing.ts";

const firstNames = (names: string[]): string[] => names.map((n) => n.split(" ")[0]!);

describe("names", () => {
  it("never deals two people the same first name, through the opening draft and later Years", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      let s = campaign(4, seed);
      for (let y = 0; y < 3; y++) {
        const living = s.people.map((p) => p.name);
        const all = [...living, ...(s.muster?.pool ?? []).map((p) => p.name)];
        expect(new Set(firstNames(all)).size, `seed ${seed}, Year ${s.year}`).toBe(all.length);
        s = sealYear(s);
      }
    }
  });

  it("holds enough names for a campaign, and keeps the Chronicled dead's names off new recruits (Josh 2026-11-10)", () => {
    for (const sex of ["f", "m"] as const) {
      expect(NAMES.given[sex].length).toBeGreaterThanOrEqual(180);
      expect(new Set(NAMES.given[sex]).size).toBe(NAMES.given[sex].length);
    }
    const s = campaign(2, 1);
    const dead = s.people[0]!;
    s.people = s.people.slice(1);
    s.houses[0]!.chronicle.push({ name: dead.name, year: 1, cause: "test", level: 1 });
    expect(namesTaken(s).has(dead.name)).toBe(true);
    const free = NAMES.given[dead.sex].filter((n) => !namesTaken(s).has(n));
    for (let seed = 1; seed <= 40; seed++) {
      const p = rollRecruit(createRng(seed), 999, 0, undefined, new Set([...namesTaken(s), ...free.slice(1)]));
      if (p.sex === dead.sex) expect(p.name).toBe(free[0]);
    }
  });
});

describe("status lines", () => {
  it("reads states as words, buffs as gains and other harms as suffering", () => {
    expect(statusLine("Jocelin", "sleep", true)).toBe("Jocelin is asleep");
    expect(statusLine("Jocelin", "sleep", false)).toBe("Jocelin is no longer asleep");
    expect(statusLine("Baldric", "poison", true)).toBe("Baldric is poisoned");
    expect(statusLine("Baldric", "mp_regen", false)).toBe("Baldric's MP Regen fades");
  });
});
