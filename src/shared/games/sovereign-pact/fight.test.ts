// Battles fought by hand (§10.4, §6.11): the battle waits on the Scion's House each turn, and the
// gambit engine plays any turn a House hands it, a bot's and an absent player's alike.
import { describe, expect, it } from "vitest";
import { TRIP_EVENTS } from "./content.ts";
import { resolve } from "./events.ts";
import { able, muster } from "./expedition.ts";
import { awaited } from "./fight.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { cache } from "./loot.ts";
import { levelUp } from "./progression.ts";
import type { ExpeditionCard } from "./state.ts";
import { calm, campaign, sealYear } from "./testing.ts";
import { view } from "./view.ts";

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
const card: ExpeditionCard = { type: "resource", pool: "beast_lands", level: 1, size: 4 };

/** Two Houses underway, two Scions each, House 1's Scion leading; battles by hand. */
function underway(seed = 5, level = 1): SovState {
  let s = calm(campaign(2, seed, { battles: "hand" }));
  for (const p of s.people.filter((x) => x.status === "scion")) while (p.level < level) Object.assign(p, levelUp(p));
  s.phase = "expedition";
  muster(s, card);
  s = move(s, "p1", { type: "field", people: able(s, 0).slice(0, 2).map((p) => p.id) });
  s = move(s, "p2", { type: "field", people: able(s, 1).slice(0, 2).map((p) => p.id) });
  const leader = s.expedition!.party[1]![0]!;
  return move(move(s, "p1", { type: "lead", person: leader }), "p2", { type: "lead", person: leader });
}

/** Bots command every turn until the battle is over. */
function fightOut(start: SovState): SovState {
  let s = start;
  for (let i = 0; i < 5_000 && s.expedition?.fight; i++) {
    const who = g.activePlayers(s)[0]!;
    s = move(s, who, g.botMove!(s, who, undefined as never));
  }
  return s;
}

describe("a battle by hand", () => {
  it("waits on the House whose Scion's turn it is, and nothing else moves meanwhile", () => {
    let s = underway();
    s.expedition!.chain = ["encounter", "boss"];
    s = move(s, "p2", { type: "press_on" });
    const f = s.expedition!.fight!;
    expect(f.unit).toBeDefined();
    const u = f.b.units.find((x) => x.id === f.unit)!;
    const house = s.people.find((p) => p.id === u.person)!.host;
    expect(awaited(s)).toBe(house);
    expect(g.activePlayers(s)).toEqual([s.players[house]]);
    expect(error(s, s.players[1 - house]!, { type: "command", auto: "turn" })).toMatch(/Another House/);
    expect(error(s, "p2", { type: "retreat" })).toMatch(/battle is being fought/);
    expect(error(s, s.players[house]!, { type: "command" })).toMatch(/Choose/);
    expect(error(s, s.players[house]!, { type: "command", action: { do: "ability", ability: "no_such", target: { side: "enemy", col: 0, row: 0 } } })).toMatch(/cannot be done/);
    // A move alone keeps the turn; a second one does not.
    const there = s.expedition!.fight!.b.units.find((x) => x.id === u.id)!;
    const to: [number, number] = [there.col === 0 ? 1 : there.col - 1, there.row];
    const r = g.applyMove(s, s.players[house]!, { type: "command", move: to });
    if (r.ok) {
      s = r.state;
      expect(s.expedition!.fight!.unit).toBe(u.id);
      expect(error(s, s.players[house]!, { type: "command", move: [there.col, there.row] })).toMatch(/already moved/);
    }
    // A Defend is always there to take; the turn passes and the battle runs on.
    const turns = f.turns;
    s = move(s, s.players[house]!, { type: "command", action: { do: "defend" } });
    if (s.expedition?.fight) expect(s.expedition.fight.turns).toBeGreaterThan(turns);
    const shown = s.expedition!.fight?.replay ?? s.battles![0]!;
    expect(shown.frames.some((x) => x.ev.some((e) => e.t === "defend" && e.unit === u.id))).toBe(true);
  });

  it("shows every House the battle and whose turn it is, not the battle's insides", () => {
    let s = underway();
    s.expedition!.chain = ["encounter", "boss"];
    s = move(s, "p2", { type: "press_on" });
    const f = view(s, "p1").expedition!.fight!;
    expect(f).toEqual({ title: "An Encounter", person: s.expedition!.fight!.b.units.find((u) => u.id === s.expedition!.fight!.unit)!.person, house: awaited(s), auto: [] });
    expect(view(s, "p2").expedition!.fight).toEqual(f);
  });

  it("hands the rest of the battle to a House's gambits: it waits only on the others", () => {
    let s = underway();
    s.expedition!.chain = ["encounter", "boss"];
    s = move(s, "p2", { type: "press_on" });
    const first = awaited(s)!;
    s = move(s, s.players[first]!, { type: "command", auto: "battle" });
    for (let i = 0; i < 500 && s.expedition?.fight; i++) {
      expect(awaited(s)).not.toBe(first);
      s = move(s, s.players[awaited(s)!]!, { type: "command", auto: "turn" });
    }
    expect(s.expedition!.fight).toBeUndefined();
    expect(s.battles?.[0]?.frames.length).toBeGreaterThan(0);
  });

  it("plays exactly as the gambits would when every turn is handed to them", () => {
    for (const seed of [3, 7, 11]) {
      const hand = sealYear(campaign(2, seed, { battles: "hand" }));
      const auto = sealYear(campaign(2, seed, { battles: "gambits" }));
      expect(hand.people).toEqual(auto.people);
      expect(hand.houses).toEqual(auto.houses);
      expect(hand.year).toBe(auto.year);
    }
  });

  it("keeps a live battle small", () => {
    let s = underway(9, 6);
    s.expedition!.chain = ["boss"];
    s = move(s, "p2", { type: "press_on" });
    for (let i = 0; i < 40 && s.expedition?.fight; i++) s = move(s, s.players[awaited(s)!]!, { type: "command", auto: "turn" });
    if (s.expedition?.fight) expect(JSON.stringify(s.expedition.fight).length).toBeLessThan(64 * 1024);
  });
});

describe("what a won battle carries on with", () => {
  it("an event's outcome goes on after its battle is won", () => {
    let s = underway(5, 15);
    const def = TRIP_EVENTS.find((d) => d.options.some((o) => o.rule === "vote" && o.outcomes.some((x) => x.effects.length > 1 && x.effects[0]!.encounter && x.effects[1]!.resources?.gold)))!;
    const option = def.options.find((o) => o.rule === "vote" && o.outcomes.some((x) => x.effects[0]!.encounter && x.effects[1]?.resources?.gold))!;
    const outcome = option.outcomes.find((x) => x.effects[0]!.encounter && x.effects[1]?.resources?.gold)!;
    const gold = outcome.effects[1]!.resources!.gold ?? 0;
    resolve(s, { ...option, outcomes: [{ ...outcome, w: 1 }] });
    expect(s.expedition!.fight).toBeDefined();
    const before = s.commons.gold + s.houses.reduce((n, h) => n + h.gold, 0);
    s = fightOut(s);
    expect(s.log.some((l) => l.includes("wins a battle"))).toBe(true);
    expect(s.commons.gold + s.houses.reduce((n, h) => n + h.gold, 0) - before).toBeGreaterThanOrEqual(gold);
  });

  it("a trapped Cache opens after the ambush is beaten", () => {
    for (let seed = 1; seed <= 60; seed++) {
      let s = underway(seed, 15);
      cache(s);
      if (!s.expedition!.fight) continue;
      expect(s.log.at(-1)).not.toMatch(/opens an old cache/);
      s = fightOut(s);
      expect(s.log.some((l) => l.includes("opens an old cache"))).toBe(true);
      return;
    }
    throw new Error("no Cache was trapped");
  });
});
