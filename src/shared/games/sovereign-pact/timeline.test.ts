import { describe, expect, it } from "vitest";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { applyEffects } from "./effects.ts";
import { calm, campaign } from "./testing.ts";
import { devastate } from "./timeline.ts";
import { TUNING } from "./tuning.ts";
import { view } from "./view.ts";

const g = sovereignPact;

const move = (s: SovState, player: string, m: SovMove): SovState => {
  const r = g.applyMove(s, player, m);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
/** Plays the Year out by bot moves until the next Year opens. */
function nextYear(s: SovState): SovState {
  const year = s.year;
  while (s.year === year && s.phase !== "over") {
    const p = s.players.find((_, i) => !s.houses[i]!.sealed)!;
    s = move(s, p, g.botMove!(s, p, undefined as never));
  }
  return s;
}

describe("the timeline (§8.7)", () => {
  it("fires a queued settlement event in its Year, in place of the draw, and takes it off the strip", () => {
    let s = campaign(2, 4);
    s.timeline.push({ year: s.year + 1, id: "saints_bones" });
    s = nextYear(s);
    expect(s.vote).toMatchObject({ kind: "event", subject: "saints_bones" });
    expect(s.crisis).toBeUndefined();
    expect(s.events.filter((e) => e.house === undefined)).toEqual([]);
    expect(s.timeline.some((t) => t.id === "saints_bones")).toBe(false);
  });

  it("fires a queued House event for its House, and holds a second one for the same slot a Year", () => {
    let s = campaign(2, 4);
    s.timeline.push({ year: s.year + 1, id: "the_suitor", house: 1 }, { year: s.year + 1, id: "portrait_gallery", house: 1 });
    s = nextYear(s);
    expect(s.events.find((e) => e.house === 1)!.id).toBe("the_suitor");
    expect(s.timeline).toContainEqual({ year: s.year + 1, id: "portrait_gallery", house: 1 });
  });

  it("queues a consequence from an event's outcome, hidden if the event says so", () => {
    const s = campaign(2, 4);
    s.timeline = [];
    applyEffects(s, [{ timeline: { event: "rebellious_commons", years: 4, hidden: true } }], 1);
    expect(s.timeline).toEqual([{ year: s.year + 4, id: "rebellious_commons", house: 1, hidden: true }]);
  });

  it("hides a hidden entry as ? until a Watchtower or the Observatory reveals it", () => {
    const s = campaign(2, 4);
    s.timeline.push({ year: 9, id: "the_eclipse", house: 0, hidden: true });
    const entry = (v: ReturnType<typeof view>) => v.timeline.find((t) => t.year === 9)!;
    expect(entry(view(s, "p1"))).toEqual({ year: 9, id: "?" });
    s.houses[1]!.buildings.watchtower = 1;
    expect(entry(view(s, "p2"))).toEqual({ year: 9, id: "the_eclipse", house: 0 });
    expect(entry(view(s, "p1"))).toEqual({ year: 9, id: "?" });
    s.commons.built.rift_observatory = 1;
    expect(entry(view(s, "p1")).id).toBe("the_eclipse");
  });

  it("foreshadows mandatory expeditions two Years ahead, three with the Observatory", () => {
    let s = calm(campaign(1, 4));
    while (s.year < 2) s = nextYear(s);
    expect(s.log.some((l) => /mandatory expedition comes in Year 5/.test(l))).toBe(false);
    s.commons.built.rift_observatory = 1;
    s = nextYear(s);
    expect(s.log.some((l) => /mandatory expedition comes in Year 5/.test(l))).toBe(true);
  });
});

describe("Devastation (§3.3)", () => {
  function town(H = 2): SovState {
    const s = campaign(H, 6);
    s.houses.forEach((h) => {
      h.buildings = { farm: 3, quarry: 3, chapel: 3 };
      h.stores = { timber: 40, grain: 80 };
    });
    s.commons.stores = { stone: 20 };
    s.accord = 60;
    s.doom = 30;
    return s;
  }
  const levels = (s: SovState) => s.houses.reduce((n, h) => n + Object.values(h.buildings).reduce<number>((a, b) => a + (b ?? 0), 0), 0);

  it("ruins 1–3 building levels, takes a share of every store, costs Accord and adds Doom", () => {
    const D = TUNING.devastation.mandatory;
    const ruined = new Set<number>();
    for (let seed = 1; seed <= 30; seed++) {
      const s = town();
      s.rng = seed;
      devastate(s, "mandatory");
      ruined.add(18 - levels(s));
      expect(s.houses[0]!.stores).toEqual({ timber: 30, grain: 60 });
      expect(s.commons.stores.stone).toBe(15);
      expect(s.accord).toBe(60 - D.accord);
      expect(s.doom).toBe(30 + D.doom);
    }
    expect([...ruined].sort()).toEqual([1, 2, 3]);
  });

  it("cancels the next arrivals", () => {
    let s = calm(town(1));
    devastate(s, "mandatory");
    const people = s.people.length;
    s = nextYear(s);
    expect(s.people.length).toBe(people);
    expect(s.log.some((l) => /No one comes/.test(l))).toBe(true);
    expect(s.flags).not.toContain("no_arrivals");
  });

  it("is softened by Walls: a building fewer and Doom −5 a level", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = town();
      s.rng = seed;
      s.commons.built.walls = 3;
      devastate(s, "mandatory");
      expect(levels(s)).toBe(18);
      expect(s.doom).toBe(30 + TUNING.devastation.mandatory.doom - 3 * TUNING.devastation.wallsDoom);
    }
  });

  it("costs less for a forced expedition: one building, Accord −10, Doom +10, the stores kept", () => {
    const s = town();
    devastate(s, "forced");
    expect(levels(s)).toBe(17);
    expect([s.accord, s.doom]).toEqual([50, 40]);
    expect(s.houses[0]!.stores.timber).toBe(40);
  });
});
