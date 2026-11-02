import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Content, type ReplayUnit } from "@vibepulse/shared/games/sovereign-pact";
import { warbandBattle } from "../../../shared/games/sovereign-pact/combat/fixtures.ts";
import { recorded } from "../../../shared/games/sovereign-pact/combat/replay.ts";
import { blowOf, soundsOf } from "./sfx";

const DIR = join(__dirname, "../../../../public/sfx/sovereign-pact");
const unit = (u: Partial<ReplayUnit> & { id: number }): ReplayUnit => ({ side: "party", name: "x", size: [1, 1], maxHp: 1, maxMp: 0, maxSanity: 1, ...u });
const units = new Map(
  [
    unit({ id: 1, person: 1, house: 0, weapon: "axe" }),
    unit({ id: 2, side: "enemy", enemy: "beast_bat" }),
    unit({ id: 3, side: "enemy", enemy: "beast_behemoth", size: [2, 2] }),
    unit({ id: 4, person: 2, house: 0, weapon: "staff" }),
  ].map((u) => [u.id, u]),
);
const at = (cell: { side: "party" | "enemy" }) => ({ ...cell, col: 0, row: 0 });

describe("the battle's sound (§16.1)", () => {
  it("ships every take of every cue, small", () => {
    const files = readdirSync(DIR);
    for (const c of Content.SFX) for (let n = 1; n <= c.takes; n++) expect(existsSync(join(DIR, `${c.id}-${n}.ogg`)), `${c.id}-${n}`).toBe(true);
    expect(files.length).toBe(Content.SFX.reduce((n, c) => n + c.takes, 0));
    for (const f of files) expect(statSync(join(DIR, f)).size, f).toBeLessThan(80 * 1024);
  });

  it("plays only cues it has, for every turn of a real battle", () => {
    for (const seed of [1, 2, 3, 4]) {
      const { replay } = recorded(warbandBattle(seed, 3), "An Encounter");
      const roll = new Map(replay.units.map((u) => [u.id, u]));
      const heard = replay.frames.flatMap((f) => soundsOf(f.ev, roll));
      expect(heard.length).toBeGreaterThan(replay.frames.length / 2);
      for (const s of heard) expect(Content.SFX_BY_ID.has(s.cue), s.cue).toBe(true);
    }
  });

  it("swings the Scion's weapon, then lands it", () => {
    const s = soundsOf([{ t: "use", unit: 1, ability: "attack", target: at({ side: "enemy" }) }, { t: "hit", unit: 1, target: 2, damage: 9, crit: true }], units);
    expect(s.map((x) => x.cue)).toEqual(["swing_heavy", "hit_axe", "crit"]);
  });

  it("casts a spell by its element", () => {
    const s = soundsOf([{ t: "use", unit: 4, ability: "ember", target: at({ side: "enemy" }) }, { t: "hit", unit: 4, target: 2, damage: 9, element: "fire" }], units);
    expect(s.map((x) => x.cue)).toEqual(["cast_fire", "impact_fire"]);
  });

  it("gives creatures their own blows, and the fallen a thud", () => {
    expect(blowOf(units.get(2))).toEqual([null, "hit_bite"]);
    expect(blowOf(units.get(3))).toEqual([null, "hit_maul"]);
    const s = soundsOf([{ t: "use", unit: 2, ability: "bite", target: at({ side: "party" }) }, { t: "hit", unit: 2, target: 1, damage: 30 }, { t: "down", target: 1 }], units);
    expect(s.map((x) => x.cue)).toEqual(["hit_bite", "fall"]);
  });

  it("screams for a devastating injury, and cracks for a lesser one", () => {
    const bad = Content.INJURY_TABLES[0]!.results.find((r) => r.band === "devastating")!;
    const mild = Content.INJURY_TABLES[0]!.results.find((r) => r.band !== "devastating" && !r.death)!;
    const injury = (result: string) => soundsOf([{ t: "injury", target: 1, table: "head", roll: 1, total: 1, result }], units).map((x) => x.cue);
    expect(injury(bad.id)).toEqual(["dread"]);
    expect(injury(mild.id)).toEqual(["injury"]);
  });
});
