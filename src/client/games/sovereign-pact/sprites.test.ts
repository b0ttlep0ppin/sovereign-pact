// The battle sprites (§14.11): everything that fights or lies in wait has its picture, cut and small.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Content } from "@vibepulse/shared/games/sovereign-pact";
import { spriteOf } from "./sprites";

const DIR = join(__dirname, "../../../../public/sprites/sovereign-pact/enemies");

describe("the battle sprites", () => {
  it("draws every enemy, boss, summon and hazard, and nothing else", () => {
    const ids = [...Content.ENEMIES.map((e) => e.id), ...Content.BOSSES.map((b) => b.id), ...Content.SUMMONS.map((s) => s.id), ...Content.HAZARDS.map((h) => h.id)];
    expect(ids.filter((id) => !Content.SPRITE_BY_ID.has(id))).toEqual([]);
    expect(Content.SPRITES.map((s) => s.id).filter((id) => !ids.includes(id))).toEqual([]);
  });

  it("ships each cut, and only those, under 130 KB", () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith(".webp"));
    expect(files.map((f) => f.replace(/\.webp$/, "")).sort()).toEqual(Content.SPRITES.map((s) => s.id).sort());
    for (const f of files) expect(statSync(join(DIR, f)).size, f).toBeLessThan(130 * 1024);
  });

  it("finds a sprite by enemy, summon or hazard id, and a later form by its first", () => {
    expect(spriteOf({ enemy: "beast_goblin" })?.url).toMatch(/enemies\/beast_goblin\.webp$/);
    expect(spriteOf({ summon: "wyrmling" })?.url).toMatch(/wyrmling\.webp$/);
    expect(spriteOf({ hazard: "rockfall" })?.url).toMatch(/rockfall\.webp$/);
    expect(spriteOf({ enemy: "goblin_lord_enraged" })?.url).toMatch(/goblin_lord\.webp$/);
    expect(spriteOf({})).toBeNull();
    expect(existsSync(join(DIR, "goblin_lord.webp"))).toBe(true);
  });
});
