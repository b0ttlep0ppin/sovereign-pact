// The stats a character card shows (8at): what a battle reads, and the bonuses that made each one.
import { describe, expect, it } from "vitest";
import { scionCombatant } from "./combat/build.ts";
import { jobStat } from "./formulas.ts";
import { shownStats } from "./stats.ts";
import { STATS } from "./state.ts";
import { campaign } from "./testing.ts";
import { view } from "./view.ts";

const SPEED = STATS.indexOf("speed");
const MIGHT = STATS.indexOf("might");

describe("shown stats", () => {
  it("adds traits and the Tarot to the stats, and says where each bonus came from", () => {
    const s = campaign(2, 3);
    const p = s.people.find((x) => x.status === "scion")!;
    Object.assign(p, { traits: ["fleet"], tarot: "strength", reversed: undefined, injuries: [] });
    const { stats, from } = shownStats(s, p, true);
    expect(stats[SPEED]).toBe(jobStat(p, "speed") + 1);
    expect(from[SPEED]).toContain("+1 Fleet");
    expect(stats[MIGHT]).toBeGreaterThanOrEqual(jobStat(p, "might") + 2);
    expect(from[MIGHT]).toContain("+2 Strength");
  });

  it("counts a Might percent once, where damage is dealt, and shows it on the card", () => {
    const s = campaign(2, 3);
    const p = s.people.find((x) => x.status === "scion")!;
    Object.assign(p, { traits: [], tarot: "fool", injuries: [{ id: "body_broken_ribs", years: 2 }] });
    const u = scionCombatant(p, { id: 1, col: 0, row: 0 });
    // The combatant keeps the plain Might; damage.ts applies mods.mightPct once.
    expect(u.might).toBe(jobStat(p, "might"));
    expect(u.mods.mightPct).toBe(-20);
    expect(shownStats(s, p, true).stats[MIGHT]).toBe(Math.max(1, Math.floor(jobStat(p, "might") * 0.8)));
  });

  it("shows a recruit's full stats only once the Tarot shows (Insight 3), and never a rival's recruits", () => {
    const s = campaign(2, 3);
    const mine = s.people.find((x) => x.host === 0 && x.status === "recruit");
    if (!mine) return;
    s.houses[0]!.buildings.scriptorium = 1;
    expect(view(s, s.players[0]!).people.find((x) => x.id === mine.id)?.stats).toBeUndefined();
    s.houses[0]!.buildings.scriptorium = 3;
    expect(view(s, s.players[0]!).people.find((x) => x.id === mine.id)?.stats).toHaveLength(6);
    expect(view(s, s.players[1]!).people.find((x) => x.id === mine.id)).toBeUndefined();
  });
});
