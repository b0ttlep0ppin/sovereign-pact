// The satchel between nodes (§13.7): Camp items, the Lantern, the Signal Flare, and the bots' use of them.
import { describe, expect, it } from "vitest";
import { able, muster } from "./expedition.ts";
import { sovereignPact as g, type SovMove, type SovState } from "./index.ts";
import { lose, partyOf, pressOn } from "./journey.ts";
import { botOpen } from "./satchel.ts";
import type { ExpeditionCard } from "./state.ts";
import { calm, campaign } from "./testing.ts";
import { TUNING } from "./tuning.ts";

const W = TUNING.consumables.uses;
const move = (s: SovState, m: SovMove): SovState => {
  const r = g.applyMove(s, "p1", m);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const error = (s: SovState, m: SovMove): string => {
  const r = g.applyMove(s, "p1", m);
  if (r.ok) throw new Error("expected a refusal");
  return r.error;
};

/** A solo House on `card`, with `satchel` packed, its Leader chosen, just past a Camp. */
function camped(satchel: string[], card: ExpeditionCard = { type: "resource", pool: "beast_lands", level: 1, size: 4 }): SovState {
  let s = calm(campaign(1, 5));
  s.phase = "expedition";
  muster(s, card);
  s = move(s, { type: "field", people: able(s, 0).slice(0, 4).map((p) => p.id) });
  const e = s.expedition!;
  e.leader = e.party[0]![0]!;
  delete e.votes;
  e.chain = ["camp", "encounter", "boss"];
  e.at = 1;
  e.satchel = satchel.map((id) => ({ id, house: 0 }));
  return s;
}
const scion = (s: SovState, i: number) => s.people.find((p) => p.id === s.expedition!.party[0]![i])!;
const unit = (s: SovState, i: number) => partyOf(s, [scion(s, i).id], s.expedition!.carry)[0]!;

describe("Camp items (§13.7)", () => {
  it("shows the House what it may open now, and on whom", () => {
    const s = camped(["pilgrims_bread", "widows_tea", "tonic"]);
    const party = s.expedition!.party[0]!;
    expect(g.view(s, "p1").opens).toEqual([
      { id: "pilgrims_bread", people: null },
      { id: "widows_tea", people: [...party].sort((a, b) => s.people.findIndex((p) => p.id === a) - s.people.findIndex((p) => p.id === b)) },
    ]);
    s.expedition!.at = 2;
    expect(g.view(s, "p1").opens).toEqual([]);
  });

  it("are opened only at a Camp, and only what the satchel holds", () => {
    const s = camped(["pilgrims_bread", "tonic"]);
    expect(error(s, { type: "use_item", id: "widows_tea", person: scion(s, 0).id })).toMatch(/holds none/);
    expect(error(s, { type: "use_item", id: "tonic" })).toMatch(/Name a marching Scion/);
    expect(error(s, { type: "use_item", id: "tonic", person: scion(s, 0).id })).toMatch(/needs none/);
    s.expedition!.at = 2;
    expect(error(s, { type: "use_item", id: "pilgrims_bread" })).toMatch(/at a Camp/);
  });

  it("mends HP, Durability and MP between nodes with a Tonic, a Salve or an Ether (Josh 2026-11-11)", () => {
    let s = camped(["tonic", "whole_salve", "ether", "firebomb"]);
    s.expedition!.at = 2;
    const id = scion(s, 0).id;
    const u = unit(s, 0);
    s.expedition!.carry[id] = { dur: { body: 0, head: 1 }, broken: ["body"], hurt: Math.round(u.maxHp / 2), hpMax: u.maxHp };
    scion(s, 0).mp = 0;
    const offered = g.view(s, "p1").opens.map((o) => o.id);
    expect(offered).toEqual(expect.arrayContaining(["tonic", "whole_salve", "ether"]));
    expect(offered).not.toContain("firebomb");
    expect(g.view(s, "p1").opens.find((o) => o.id === "tonic")!.people).toEqual([id]);
    s = move(s, { type: "use_item", id: "tonic", person: id });
    expect(unit(s, 0).hp).toBe(u.maxHp - Math.round(u.maxHp / 2) + Math.round((u.maxHp * 25) / 100));
    s = move(s, { type: "use_item", id: "whole_salve", person: id });
    expect(unit(s, 0).dur!.body).toBe(Math.round((u.maxDur!.body * 20) / 100));
    expect(unit(s, 0).broken).not.toContain("body");
    s = move(s, { type: "use_item", id: "ether", person: id });
    expect(scion(s, 0).mp).toBe(Math.round((u.maxMp * 25) / 100));
    expect(s.expedition!.satchel!.map((x) => x.id)).toEqual(["firebomb"]);
  });

  it("Pilgrim's Bread restores the whole party's MP", () => {
    let s = camped(["pilgrims_bread"]);
    for (let i = 0; i < 4; i++) scion(s, i).mp = 0;
    s = move(s, { type: "use_item", id: "pilgrims_bread" });
    for (let i = 0; i < 4; i++) expect(scion(s, i).mp).toBe(unit(s, i).maxMp);
    expect(s.expedition!.satchel).toEqual([]);
  });

  it("Widow's Tea restores Sanity and starts the next battle asleep; the Smuggler's Flask mends every location", () => {
    let s = camped(["widows_tea", "smugglers_flask"]);
    const p = scion(s, 0);
    p.sanity = 10;
    s = move(s, { type: "use_item", id: "widows_tea", person: p.id });
    expect(scion(s, 0).sanity).toBe(10 + Math.round((unit(s, 0).maxSanity * W.teaSanityPct) / 100));
    expect(unit(s, 0).statuses).toContainEqual({ id: "sleep", ticks: W.teaSleepTicks });
    const q = scion(s, 1);
    s.expedition!.carry[q.id] = { dur: { head: 1, body: 1, arms: 1, legs: 1 }, broken: [] };
    s = move(s, { type: "use_item", id: "smugglers_flask", person: q.id });
    const u = unit(s, 1);
    expect(u.dur).toEqual(u.maxDur);
  });
});

describe("node items (§13.7)", () => {
  it("a Lantern turns the next Encounter into a Surprise", () => {
    let s = camped(["lantern"]);
    s = move(s, { type: "use_item", id: "lantern" });
    expect(s.expedition!.lit).toBe(1);
    expect(error(s, { type: "use_item", id: "lantern" })).toMatch(/holds none/);
    pressOn(s);
    expect(s.log.join("\n")).toMatch(/the party has the Surprise/);
  });

  it("a Signal Flare brings a Lost Scion of a Rescue card into the party", () => {
    const s = camped(["signal_flare"]);
    expect(error(s, { type: "use_item", id: "signal_flare" })).toMatch(/no one Lost/);
    const lost = able(s, 0).find((p) => !s.expedition!.party[0]!.includes(p.id))!;
    lose(s, lost);
    s.expedition!.card = { type: "rescue", pool: "beast_lands", level: 1, size: 4, rescue: [lost.id] };
    const t = move(s, { type: "use_item", id: "signal_flare" });
    expect(t.people.find((p) => p.id === lost.id)!.status).toBe("scion");
    expect(t.expedition!.party[0]).toContain(lost.id);
  });
});

describe("bots on the road", () => {
  it("break bread for the tired, then light the way to an Encounter", () => {
    const s = camped(["pilgrims_bread", "lantern"]);
    for (let i = 0; i < 4; i++) scion(s, i).mp = 0;
    expect(botOpen(s, 0)).toEqual({ type: "use_item", id: "pilgrims_bread" });
    for (let i = 0; i < 4; i++) scion(s, i).mp = unit(s, i).maxMp;
    expect(botOpen(s, 0)).toEqual({ type: "use_item", id: "lantern" });
    s.expedition!.lit = 1;
    expect(botOpen(s, 0)).toBe(null);
  });
});
