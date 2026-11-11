import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Content, type ReplayUnit } from "@vibepulse/shared/games/sovereign-pact";
import { warbandBattle } from "../../../shared/games/sovereign-pact/combat/fixtures.ts";
import { recorded } from "../../../shared/games/sovereign-pact/combat/replay.ts";
import { blowOf, crunchOf, soundsOf } from "./sfx";

const DIR = join(__dirname, "../../../../public/sfx/sovereign-pact");
const unit = (u: Partial<ReplayUnit> & { id: number }): ReplayUnit => ({ side: "party", name: "x", size: [1, 1], maxHp: 1, maxMp: 0, maxSanity: 1, ...u });
const units = new Map(
  [
    unit({ id: 1, person: 1, house: 0, weapon: "axe" }),
    unit({ id: 2, side: "enemy", enemy: "beast_bat" }),
    unit({ id: 3, side: "enemy", enemy: "beast_behemoth", size: [2, 2] }),
    unit({ id: 4, person: 2, house: 0, weapon: "staff" }),
    unit({ id: 5, side: "enemy", enemy: "court_dark_knight" }),
    unit({ id: 6, side: "enemy", enemy: "barrow_bride" }),
    unit({ id: 7, side: "enemy", enemy: "barrow_banshee" }),
    unit({ id: 8, person: 3, house: 0, weapon: "sword" }),
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
      for (const s of heard) expect(Content.SFX_BY_ID.has(s.cue) || s.cue.startsWith("song:"), s.cue).toBe(true);
    }
  });

  it("plays a song's own notes, not a blessing's cue (Josh 2026-11-11)", () => {
    expect(soundsOf([{ t: "use", unit: 4, ability: "hearthsong", target: at({ side: "party" }) }], units).map((x) => x.cue)).toEqual(["song:hearthsong"]);
  });

  it("swings the Scion's weapon, lands it, then the body gives way", () => {
    const s = soundsOf([{ t: "use", unit: 1, ability: "attack", target: at({ side: "enemy" }) }, { t: "hit", unit: 1, target: 2, damage: 9, crit: true }], units);
    expect(s.map((x) => x.cue)).toEqual(["swing_heavy", "hit_axe", "crit", "crunch_bone"]);
    expect(s.find((x) => x.cue === "crunch_bone")!.at).toBeGreaterThan(s.find((x) => x.cue === "hit_axe")!.at);
    // A miss swings at nothing: no crunch.
    expect(soundsOf([{ t: "use", unit: 8, ability: "attack", target: at({ side: "enemy" }) }, { t: "miss", unit: 8, target: 2 }], units).map((x) => x.cue)).toEqual(["swing_blade", "miss"]);
  });

  it("crunches by weapon and by what it strikes", () => {
    const [axe, bat, knight, bride, banshee, sword] = [1, 2, 5, 6, 7, 8].map((id) => units.get(id));
    expect(crunchOf(sword, bat)).toBe("crunch_flesh");
    expect(crunchOf(axe, bat)).toBe("crunch_bone");
    expect(crunchOf(sword, knight)).toBe("crunch_plate");
    expect(crunchOf(sword, bride)).toBe("crunch_bone");
    expect(crunchOf(sword, banshee)).toBeNull();
    // A creature's own blows already bite and claw.
    expect(crunchOf(bat, axe)).toBeNull();
  });

  it("bursts a magic weapon's element after the cut", () => {
    const fire = soundsOf([{ t: "use", unit: 8, ability: "attack", target: at({ side: "enemy" }) }, { t: "hit", unit: 8, target: 2, damage: 9, element: "fire" }], units);
    expect(fire.map((x) => x.cue)).toEqual(["swing_blade", "hit_blade", "crunch_flesh", "impact_fire"]);
    const edge = soundsOf([{ t: "use", unit: 8, ability: "attack", target: at({ side: "enemy" }) }, { t: "hit", unit: 8, target: 2, damage: 9, edge: "holy" }], units);
    expect(edge.map((x) => x.cue)).toContain("impact_holy");
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
