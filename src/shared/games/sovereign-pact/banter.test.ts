// Camp banter (Josh's playtest, 2026-11-02): the party talks at the fire.
import { describe, expect, it } from "vitest";
import { BANTER } from "./content.ts";
import { able, muster } from "./expedition.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { die, pressOn } from "./journey.ts";
import type { ExpeditionCard } from "./state.ts";
import { calm, campaign } from "./testing.ts";

const move = (s: SovState, player: string, m: SovMove): SovState => {
  const r = sovereignPact.applyMove(s, player, m);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const card = (pool = "barrows", type: ExpeditionCard["type"] = "delve"): ExpeditionCard => ({ type, pool, level: 2, size: 4 });

function atCamp(seed: number, fielded = 4, c = card()): SovState {
  let s = calm(campaign(1, seed));
  s.phase = "expedition";
  muster(s, c);
  s = move(s, "p1", { type: "field", people: able(s, 0).slice(0, fielded).map((p) => p.id) });
  s.expedition!.chain = ["camp", "camp", "boss"];
  s.expedition!.at = 0;
  return s;
}

describe("camp banter", () => {
  it("has scenes for one Scion alone and for every region", () => {
    expect(BANTER.some((b) => b.when?.includes("alone"))).toBe(true);
    for (const pool of ["beast_lands", "hollow_wood", "drowned_marches", "barrows", "deep_cold", "pit", "forge_ruins", "faceless_city", "apostate_court", "shrine_of_six", "dragon_reaches", "outer_dark"])
      expect(BANTER.some((b) => b.when?.includes(`pool:${pool}`)), pool).toBe(true);
  });

  it("gives the fire's talk to the Scions marching, names filled in, never the same scene twice in an expedition", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = atCamp(seed);
      const party = s.expedition!.party[0]!;
      pressOn(s);
      const first = s.expedition!.camp!;
      expect(first.at).toBe(1);
      expect(first.lines.length).toBeGreaterThan(0);
      for (const l of first.lines) {
        expect(l.text).not.toMatch(/[{}]/);
        if (l.who !== null) expect(party).toContain(l.who);
      }
      pressOn(s);
      expect(s.expedition!.talked).toHaveLength(2);
      expect(new Set(s.expedition!.talked).size).toBe(2);
    }
  });

  it("lets a lone Scion talk to the fire", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const s = atCamp(seed);
      s.expedition!.out.push(...s.expedition!.party[0]!.slice(1));
      pressOn(s);
      const who = s.expedition!.camp!.lines.map((l) => l.who).filter((x) => x !== null);
      expect(new Set(who).size).toBeLessThanOrEqual(1);
      expect(s.expedition!.camp!.lines.length).toBeGreaterThan(0);
    }
  });

  it("remembers the fallen by name, and talks of the boss the night before", () => {
    let mourned = 0;
    let dread = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = atCamp(seed);
      const dead = s.people.find((p) => p.id === s.expedition!.party[0]![0])!;
      s.expedition!.chain = ["camp", "boss"];
      die(s, dead, "test");
      pressOn(s);
      const text = s.expedition!.camp!.lines.map((l) => l.text).join(" ");
      if (text.includes(dead.name)) mourned++;
      if (s.expedition!.talked!.some((id) => BANTER.find((b) => b.id === id)!.when?.includes("boss_next"))) dread++;
      expect(s.expedition!.camp!.lines.every((l) => l.who !== dead.id)).toBe(true);
    }
    expect(mourned).toBeGreaterThanOrEqual(3);
    expect(dread).toBeGreaterThanOrEqual(3);
  });
});
