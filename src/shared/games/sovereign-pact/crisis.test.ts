import { describe, expect, it } from "vitest";
import { applyEffects } from "./effects.ts";
import { bandOf, crisisScore, refundExcess, resolveCrisis, year20, yearBand } from "./crisis.ts";
import { TOWN_EVENT_BY_ID, TOWN_EVENTS } from "./content.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { calm, campaign } from "./testing.ts";
import { TUNING } from "./tuning.ts";
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
/** Two rich Houses facing the Hungry Winter's Need of 40 Grain. */
function winter(): SovState {
  const s = calm(campaign(2, 8));
  for (const h of s.houses) Object.assign(h, { gold: 500, stores: { grain: 200, timber: 100, stone: 100, iron: 100 } });
  s.crisis = { id: "hungry_winter", need: { grain: 40 }, pledges: [{}, {}], tempted: [false, false] };
  return s;
}

describe("Crises (§3.5)", () => {
  it("gives back what is pledged beyond the Need, in proportion to what each House gave (Josh 2026-11-02)", () => {
    const s = winter();
    // 60 and 30 against a Need of 40: 50 too much, back 2:1, so 33 and 17, the odd one to the larger remainder.
    s.crisis!.pledges = [{ grain: 60 }, { grain: 30 }];
    s.houses[0]!.stores.grain = 140;
    s.houses[1]!.stores.grain = 170;
    refundExcess(s);
    expect(s.houses.map((h) => h.stores.grain)).toEqual([173, 187]);
    expect(s.crisis!.pledges).toEqual([{ grain: 27 }, { grain: 13 }]);
    expect(crisisScore(s)).toBe(100);
    // Short of the Need, nothing comes back.
    const t = winter();
    t.crisis!.pledges = [{ grain: 20 }, { grain: 10 }];
    refundExcess(t);
    expect(t.houses.map((h) => h.stores.grain)).toEqual([200, 200]);
  });

  it("takes private pledges of what is needed, shown to no other House", () => {
    let s = winter();
    s = move(s, "p1", { type: "crisis_pledge", give: { grain: 15 } });
    s = move(s, "p1", { type: "crisis_pledge", give: { grain: 5 } });
    expect(s.houses[0]!.stores.grain).toBe(180);
    expect(view(s, "p1").mine!.crisis).toEqual({ pledge: { grain: 20 }, tempted: false });
    const theirs = JSON.stringify(view(s, "p2"));
    expect(theirs).not.toContain('"pledges"');
    expect(view(s, "p2").crisis).toEqual({ id: "hungry_winter", need: { grain: 40 } });
    expect(error(s, "p2", { type: "crisis_pledge", give: { timber: 5 } })).toMatch(/what the Crisis needs/);
    expect(error(s, "p2", { type: "crisis_pledge", give: { grain: 999 } })).toMatch(/do not have/);
  });

  it("scores the pledged share of the Need, each resource up to its own Need, less temptations", () => {
    const s = winter();
    s.crisis = { id: "breach_in_the_wall", need: { stone: 30, iron: 15 }, pledges: [{ stone: 60 }, { iron: 5 }], tempted: [false, false] };
    expect(crisisScore(s)).toBeCloseTo((35 * 100) / 45);
    s.crisis.tempted[1] = true;
    expect(crisisScore(s)).toBeCloseTo((35 * 100) / 45 - TOWN_EVENT_BY_ID.get("breach_in_the_wall")!.crisis!.temptation!.penalty);
  });

  it("puts results in the four bands", () => {
    const b = TUNING.crises.bands;
    expect([bandOf(b.triumph), bandOf(b.holds), bandOf(b.falters), bandOf(b.falters - 1)]).toEqual(["triumph", "holds", "falters", "calamity"]);
  });

  it("gives the temptation's gain to the House that takes it, once", () => {
    let s = winter();
    const gold = s.houses[1]!.gold;
    s = move(s, "p2", { type: "tempt" });
    expect(s.houses[1]!.gold).toBe(gold + 30);
    expect(error(s, "p2", { type: "tempt" })).toMatch(/already/);
    expect(view(s, "p1").mine!.crisis!.tempted).toBe(false);
    s.crisis!.id = "fire_in_the_lower_town";
    expect(error(s, "p1", { type: "tempt" })).toMatch(/Nothing tempts/);
  });

  it("resolves at the seal: a full pledge never falls below Holds, nothing given is a Calamity", () => {
    for (let seed = 0; seed < 20; seed++) {
      const full = winter();
      full.rng = seed;
      full.crisis!.pledges = [{ grain: 20 }, { grain: 20 }];
      const accord = full.accord;
      resolveCrisis(full);
      expect(full.crisis).toBeUndefined();
      expect(full.accord).toBeGreaterThanOrEqual(accord);
      const none = winter();
      none.rng = seed;
      resolveCrisis(none);
      expect(none.accord).toBe(accord - 15);
    }
  });

  it("grants Renown privately by what each House gave", () => {
    const s = winter();
    s.crisis!.pledges = [{ grain: 40 }, {}];
    resolveCrisis(s);
    expect(s.houses[0]!.score.renown).toBe(40 / TUNING.crises.renownPer);
    expect(s.houses[1]!.score.renown).toBe(0);
  });

  it("is drawn in the Omens about 40% of Years, its Need growing with the campaign", () => {
    let crises = 0;
    for (let seed = 1; seed <= 100; seed++) if (campaign(4, seed).crisis) crises++;
    expect(crises).toBeGreaterThan(25);
    expect(crises).toBeLessThan(55);
    const s = calm(campaign(4, 1, { length: "short" }));
    s.year = 4;
    expect([year20(s), yearBand(s)]).toEqual([8, "mid"]);
  });

  it("keeps every Crisis winnable from the resources a House can make", () => {
    for (const e of TOWN_EVENTS.filter((x) => x.crisis)) for (const k of Object.keys(e.crisis!.need)) expect(["gold", "grain", "timber", "stone", "iron"], e.id).toContain(k);
  });
});

describe("town effects", () => {
  it("move the tracks, ruin buildings, lose recruits and shake Sanity", () => {
    const s = calm(campaign(2, 8));
    s.houses[0]!.buildings = { farm: 1 };
    const recruits = s.people.filter((p) => p.host === 0 && p.status === "recruit").length;
    applyEffects(s, [{ doom: 7 }, { accord: 5 }, { ruin: 1 }, { recruits_lost: 1 }, { sanity: -100 }, { resources: { gold: -9999 } }], 0);
    expect(s.doom).toBe(7);
    expect(s.accord).toBe(TUNING.tracks.accordStart + 5);
    expect(s.houses[0]!.buildings).toEqual({});
    expect(s.people.filter((p) => p.host === 0 && p.status === "recruit").length).toBe(recruits - 1);
    expect(s.people.filter((p) => p.host === 0 && p.status === "scion").every((p) => p.sanity === 0)).toBe(true);
    expect(s.houses[0]!.gold).toBe(0);
    applyEffects(s, [{ resources: { timber: 5 }, to: "commons" }, { flag: "seen" }, { timeline: { event: "hungry_winter", years: 2 } }], null);
    expect(s.commons.stores.timber).toBe(5);
    expect(s.flags).toContain("seen");
    expect(s.timeline.at(-1)).toEqual({ year: s.year + 2, id: "hungry_winter" });
  });
});
