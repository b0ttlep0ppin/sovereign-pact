// The homecoming: the account of an expedition once the party is home (Josh's playtest, 2026-11-02).
import { describe, expect, it } from "vitest";
import { checkpoint } from "./save.ts";
import type { Homecoming, SovState } from "./state.ts";
import { campaign, playOut } from "./testing.ts";
import { view } from "./view.ts";

/** Every account the first Years of a bot campaign leave, with the state that made it. */
function accounts(houses: number, seed: number, years = 6): [Homecoming, SovState][] {
  const out: [Homecoming, SovState][] = [];
  let last: Homecoming | undefined;
  playOut(campaign(houses, seed), (s) => {
    if (s.homecoming && s.homecoming !== last && s.year <= years) {
      last = s.homecoming;
      out.push([s.homecoming, s]);
    }
  }, 4000);
  return out;
}

describe("the homecoming", () => {
  it("tells a lone House what the expedition gave each Scion and what it took home", () => {
    const all = accounts(1, 3);
    expect(all.length).toBeGreaterThan(0);
    for (const [h] of all) {
      expect(h.people.length).toBeGreaterThan(0);
      for (const p of h.people) {
        expect(p.xp).toBeGreaterThanOrEqual(0);
        expect(p.levelTo).toBeGreaterThanOrEqual(p.levelFrom);
      }
      if (h.result === "won") {
        expect(h.claims.length).toBeGreaterThan(0);
        expect(h.claims.every((c) => c.house === 0)).toBe(true);
        expect(h.people.filter((p) => !p.fate).every((p) => p.xp > 0 && p.jp > 0)).toBe(true);
      }
      // A wipe loses the haul; only what events gave a House along the way (an item each) went home.
      if (h.result === "wiped") expect(h.claims.every((c) => c.text.startsWith("the "))).toBe(true);
    }
  });

  it("lists every House's claims after a draft, and shows the same account to everyone", () => {
    const all = accounts(3, 4);
    const won = all.find(([h]) => h.result === "won");
    expect(won).toBeDefined();
    const [h, s] = won!;
    expect(new Set(h.claims.map((c) => c.house)).size).toBeGreaterThan(1);
    expect(view(s, s.players[0]!).homecoming).toEqual(view(s, s.players[2]!).homecoming);
  });

  it("is not saved", () => {
    const [, s] = accounts(1, 3)[0]!;
    let at = s;
    playOut(s, (x) => {
      if (at === s && x.phase === "settlement" && x.phaseMoves === 0) at = x;
    }, 400);
    const save = checkpoint(at);
    expect(save).not.toBeNull();
    expect("homecoming" in save!.campaign).toBe(false);
  });
});
