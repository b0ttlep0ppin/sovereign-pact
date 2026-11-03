// The early regions' bosses (Josh's playtest, 2026-11-02: the Tree King was the only boss he met, twice).
import { describe, expect, it } from "vitest";
import { bossBattle } from "./combat/bosses.ts";
import { realParty, BASELINE } from "./combat/roster.ts";
import { simulate } from "./combat/sim.ts";
import { BOSS_BY_ID } from "./content.ts";

const EARLY = ["pale_sire", "blight_cap", "sahagin_chief", "wight_king", "rime_queen", "foundry_warden", "hallway_giant", "apostate_bishop", "chained_marquis"];

describe("the early regions' bosses", () => {
  for (const id of EARLY) {
    it(`${id} is fought to the end by the bots at its levels, entering a phase and speaking`, () => {
      const def = BOSS_BY_ID.get(id)!;
      let phased = 0;
      for (const level of def.levels) {
        for (let seed = 1; seed <= 3; seed++) {
          const b = bossBattle(seed, realParty(seed, level * 2 + 2, BASELINE), id, level);
          expect(simulate(b).outcome).toBeDefined();
          expect(b.events.some((e) => e.t === "say")).toBe(true);
          if (b.events.some((e) => e.t === "phase")) phased++;
        }
      }
      expect(phased).toBeGreaterThan(0);
    });
  }
});
