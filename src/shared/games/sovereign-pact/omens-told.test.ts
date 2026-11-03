// Town events with weight (Josh's playtest, 2026-11-02: "settlement events repeat far too much", "real
// consequences", "explain what it did"): the Omens pass by what they drew lately, an outcome can fall on
// one Scion at home, and each outcome leaves an account of what it changed.
import { describe, expect, it } from "vitest";
import { TOWN_EVENT_BY_ID, TOWN_EVENTS } from "./content.ts";
import { eligible } from "./crisis.ts";
import { applyEffects, pickAtHome } from "./effects.ts";
import { jobStat } from "./formulas.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { checkpoint } from "./save.ts";
import { drawOmens, openEvent, recordOmen } from "./omens.ts";
import { calm, campaign } from "./testing.ts";
import { TUNING } from "./tuning.ts";
import { view } from "./view.ts";

const move = (s: SovState, player: string, m: SovMove): SovState => {
  const r = sovereignPact.applyMove(s, player, m);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const home = (s: SovState, h: number) => s.people.filter((p) => p.host === h && (p.status === "scion" || p.status === "retired"));

describe("fresh Omens", () => {
  it("passes by a settlement event drawn in the last few Years while others remain", () => {
    const s = calm(campaign(2, 3));
    s.flags = s.flags.filter((f) => f !== "calm");
    s.timeline = [];
    const pool = TOWN_EVENTS.filter((e) => e.scope === "settlement" && eligible(s, e));
    const keep = pool.find((e) => e.id === "stranger_at_the_gate")!;
    s.omensSeen = pool.filter((e) => e !== keep).map((e) => ({ key: e.id, year: s.year }));
    drawOmens(s);
    expect(s.events.some((e) => e.id === keep.id)).toBe(true);
    expect(s.omensSeen.some((x) => x.key === keep.id && x.year === s.year)).toBe(true);
  });

  it("forgets what it drew once enough Years have passed", () => {
    const s = calm(campaign(1, 3));
    s.flags = s.flags.filter((f) => f !== "calm");
    s.omensSeen = [{ key: "stranger_at_the_gate", year: s.year - TUNING.omens.fresh }, { key: "bridge_gives_way", year: s.year - 1 }];
    drawOmens(s);
    expect(s.omensSeen.map((x) => x.key)).not.toContain("stranger_at_the_gate");
    expect(s.omensSeen.map((x) => x.key)).toContain("bridge_gives_way");
  });

  it("over a campaign's first Years, rarely draws the same settlement event twice", () => {
    let repeats = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const s = campaign(1, seed);
      s.flags = s.flags.filter((f) => f !== "calm");
      const seen: string[] = [];
      for (let y = 1; y <= TUNING.omens.fresh; y++) {
        s.year = y;
        s.timeline = [];
        drawOmens(s);
        const id = s.crisis?.id ?? s.events.find((e) => e.house === undefined)?.id;
        if (id && seen.includes(id)) repeats++;
        if (id) seen.push(id);
        delete s.crisis;
      }
    }
    expect(repeats).toBe(0);
  });
});

describe("harm at home", () => {
  it("falls on the Scion the effect names", () => {
    const s = calm(campaign(2, 4));
    const ours = home(s, 0);
    ours[0]!.age = 70;
    const eldest = ours[0]!;
    applyEffects(s, [{ scion: { who: "eldest", age: 5, trait: "+nightmares" } }], 0);
    expect(eldest.age).toBe(75);
    expect(eldest.traits).toContain("nightmares");
    expect(home(s, 1).some((p) => p.traits.includes("nightmares") && p.age === 75)).toBe(false);
    const strongest = pickAtHome(s, 0, "highest:might")!;
    expect(ours.every((p) => jobStat(p, "might") <= jobStat(strongest, "might"))).toBe(true);
  });

  it("can wound, and a wound can kill at home", () => {
    let deaths = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = calm(campaign(1, seed));
      const before = home(s, 0).length;
      for (let n = 0; n < 6; n++) applyEffects(s, [{ scion: { injury: "head" } }], 0);
      expect(home(s, 0).every((p) => p.injuries.length >= 0)).toBe(true);
      if (home(s, 0).length < before) {
        deaths++;
        expect(s.log.some((l) => l.endsWith("dies at home."))).toBe(true);
      }
    }
    expect(deaths).toBeGreaterThan(0);
  });
});

describe("the Omens' account", () => {
  it("tells what a House's choice did: open to all where it is open, its own stores to it alone", () => {
    const s = calm(campaign(2, 2));
    for (const h of s.houses) h.gold = 300;
    openEvent(s, TOWN_EVENT_BY_ID.get("debt_collector")!);
    const by = s.events[0]!.deciders[0]!;
    const pay = TOWN_EVENT_BY_ID.get("debt_collector")!.options!.findIndex((o) => o.id === "pay");
    const t = move(s, `p${by + 1}`, { type: "choose", event: "debt_collector", option: pay });
    const told = t.omensTold!.at(-1)!;
    expect(told).toMatchObject({ id: "debt_collector", by, year: t.year });
    expect(told.lines.some((l) => l.text.includes("Gold") && l.of === by && !l.open)).toBe(true);
    expect(view(t, `p${by + 1}`).omens.at(-1)!.lines.length).toBe(told.lines.length);
    expect(view(t, `p${2 - by}`).omens.at(-1)!.lines.every((l) => l.open)).toBe(true);
    // Not saved: the account lives only until the next checkpoint is loaded.
    t.phaseMoves = 0;
    expect(checkpoint(t)!.campaign).not.toHaveProperty("omensTold");
  });

  it("keeps a House event's account to its House (Q89)", () => {
    let s = calm(campaign(2, 2));
    openEvent(s, TOWN_EVENT_BY_ID.get("cousins_claim")!, 1);
    s = move(s, "p2", { type: "choose", event: "cousins_claim@1", option: 0 });
    expect(view(s, "p2").omens.map((o) => o.id)).toEqual(["cousins_claim"]);
    expect(view(s, "p1").omens).toEqual([]);
  });

  it("tells the tracks and a Scion's harm in plain words", () => {
    const s = calm(campaign(1, 5));
    recordOmen(s, "stranger_at_the_gate", undefined, 0, "Test.", "It goes badly.", () => applyEffects(s, [{ accord: -5, scion: { who: "eldest", age: 10 } }], 0));
    const lines = s.omensTold!.at(-1)!.lines.map((l) => l.text);
    expect(lines).toContain("Unrest −5.");
    expect(lines.some((l) => /is older: age \d+ → \d+\./.test(l))).toBe(true);
  });
});
