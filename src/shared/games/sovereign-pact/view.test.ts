// The hidden-information test (HANDOFF §7): for every state of a campaign and every seat, view() holds
// nothing from the forbidden list (HANDOFF §3.2, SPEC §15.7) beyond what that seat is allowed.
import { describe, expect, it } from "vitest";
import { sovereignPact, type SovState } from "./index.ts";
import { campaign, playOut, seats } from "./testing.ts";
import type { SovView } from "./view.ts";

const g = sovereignPact;

/** Keys that never appear in another House's public record. */
const PRIVATE_HOUSE_KEYS = ["ambition", "score", "ascendancy", "gold", "debt", "stores", "pactMarks"];

/** Every key anywhere in a JSON value, with its path. */
function keys(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => keys(v, `${path}[${i}]`));
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([k, v]) => [`${path}.${k}`, ...keys(v, `${path}.${k}`)]);
}

function checkSeat(s: SovState, seat: number, v: SovView): void {
  expect(v.me).toBe(seat);
  // Pact marks are hidden from everyone, their own House included, until the final score (§14.7a).
  if (s.phase !== "over") expect(keys(v).filter((k) => k.endsWith(".pactMarks"))).toEqual([]);
  // Dark Bargains: a House sees only those offered to it.
  expect(v.mine?.bargains ?? []).toEqual(s.bargains.pending.filter((b) => b.house === seat).map((b) => b.id));
  for (const h of v.houses) for (const k of PRIVATE_HOUSE_KEYS) if (k !== "pactMarks" || s.phase !== "over") expect(h).not.toHaveProperty(k);
  expect(v.mine?.ambition).toEqual(s.houses[seat]!.ambition);
  const mineIds = new Set(s.people.filter((p) => p.host === seat).map((p) => p.id));
  // Items: what a shown person wears, and this House's own stash; never another House's stash.
  const shownGear = new Set(v.people.flatMap((p) => Object.values(p.gear ?? {})));
  const wornByAnyone = new Set(s.people.flatMap((p) => Object.values(p.gear)));
  for (const it of v.items) expect(shownGear.has(it.id) || (it.house === seat && !wornByAnyone.has(it.id)), `item ${it.id}`).toBe(true);
  for (const p of v.people) {
    const real = s.people.find((x) => x.id === p.id)!;
    expect(p).not.toHaveProperty("loyalty");
    expect(p).not.toHaveProperty("carry");
    if (!mineIds.has(p.id)) {
      // Other Houses' recruits are not shown at all; their Scions without growths or potential.
      expect(real.status).not.toBe("recruit");
      expect(p).not.toHaveProperty("growth");
      expect(p).not.toHaveProperty("potential");
    }
    if (real.status === "recruit") {
      const insight = v.mine!.insight;
      if (insight < 1) {
        expect(p).not.toHaveProperty("potential");
        expect(p).not.toHaveProperty("base");
        expect(p).not.toHaveProperty("sanity");
        expect(p).not.toHaveProperty("mp");
      }
      if (insight < 2) {
        expect(p).not.toHaveProperty("growth");
        expect(p.traits.length).toBeLessThanOrEqual(1);
      }
      if (insight < 3) expect(p).not.toHaveProperty("tarot");
    }
  }
}

describe("view", () => {
  it.each([1, 2, 3, 4])("never shows a seat what it may not see, in any state of a %i-House campaign", (H) => {
    let states = 0;
    playOut(campaign(H, 21 + H), (s) => {
      states++;
      s.players.forEach((p, seat) => checkSeat(s, seat, g.view(s, p)));
    });
    expect(states).toBeGreaterThan(20);
    // Every state of a whole campaign, for every seat: a 4-House one runs near 30 s on CI.
  }, 120_000);

  it("follows the Scriptorium's Insight for the House's own recruits (§6.4)", () => {
    const s = campaign(2);
    const recruit = (v: SovView) => v.people.find((p) => p.status === "recruit" && p.host === 0)!;
    expect(recruit(g.view(s, "p1"))).not.toHaveProperty("base");
    for (const [level, has] of [[1, "potential"], [2, "growth"], [3, "tarot"]] as const) {
      s.houses[0]!.buildings.scriptorium = level;
      expect(recruit(g.view(s, "p1"))).toHaveProperty(has);
    }
  });

  it("gives a spectator the public picture and nothing private", () => {
    const s = campaign(3);
    const v = g.view(s, "someone-watching");
    expect(v.me).toBeNull();
    expect(v.mine).toBeNull();
    expect(v.people.some((p) => p.status === "recruit")).toBe(false);
    expect(v.houses).toHaveLength(3);
  });

  it("names the shared track Unrest for a single House and Accord otherwise", () => {
    expect(g.view(campaign(1), "p1").track).toBe("Unrest");
    expect(g.view(campaign(2), "p1").track).toBe("Accord");
  });

  it("is the same view for the same state (no clock, no randomness)", () => {
    const s = campaign(2);
    expect(g.view(s, seats(2)[1]!)).toEqual(g.view(s, seats(2)[1]!));
  });
});
