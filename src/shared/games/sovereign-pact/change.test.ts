// Changes (§9.6; Josh 2026-11-02 named them): the new body, what it keeps, its restrictions, its upkeep,
// the events that cause one, and the way back.
import { describe, expect, it } from "vitest";
import { assign, cannotAssign } from "./assign.ts";
import { botAssign } from "./bot.ts";
import { changeUpkeep, change, unchange } from "./change.ts";
import { CHANGE_BY_ID, CHANGES, TRIP_EVENT_BY_ID, type TripOption } from "./content.ts";
import { scionCombatant } from "./combat/build.ts";
import { resolve } from "./events.ts";
import { able, muster } from "./expedition.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { cannotEquip, mint } from "./items.ts";
import { canTakeJob, levelUp } from "./progression.ts";
import { STATS, type Person } from "./state.ts";
import { unpackPeople, packPeople } from "./codec.ts";
import { calm, campaign } from "./testing.ts";
import { TUNING } from "./tuning.ts";
import { view } from "./view.ts";

const g = sovereignPact;
const move = (s: SovState, player: string, m: SovMove): SovState => {
  const r = g.applyMove(s, player, m);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const first = (s: SovState, h = 0): Person => s.people.find((p) => p.host === h && p.status === "scion")!;

function underway(seed = 5): SovState {
  let s = calm(campaign(1, seed));
  s.phase = "expedition";
  muster(s, { type: "delve", pool: "barrows", level: 3, size: 4 });
  s = move(s, "p1", { type: "field", people: able(s, 0).slice(0, 4).map((p) => p.id) });
  return s;
}
const only = (id: string, opt: string, outcome = 0): TripOption => {
  const o = TRIP_EVENT_BY_ID.get(id)!.options.find((x) => x.id === opt)!;
  return { ...o, outcomes: [o.outcomes[outcome]!] };
};

describe("a Change (§9.6)", () => {
  it("replaces stats grown to the Scion's level, growths, traits, look and injuries; keeps the rest", () => {
    const s = calm(campaign(1, 5));
    let p = first(s);
    for (let i = 0; i < 4; i++) p = Object.assign(p, levelUp(p));
    p.traits = ["brave"];
    p.injuries = [{ id: "head_lost_eye", years: -1 }];
    const kept = { name: p.name, tarot: p.tarot, level: p.level, jp: { ...p.jp }, house: p.house };
    const sword = mint(s, "sword", 0);
    p.gear = { main: sword.id };
    change(s, p, "barrow_knight");
    const def = CHANGE_BY_ID.get("barrow_knight")!;
    expect(p.base[0]).toBe(def.base.might + Math.floor((def.growth.might * 4) / 100));
    expect(p.growth).toEqual(STATS.map((k) => def.growth[k]));
    expect([p.traits, p.injuries, p.look]).toEqual([[], [], def.look]);
    expect(p.job).toBe("knight");
    expect({ name: p.name, tarot: p.tarot, level: p.level, house: p.house }).toEqual({ name: kept.name, tarot: kept.tarot, level: kept.level, house: kept.house });
    for (const [job, jp] of Object.entries(kept.jp)) expect(p.jp[job as keyof typeof p.jp]).toBe(jp);
    expect(p.gear.main).toBe(sword.id);
    expect(s.log.at(-1)).toMatch(/is Changed: a Barrow Knight/);
    // Everyone sees the Change, never the old body.
    const seen = view(s, "p1").people.find((x) => x.id === p.id)!;
    expect(seen.change).toBe("barrow_knight");
    expect(JSON.stringify(seen)).not.toContain("head_lost_eye");
  });

  it("takes gear slots away, fixes the Job, and carries its mods into battle", () => {
    const s = calm(campaign(1, 5));
    const p = first(s);
    const sword = mint(s, "sword", 0);
    p.gear = { main: sword.id };
    change(s, p, "wyrmling");
    expect(p.gear.main).toBeUndefined();
    expect(cannotEquip(s, p, sword, "main")).toMatch(/Change/);
    const knight = first(s, 0) === p ? s.people.filter((x) => x.host === 0 && x.status === "scion")[1]! : first(s);
    change(s, knight, "barrow_knight");
    expect(canTakeJob(knight, "knight")).toBe(true);
    expect(canTakeJob(knight, "magus")).toBe(false);
    const u = scionCombatant(knight, { id: 1, col: 0, row: 0 });
    expect(u.affinity.dark).toBe(50);
    expect(u.affinity.holy).toBe(-50);
    expect(u.mods.healingReceivedPct).toBe(-50);
  });

  it("can bar the Chapel, and the bots know it", () => {
    let s = calm(campaign(1, 5));
    const p = first(s);
    change(s, p, "barrow_knight");
    p.sanity = 1;
    expect(cannotAssign(s, 0, { person: p.id, to: "chapel" })).toMatch(/Barrow Knight cannot/);
    for (let i = 0; i < 12; i++) {
      const m = botAssign(s, 0);
      if (!m) break;
      expect(m.person === p.id && m.to === "chapel").toBe(false);
      assign(s, m);
    }
    s = move(s, "p1", { type: "assign", person: p.id, to: "rest" });
    expect(s.assign[p.id]?.to).toBe("rest");
  });

  it("eats its upkeep at the Reckoning, or goes hungry and loses Sanity", () => {
    const s = calm(campaign(1, 5));
    const p = first(s);
    change(s, p, "marsh_thing");
    s.houses[0]!.stores.essence = 1;
    const sanity = p.sanity;
    changeUpkeep(s);
    expect([s.houses[0]!.stores.essence, p.sanity]).toEqual([0, sanity]);
    changeUpkeep(s);
    expect(p.sanity).toBeLessThan(sanity);
    expect(s.log.at(-1)).toMatch(/goes hungry/);
    expect(TUNING.change.hungerSanityPct).toBeGreaterThan(0);
  });

  it("can be undone: the old body comes back, grown by the levels gained since", () => {
    const s = calm(campaign(1, 5));
    let p = first(s);
    p.traits = ["brave"];
    const was = { base: [...p.base], growth: [...p.growth], job: p.job, look: [...p.look] };
    change(s, p, "seraph_husk");
    change(s, p, "wyrmling");
    p = Object.assign(p, levelUp(p));
    const back = levelUp({ ...p, base: was.base as Person["base"], growth: was.growth as Person["growth"], carry: [0, 0, 0, 0, 0, 0], level: p.level - 1 });
    unchange(s, p);
    expect(p.change).toBeUndefined();
    expect(p.base).toEqual(back.base);
    expect([p.traits, p.job, p.look]).toEqual([["brave"], was.job, was.look]);
  });

  it("survives a save, with the body it keeps", () => {
    const s = calm(campaign(1, 5));
    for (const c of CHANGES) change(s, s.people.filter((p) => p.status === "scion")[CHANGES.indexOf(c)]!, c.id);
    expect(unpackPeople(JSON.parse(JSON.stringify(packPeople(s.people))))).toEqual(s.people);
  });
});

describe("the events that Change a Scion", () => {
  it("The Armor That Walks makes the gentlest a Barrow Knight", () => {
    const s = underway();
    const ids = s.expedition!.party[0]!;
    s.people.find((p) => p.id === ids[0])!.hist.kills = 5;
    resolve(s, only("armor_that_walks", "wear"));
    const changed = s.people.filter((p) => p.change);
    expect(changed.map((p) => p.change!.id)).toEqual(["barrow_knight"]);
    expect(changed[0]!.id).not.toBe(ids[0]);
  });

  it("each Change has an event that causes it", () => {
    const causes = new Set([...TRIP_EVENT_BY_ID.values()].flatMap((e) => e.options.flatMap((o) => o.outcomes.flatMap((x) => x.effects.flatMap((f) => (f.change ? [f.change] : []))))));
    expect([...causes].sort()).toEqual(CHANGES.map((c) => c.id).sort());
  });

  it("The Unmaking Spring finds the Changed one and gives their body back; with none, it only soothes", () => {
    const s = underway();
    const p = s.people.find((x) => x.id === s.expedition!.party[0]![1])!;
    change(s, p, "marsh_thing");
    resolve(s, only("unmaking_spring", "bathe"));
    expect(p.change).toBeUndefined();
    const t = underway(6);
    resolve(t, only("unmaking_spring", "bathe"));
    expect(t.people.some((x) => x.change)).toBe(false);
  });
});
