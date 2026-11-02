// Forced expeditions (§3.2): foreshadowed a Year ahead on the timeline, they take over the Rift Gate's
// offer, and failing one costs the town (one building, Accord, Doom).
import { describe, expect, it } from "vitest";
import { TOWN_EVENT_BY_ID, TOWN_EVENTS } from "./content.ts";
import { eligible } from "./crisis.ts";
import { band, openGate, scheduleForced } from "./gate.ts";
import { muster } from "./expedition.ts";
import { home } from "./journey.ts";
import { drawOmens } from "./omens.ts";
import type { SovState } from "./state.ts";
import { campaign } from "./testing.ts";
import { timelineFor } from "./timeline.ts";
import { TUNING } from "./tuning.ts";
import { mandatoryYears } from "./year.ts";

const F = TUNING.gate.forced;
const forcing = TOWN_EVENTS.filter((e) => e.forces);

/** Year `year` of a fresh campaign, its Omens and Gate still to come. */
function at(year: number, seed = 1): SovState {
  const s = campaign(2, seed);
  s.year = year;
  s.timeline = [];
  return s;
}

describe("foreshadowing (§3.2)", () => {
  it("now and then queues a hidden forcing event for next Year", () => {
    let hits = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = at(6, seed);
      scheduleForced(s);
      const t = s.timeline.filter((x) => TOWN_EVENT_BY_ID.get(x.id)?.forces);
      if (!t.length) continue;
      hits++;
      expect(t).toEqual([{ year: 7, id: t[0]!.id, hidden: true }]);
    }
    expect(hits).toBeGreaterThan(200 * (F.pct / 100) * 0.4);
    expect(hits).toBeLessThan(200 * (F.pct / 100) * 2);
  });

  it("never for a Year before Year 3 or a mandatory Year, and at most twice a campaign", () => {
    expect(mandatoryYears(at(1))).toContain(5);
    const mandatory = mandatoryYears(at(1));
    for (let seed = 1; seed <= 100; seed++) {
      for (const year of [1, mandatory[0]! - 1]) {
        const s = at(year, seed);
        scheduleForced(s);
        expect(s.timeline).toEqual([]);
      }
      const s = at(6, seed);
      s.flags.push(...Array.from({ length: F.max }, (_, i) => `forced_y${i + 3}`));
      scheduleForced(s);
      expect(s.timeline).toEqual([]);
    }
  });

  it("shows as ? on the timeline, unless the House has a Watchtower", () => {
    const s = at(4);
    s.timeline = [{ year: 5, id: forcing[0]!.id, hidden: true }];
    expect(timelineFor(s, 0)).toEqual([{ year: 5, id: "?" }]);
    s.houses[0]!.buildings.watchtower = 1;
    expect(timelineFor(s, 0)).toEqual([{ year: 5, id: forcing[0]!.id }]);
  });

  it("is never drawn in the Omens", () => {
    const s = at(8);
    for (const e of forcing) expect(eligible(s, e)).toBe(false);
  });
});

describe("the forced Year", () => {
  it("opens the forcing event, and the Gate offers only its card, at the Year's band", () => {
    for (const ev of forcing) {
      const s = at(7);
      s.timeline = [
        { year: 7, id: "plague_cart" },
        { year: 7, id: ev.id, hidden: true },
      ];
      drawOmens(s);
      openGate(s);
      expect(s.vote).toMatchObject({ kind: "event", subject: ev.id });
      const [card, more] = s.gate!.cards;
      expect(more).toBeUndefined();
      expect(card).toMatchObject({ type: "forced", pool: ev.forces!.pool, size: 4 });
      const [lo, hi] = band(7);
      expect(card!.level).toBeGreaterThanOrEqual(lo);
      expect(card!.level).toBeLessThanOrEqual(hi);
      // The other event waits a Year rather than push the forcing one out.
      expect(s.timeline).toEqual([{ year: 8, id: "plague_cart" }]);
    }
  });

  it("fails like a small Devastation: turning back or not answering ruins a building and moves the tracks", () => {
    for (const how of ["retreated", "unanswered"] as const) {
      const s = at(5);
      s.phase = "expedition";
      muster(s, { type: "forced", pool: "beast_lands", level: 3, size: 4 });
      const [accord, doom] = [s.accord, s.doom];
      home(s, how);
      expect(s.log.some((l) => l.includes("forced expedition failed"))).toBe(true);
      expect(s.accord).toBeLessThan(accord);
      expect(s.doom).toBeGreaterThan(doom);
    }
  });
});
