// Expedition events (§9.4): drawing them, the party's vote, the rules' subjects, and the effects.
import { describe, expect, it } from "vitest";
import { TRIP_EVENT_BY_ID, TRIP_EVENTS, type TripEffect, type TripOption } from "./content.ts";
import { drawEvent, eligible, resolve, subjects } from "./events.ts";
import { able, muster } from "./expedition.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { levelUp } from "./progression.ts";
import type { ExpeditionCard } from "./state.ts";
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
const card = (level = 2, type: ExpeditionCard["type"] = "delve", pool = "barrows"): ExpeditionCard => ({ type, pool, level, size: 4 });

/** `H` Houses underway (two Scions each, one House alone fields four), the first fielded leading. */
function underway(H: number, c = card(), seed = 5): SovState {
  let s = calm(campaign(H, seed));
  s.phase = "expedition";
  muster(s, c);
  for (let h = 0; h < H; h++) s = move(s, `p${h + 1}`, { type: "field", people: able(s, h).slice(0, s.expedition!.seats[h]).map((p) => p.id) });
  const leader = s.expedition!.party[0]![0]!;
  if (H > 1) for (let h = 0; h < H; h++) s = move(s, `p${h + 1}`, { type: "lead", person: leader });
  return s;
}
const option = (rule: string, ...effects: TripEffect[]): TripOption => ({ id: "x", label: "Test.", rule, outcomes: [{ w: 1, text: "It happens.", effects }] });
const ofHouse = (s: SovState, h: number) => s.expedition!.party[h]!;

describe("drawing an event (§9.3)", () => {
  it("draws from the card's pools or the general pool, in band, once an expedition, its requirements met", () => {
    const s = underway(1, card(2, "delve", "barrows"));
    for (let i = 0; i < 40; i++) {
      const d = drawEvent(s)!;
      expect(d.band[0] <= 2 && 2 <= d.band[1]).toBe(true);
      expect(d.pools.some((p) => ["general", "delve", "barrows"].includes(p))).toBe(true);
    }
    s.expedition!.seen.push("bread_on_the_water");
    expect(eligible(s, () => true).map((d) => d.id)).not.toContain("bread_on_the_water");
    s.flags.push("banquet_seen");
    expect(eligible(s, () => true).map((d) => d.id)).not.toContain("banquet_of_the_hollow_host");
    s.expedition!.card.level = 1;
    expect(eligible(s, () => true).map((d) => d.id)).not.toContain("ash_rain");
  });

  it("puts the event to the Houses present at an Event node", () => {
    let s = underway(2);
    s.expedition!.chain = ["event", "boss"];
    s = move(s, "p1", { type: "press_on" });
    const ev = s.expedition!.event!;
    expect(TRIP_EVENT_BY_ID.has(ev.id)).toBe(true);
    expect(ev.votes).toEqual([null, null]);
    expect(g.activePlayers(s)).toEqual(["p1", "p2"]);
    expect(error(s, "p1", { type: "press_on" })).toMatch(/decide/);
    expect(error(s, "p1", { type: "decide", option: 9 })).toMatch(/not one of the choices/);
  });
});

describe("the vote (Josh, 2026-11-02: the party votes; the rule names who it happens to)", () => {
  it("takes the majority; a tie goes to the Leader's House and costs no Accord", () => {
    let s = underway(3);
    s.expedition!.event = { id: "the_toll", votes: [null, null, null] };
    s = move(move(s, "p1", { type: "decide", option: 1 }), "p2", { type: "decide", option: 0 });
    expect(error(s, "p2", { type: "decide", option: 0 })).toMatch(/already chosen/);
    const accord = s.accord;
    s.houses.forEach((h) => (h.gold = 100));
    s = move(s, "p3", { type: "decide", option: 0 });
    // Pay (0) had two votes: no tie; the highest-Standing House pays.
    expect(s.accord).toBe(accord);
    expect(s.houses.reduce((n, h) => n + h.gold, 0)).toBe(285);
    let t = underway(2);
    t.expedition!.event = { id: "field_of_flowers", votes: [null, null] };
    const a = t.accord;
    t = move(move(t, "p1", { type: "decide", option: 1 }), "p2", { type: "decide", option: 0 });
    expect(t.accord).toBe(a);
    expect(t.log.some((l) => l.startsWith("Don't trust it."))).toBe(true);
  });

  it("asks only the Houses with someone in the party", () => {
    const s = underway(2);
    s.expedition!.event = { id: "bread_on_the_water", votes: [null, -1] };
    expect(error(s, "p2", { type: "decide", option: 0 })).toMatch(/no one in the party/);
    expect(g.activePlayers(s)).toEqual(["p1"]);
  });
});

describe("the rules' subjects (§9.4)", () => {
  it("names the party, the Leader, the veteran, the strongest, the most shaken, and a House by Standing", () => {
    const s = underway(2);
    const e = s.expedition!;
    const party = [...ofHouse(s, 0), ...ofHouse(s, 1)];
    expect(subjects(s, "vote")).toEqual({ scions: party, house: null });
    expect(subjects(s, "leader").scions).toEqual([e.leader]);
    const vet = s.people.find((p) => p.id === party[3])!;
    vet.hist.expeditions = 9;
    expect(subjects(s, "scion:most_expeditions")).toEqual({ scions: [vet.id], house: 1 });
    const strong = s.people.find((p) => p.id === party[2])!;
    Object.assign(strong, levelUp(levelUp(levelUp(strong))), { growth: [160, 160, 160, 160, 160, 160] });
    Object.assign(strong, levelUp(levelUp(strong)));
    expect(subjects(s, "scion:highest:might").scions).toEqual([strong.id]);
    s.people.find((p) => p.id === party[1])!.sanity = 1;
    expect(subjects(s, "scion:lowest:sanity").scions).toEqual([party[1]]);
    s.houses[1]!.score.renown = 50;
    expect(subjects(s, "house:highest_standing")).toEqual({ scions: ofHouse(s, 1), house: 1 });
    expect(subjects(s, "house:lowest_standing").house).toBe(0);
    expect(party).toContain(subjects(s, "scion:random").scions[0]);
  });
});

describe("the effects (§9.4)", () => {
  it("moves Sanity and Durability by % of max, Breaking a location at 0, and pays XP", () => {
    const s = underway(1);
    const id = ofHouse(s, 0)[0]!;
    const p = s.people.find((x) => x.id === id)!;
    p.sanity = 10;
    resolve(s, option("leader", { sanity: 1000 }, { durability: -100, loc: "legs" }, { xp: 30 }));
    const q = s.people.find((x) => x.id === id)!;
    expect(q.sanity).toBeGreaterThan(10);
    expect(s.expedition!.carry[id]!.dur.legs).toBe(0);
    expect(s.expedition!.carry[id]!.broken).toEqual(["legs"]);
    expect(q.xp).toBe(p.xp + 30);
    resolve(s, option("leader", { durability: 50 }));
    expect(s.expedition!.carry[id]!.broken).toEqual([]);
  });

  it("sends a subject's finds to its House and the party's to the Commons (§9.10); score likewise", () => {
    const s = underway(2);
    const [g0, c0] = [s.houses[1]!.stores.essence ?? 0, s.commons.stores.essence ?? 0];
    resolve(s, option("house:highest_standing", { resources: { essence: 5 }, score: { lore: 2 } }));
    const house = subjects(s, "house:highest_standing").house!;
    expect(s.houses[house]!.score.lore).toBe(2);
    resolve(s, option("vote", { resources: { essence: 3 }, score: { valor: 1 } }));
    expect(s.commons.stores.essence).toBe(c0 + 3);
    expect(s.houses.map((h) => h.score.valor)).toEqual([1, 1]);
    expect((s.houses[house]!.stores.essence ?? 0) - (house === 1 ? g0 : 0)).toBeGreaterThanOrEqual(5);
  });

  it("skips nodes but never the boss, fights, and ends the expedition", () => {
    const s = underway(1, card(1, "resource", "beast_lands"));
    s.expedition!.chain = ["event", "event", "encounter", "boss"];
    resolve(s, option("leader", { skip: 3 }));
    expect(s.expedition!.at).toBe(3);
    for (const p of s.people) while (p.status === "scion" && p.level < 15) Object.assign(p, levelUp(p));
    resolve(s, option("vote", { encounter: {} }));
    expect(s.log.some((l) => l.includes("wins a battle"))).toBe(true);
    resolve(s, option("vote", { retreat: true }));
    expect(s.expedition!.result).toBe("retreated");
  });

  it("rolls forced injuries, and the dead go to the Chronicle", () => {
    let deaths = 0;
    for (let seed = 1; seed <= 40 && !deaths; seed++) {
      const s = underway(1, card(), seed);
      const before = s.people.length;
      resolve(s, option("vote", { injury: "head" }, { injury: "body" }, { injury: "head" }));
      deaths = before - s.people.length;
      expect(s.houses[0]!.chronicle.length).toBe(deaths);
    }
    expect(deaths).toBeGreaterThan(0);
  });
});

describe("the content and the bot", () => {
  it("tags every option of a choice for balancing (§9.5), and the bot takes the cautious one", () => {
    for (const d of TRIP_EVENTS) if (d.options.length > 1) for (const o of d.options) expect(o.tags?.length, `${d.id}.${o.id}`).toBeGreaterThan(0);
    const s = underway(1);
    s.expedition!.event = { id: "the_toll", votes: [null] };
    expect(g.botMove!(s, "p1", undefined as never)).toEqual({ type: "decide", option: 0 });
  });
});
