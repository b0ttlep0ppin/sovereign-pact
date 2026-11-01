// Minstrel songs (§12.2, §12.11): layers, who hears them, what ends them, and the chorus over time.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { act, resolve } from "./combat/battle.ts";
import { enemyCombatant, newBattle } from "./combat/build.ts";
import { step } from "./combat/clock.ts";
import { standardParty } from "./combat/fixtures.ts";
import { down } from "./combat/injury.ts";
import { addStatus } from "./combat/status.ts";
import { cellOf } from "./combat/targets.ts";
import type { Combatant } from "./combat/types.ts";
import { ACTIVE_BY_ID } from "./content.ts";

const song = (id: string) => ACTIVE_BY_ID.get(id)!;
const scion = (id: number, row: number, extra: Partial<Combatant> = {}): Combatant => {
  const [u] = standardParty(id, 9, id);
  return { ...u!, id, col: 0, row, mp: 999, maxMp: 999, ...extra };
};
const foe = (id: number, row: number) => enemyCombatant("barrow_skeleton", { id, level: 3, col: 0, row });

function field() {
  const minstrel = scion(1, 3, { mods: { songCt: 25 } });
  const ally = scion(2, 4);
  const deaf = scion(3, 5);
  const enemy = foe(10, 3);
  const b = newBattle(1, [minstrel, ally, deaf, enemy]);
  addStatus(b, deaf, "deaf");
  const play = (id: string) => resolve(b, createRng(1), minstrel, song(id), cellOf(minstrel));
  return { b, minstrel, ally, deaf, enemy, play };
}

describe("songs", () => {
  it("reach every ally who can hear, and a new song replaces its layer", () => {
    const { minstrel, ally, deaf, play } = field();
    play("march");
    expect([minstrel.mods.speed, ally.mods.speed, deaf.mods.speed]).toEqual([1, 1, undefined]);
    play("hymn_of_iron");
    expect(ally.mods.speed).toBeUndefined();
    expect(ally.mods.physicalTakenPct).toBe(-15);
    play("hearthsong");
    expect(minstrel.songs).toEqual({ melody: "hymn_of_iron", chorus: "hearthsong" });
  });

  it("harmonies fall on enemies, and Dirge frightens only the undead", () => {
    const { enemy, ally, play } = field();
    play("lullaby");
    expect(enemy.mods.speed).toBe(-1);
    expect(ally.mods.speed).toBeUndefined();
    play("dirge");
    expect(enemy.mods.healingReceivedPct).toBe(-50);
    expect(enemy.mods.speed).toBeUndefined();
  });

  it("stop when the Minstrel is Silenced or goes Down", () => {
    const f = field();
    f.play("march");
    addStatus(f.b, f.minstrel, "silence");
    expect(f.ally.mods.speed).toBeUndefined();
    expect(f.minstrel.songs).toBeUndefined();
    const g = field();
    g.play("mockery");
    down(g.b, g.minstrel);
    expect(g.enemy.mods.accuracy).toBeUndefined();
  });

  it("chorus songs work over time", () => {
    const { b, ally, enemy, play } = field();
    play("fountain");
    ally.mp = 0;
    for (let i = 0; i < 10; i++) step(b, createRng(i));
    expect(ally.mp).toBeGreaterThan(0);
    enemy.immune = []; // skeletons do not take Poison
    play("plague_chant");
    for (let i = 0; i < 10; i++) step(b, createRng(i));
    expect(enemy.statuses.some((s) => s.id === "poison")).toBe(true);
  });

  it("costs 25 CT with Perfect Pitch", () => {
    const { b, minstrel } = field();
    minstrel.abilities = [song("march")];
    minstrel.ct = 100;
    b.actor = minstrel.id;
    act(b, createRng(1), minstrel, { do: "ability", ability: "march", target: cellOf(minstrel) });
    expect(minstrel.ct).toBe(75);
  });
});
