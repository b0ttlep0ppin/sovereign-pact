// Named items (§13.4, HANDOFF §6): fixed properties on a base, one of each a campaign; bosses drop
// their own, pools hide theirs in Caches and boss hauls; artifacts score their category (§3.4).
import { describe, expect, it } from "vitest";
import { BOSS_BY_ID, ITEM_BASE_BY_ID, NAMED, POOL_BY_ID, PROPERTY_BY_ID } from "./content.ts";
import { muster } from "./expedition.ts";
import { madeNamed, mintNamed, propertyKinds } from "./items.ts";
import { bossLoot, find, itemName } from "./loot.ts";
import { categories } from "./score.ts";
import type { SovState } from "./state.ts";
import { calm, campaign } from "./testing.ts";
import { TUNING } from "./tuning.ts";

function away(pool = "barrows", level = 4, boss?: string): SovState {
  const s = calm(campaign(2, 2));
  s.phase = "expedition";
  muster(s, { type: "delve", pool, level, size: 4, ...(boss ? { boss } : {}) });
  return s;
}

describe("the named items' content", () => {
  it.each(NAMED.map((n) => [n.id, n] as const))("%s fits its base, its properties, and names real bosses and pools", (_, n) => {
    const base = ITEM_BASE_BY_ID.get(n.base);
    expect(base, n.base).toBeDefined();
    const kinds = propertyKinds({ base: n.base });
    for (const [id, v] of n.props) {
      const p = PROPERTY_BY_ID.get(id);
      expect(p, id).toBeDefined();
      expect(p!.on.some((k) => kinds.includes(k)), `${id} on a ${n.base}`).toBe(true);
      if (p!.roll) expect(v).toBeGreaterThanOrEqual(p!.roll[0]);
      if (p!.roll) expect(v).toBeLessThanOrEqual(p!.roll[1]);
    }
    if (n.boss) expect(BOSS_BY_ID.has(n.boss), n.boss).toBe(true);
    for (const pool of n.pools ?? []) expect(POOL_BY_ID.has(pool), pool).toBe(true);
    expect(n.boss || n.pools || n.cure, "found somewhere").toBeTruthy();
  });

  it("every pool hides at least one", () => {
    for (const pool of POOL_BY_ID.keys()) expect(NAMED.some((n) => n.pools?.includes(pool)), pool).toBe(true);
  });
});

describe("finding them", () => {
  it("is made once a campaign, with its fixed properties and its own name", () => {
    const s = away();
    const item = mintNamed(s, "oathkeeper", 0, 4);
    expect(item).toMatchObject({ base: "sword", tier: 4, named: "oathkeeper", props: [["oathbound", 1], ["holy_edge", 25]] });
    expect(itemName(item)).toBe("Oathkeeper");
    expect(madeNamed(s, "oathkeeper")).toBe(true);
  });

  it("turns up now and then among a pool's Fine finds, never twice", () => {
    const s = away("beast_lands", 4);
    const seen: string[] = [];
    for (let i = 0; i < 400; i++) {
      const it = find(s, 3);
      if (it.named) seen.push(it.named);
    }
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen).size).toBe(seen.length);
    for (const id of seen) expect(NAMED.find((n) => n.id === id)!.pools).toContain("beast_lands");
    // Common finds never are.
    expect(Array.from({ length: 100 }, () => find(s, 2)).some((x) => x.named)).toBe(false);
  });

  it("waits for its level", () => {
    const s = away("dragon_reaches", 4);
    for (let i = 0; i < 300; i++) expect(find(s, 4).named).not.toBe("dragonbone_crossbow");
  });

  it("falls with its boss the first time: the Crown from the Cursed King", () => {
    const s = away("barrows", 6, "cursed_king");
    bossLoot(s);
    expect(s.expedition!.haul!.items.some((i) => i.named === "the_crown")).toBe(true);
    const t = away("barrows", 6, "cursed_king");
    t.flags.push("named_the_crown");
    bossLoot(t);
    expect(t.expedition!.haul!.items.some((i) => i.named === "the_crown")).toBe(false);
  });
});

describe("artifacts", () => {
  it("score their category for whoever holds them, on top of Relics", () => {
    const s = calm(campaign(2, 2));
    const before = categories(s, 0);
    s.items.push(mintNamed(s, "the_crown", 0, 6));
    const after = categories(s, 0);
    expect(after.lineage - before.lineage).toBeGreaterThanOrEqual(12);
    expect(after.relics - before.relics).toBe(TUNING.scoring.relic + TUNING.scoring.named);
    s.items.at(-1)!.house = 1;
    expect(categories(s, 0)).toEqual(before);
  });
});
