// Sorties (§6.11): the assignment, who goes, the battles and their cap, and what they pay.
import { describe, expect, it } from "vitest";
import { INJURY_BY_ID, SORTIE_BY_ID } from "./content.ts";
import { encounterBattle } from "./combat/encounter.ts";
import { simulate } from "./combat/sim.ts";
import { muster } from "./expedition.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { partyOf } from "./journey.ts";
import { levelUp } from "./progression.ts";
import { runSorties, sortieParty } from "./sortie.ts";
import { calm, campaign } from "./testing.ts";

const g = sovereignPact;
const move = (s: SovState, player: string, m: SovMove): SovState => {
  const r = g.applyMove(s, player, m);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const error = (s: SovState, player: string, m: SovMove): string => {
  const r = g.applyMove(s, player, m);
  if (r.ok) throw new Error("expected a refusal");
  return r.error;
};
const scions = (s: SovState, h = 0) => s.people.filter((p) => p.host === h && p.status === "scion");

describe("the Sortie assignment (§6.11)", () => {
  it("is one Sortie a House a Year, up to four Scions or Retired, never a recruit", () => {
    let s = calm(campaign(1, 5));
    const [a, b] = scions(s);
    expect(error(s, "p1", { type: "assign", person: a!.id, to: "sortie", at: "nowhere" })).toMatch(/one of the Sorties/);
    s = move(s, "p1", { type: "assign", person: a!.id, to: "sortie", at: "hunt_the_marsh" });
    // Choosing another Sortie sends everyone on it there instead (8bu).
    s = move(s, "p1", { type: "assign", person: b!.id, to: "sortie", at: "patrol_the_walls" });
    expect([s.assign[a!.id], s.assign[b!.id]]).toEqual([{ to: "sortie", at: "patrol_the_walls" }, { to: "sortie", at: "patrol_the_walls" }]);
    const recruit = s.people.find((p) => p.host === 0 && p.status === "recruit")!;
    expect(error(s, "p1", { type: "assign", person: recruit.id, to: "sortie", at: "hunt_the_marsh" })).toMatch(/recruit/);
  });
});

describe("going on a Sortie", () => {
  it("keeps the Scions sent on the Sortie off the expedition (Josh 2026-11-10)", () => {
    let s = calm(campaign(1, 5));
    const [a, b] = scions(s);
    s = move(s, "p1", { type: "assign", person: a!.id, to: "sortie", at: "patrol_the_walls" });
    s.phase = "expedition";
    muster(s, { type: "delve", pool: "barrows", level: 1, size: 4 });
    expect(error(s, "p1", { type: "field", people: [a!.id] })).toMatch(/going on the Sortie/);
    s = move(s, "p1", { type: "field", people: [b!.id] });
    expect(sortieParty(s, 0)).toEqual([a!.id]);
  });

  it("sends the House's Sortie Scions not on the expedition; the winners come home with XP, JP and finds", () => {
    let s = calm(campaign(1, 5));
    const team = scions(s);
    for (const p of team) while (p.level < 12) Object.assign(p, levelUp(p));
    const [a, b, c] = team;
    for (const p of [a!, b!, c!]) s = move(s, "p1", { type: "assign", person: p.id, to: "sortie", at: "dig_the_old_mine" });
    s.phase = "expedition";
    muster(s, { type: "delve", pool: "barrows", level: 1, size: 4 });
    s.expedition!.party = [[a!.id]];
    expect(sortieParty(s, 0)).toEqual([b!.id, c!.id]);
    const before = s.people.find((p) => p.id === b!.id)!;
    const iron = s.houses[0]!.stores.iron ?? 0;
    runSorties(s);
    const after = s.people.find((p) => p.id === b!.id)!;
    expect(s.log.some((l) => l.includes("Sortie: Dig the old mine"))).toBe(true);
    expect(s.log.some((l) => l.includes("Dig the old mine, done"))).toBe(true);
    expect(after.xp).toBe(before.xp + 2 * SORTIE_BY_ID.get("dig_the_old_mine")!.xp);
    expect(after.jp[after.job!]! - (before.jp[before.job!] ?? 0)).toBe(25);
    expect(after.hist.sorties).toBe(1);
    expect(s.people.find((p) => p.id === a!.id)!.hist.sorties).toBeUndefined();
    expect(s.houses[0]!.stores.iron ?? 0).toBeGreaterThan(iron);
  });

  it("caps its injuries at Moderate: nobody dies on a Sortie", () => {
    let worst = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = calm(campaign(1, seed));
      const b = encounterBattle(seed, partyOf(s, scions(s).map((p) => p.id)), { pool: "outer_dark", level: 10, year: 20 }).battle;
      b.injuryCap = "moderate";
      simulate(b);
      for (const ev of b.events) if (ev.t === "injury") {
        worst++;
        expect(INJURY_BY_ID.get(ev.result)!.band).not.toBe("devastating");
      }
      expect(b.units.filter((u) => u.side === "party" && u.dead)).toEqual([]);
    }
    expect(worst).toBeGreaterThan(0);
  });

  it("happens as the expedition comes home, every Year the bots play", () => {
    let s = calm(campaign(2, 3));
    for (let i = 0; i < 400 && s.year < 3 && s.phase !== "over"; i++) {
      const p = g.activePlayers(s)[0]!;
      s = move(s, p, g.botMove!(s, p, undefined as never));
    }
    expect(s.year).toBe(3);
    expect(s.people.some((p) => (p.hist.sorties ?? 0) > 0)).toBe(true);
  });
});
