// The Minstrel's and Tinkerer's last abilities (§12.11, §12.16): Carrying Voice, Crescendo, Finale;
// Shrapnel Mine, Jury-Rig, Pack Rat.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { act, advance, cannotUse, resolve } from "./combat/battle.ts";
import { enemyCombatant, newBattle } from "./combat/build.ts";
import { standardParty } from "./combat/fixtures.ts";
import { FINALE } from "./combat/songs.ts";
import { addStatus } from "./combat/status.ts";
import { cellOf } from "./combat/targets.ts";
import type { Battle, Combatant } from "./combat/types.ts";
import { ABILITY_SET_BY_JOB, ACTIVE_BY_ID, CONSUMABLE_BY_ID } from "./content.ts";
import { TUNING } from "./tuning.ts";

function scion(job: "minstrel" | "tinkerer", id = 1, row = 3): Combatant {
  const [u] = standardParty(id, 9, id);
  return { ...u!, id, col: 1, row, mp: 500, maxMp: 500, tp: 200, abilities: ABILITY_SET_BY_JOB.get(job)!.actives, mods: {}, statuses: [], flags: [] };
}
const ally = (id = 2, row = 5): Combatant => ({ ...standardParty(id, 9, id)[0]!, id, col: 0, row, mods: {}, statuses: [], flags: [] });
const foe = (id = 10, row = 3, col = 0): Combatant => ({ ...enemyCombatant("barrow_skeleton", { id, level: 3, col, row }), hp: 9999, maxHp: 9999 });
const songs = (layer: string) => ABILITY_SET_BY_JOB.get("minstrel")!.actives.filter((a) => a.song?.layer === layer && a.side !== "foe");

function ready(u: Combatant, ...others: Combatant[]): Battle {
  const b = newBattle(1, [u, ...others]);
  b.actor = u.id;
  u.ct = 200;
  return b;
}

describe("the Minstrel", () => {
  it("reaches a Deaf ally at half with Carrying Voice", () => {
    const song = songs("melody")[0]!;
    const [k, v] = Object.entries(song.song!.mods)[0]!;
    const [u, a] = [{ ...scion("minstrel"), mods: { carryingVoice: 1 } }, ally()];
    const b = ready(u, a, foe());
    addStatus(b, a, "deaf");
    resolve(b, createRng(1), u, song, cellOf(u));
    expect(a.statuses.find((s) => s.id === song.id)?.mods?.[k]).toBe(Math.round(v * 0.5));
  });

  it("swells a layer that has played 300 ticks with Crescendo, once", () => {
    const song = songs("melody")[0]!;
    const [k, v] = Object.entries(song.song!.mods)[0]!;
    const [u, a] = [{ ...scion("minstrel"), mods: { crescendo: 1 } }, ally()];
    const b = ready(u, a, foe());
    resolve(b, createRng(1), u, song, cellOf(u));
    b.tick += 300;
    u.ct = 500;
    advance(b, createRng(1));
    expect(a.statuses.find((s) => s.id === song.id)?.mods?.[k]).toBe(Math.round(v * 1.5));
    expect(a.mods[k]).toBe(Math.round(v * 1.5));
  });

  it("plays the Finale only with all three layers sounding, striking every foe and ending the songs", () => {
    const u = { ...scion("minstrel"), abilities: [...scion("minstrel").abilities, FINALE] };
    const [f, g] = [foe(10, 2), foe(11, 6, 2)];
    const b = ready(u, ally(), f, g);
    expect(cannotUse(u, FINALE)).toBe("needs three songs");
    for (const layer of ["melody", "harmony", "chorus"]) resolve(b, createRng(1), u, ABILITY_SET_BY_JOB.get("minstrel")!.actives.find((a) => a.song?.layer === layer)!, cellOf(u));
    expect(cannotUse(u, FINALE)).toBeNull();
    resolve(b, createRng(1), u, FINALE, cellOf(f));
    expect(f.hp).toBeLessThan(9999);
    expect(g.hp).toBeLessThan(9999);
    expect(u.songs).toBeUndefined();
  });
});

describe("the Tinkerer", () => {
  it("lays a Shrapnel Mine that bursts on the next foe to act", () => {
    const u = { ...scion("tinkerer"), parts: ["powder", "plate"] };
    const [f, g, far] = [{ ...foe(10, 3), ct: 0 }, { ...foe(11, 4), ct: 0 }, { ...foe(12, 7, 2), ct: 0 }];
    const b = ready(u, f, g, far);
    act(b, createRng(1), u, { do: "ability", ability: "shrapnel_mine", target: cellOf(f) });
    expect(f.hp).toBe(9999);
    expect(b.mines).toHaveLength(1);
    f.ct = 500;
    advance(b, createRng(1));
    expect(f.hp).toBeLessThan(9999);
    expect(g.hp).toBeLessThan(9999);
    expect(far.hp).toBe(9999);
    expect(b.mines).toEqual([]);
  });

  it("turns three Components into a magic consumable with Jury-Rig", () => {
    const u = { ...scion("tinkerer"), parts: ["spring", "gear"] };
    const b = ready(u, foe());
    expect(cannotUse(u, ACTIVE_BY_ID.get("jury_rig")!)).toBe("parts");
    u.parts.push("wire", "core");
    act(b, createRng(1), u, { do: "ability", ability: "jury_rig", target: cellOf(u) });
    expect(u.parts).toEqual(["core"]);
    expect(b.satchel).toHaveLength(1);
    expect(TUNING.combat.tinkerer.rigItems).toContain(b.satchel![0]);
  });

  it("makes only consumables that exist", () => {
    for (const id of TUNING.combat.tinkerer.rigItems) expect(CONSUMABLE_BY_ID.get(id)?.use).toBe("battle");
  });

  it("leaves no ability unbuilt in any Job", () => {
    const left = [...ABILITY_SET_BY_JOB.values()].flatMap((set) => [...set.actives, ...set.passives].filter((a) => a.later).map((a) => a.id));
    expect(left).toEqual([]);
  });
});
