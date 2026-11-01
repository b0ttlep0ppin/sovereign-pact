// Item properties (§13.4–13.5): how they roll, that the rules read every mod they name, and what the
// main ones do in battle.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { ATTACK, act, resolve } from "./combat/battle.ts";
import { enemyCombatant, newBattle, scionCombatant } from "./combat/build.ts";
import { strike } from "./combat/damage.ts";
import { standardParty } from "./combat/fixtures.ts";
import type { Combatant } from "./combat/types.ts";
import { ITEM_BASES, PROPERTIES, PROPERTY_BY_ID } from "./content.ts";
import { promote, rollRecruit } from "./generate.ts";
import { equip, gearTotals, mint, propertyKinds, rollProps } from "./items.ts";
import type { ItemTier } from "./state.ts";
import { campaign } from "./testing.ts";

describe("rolling properties", () => {
  it("gives Fine 1, Masterwork 2 and Relics 2–3, each allowed on the item, in range, one per group", () => {
    const s = campaign(1);
    const rng = createRng(3);
    for (let n = 0; n < 600; n++) {
      const tier = (1 + (n % 5)) as ItemTier;
      const item = rollProps(rng, mint(s, rng.pick(ITEM_BASES).id, 0, tier), { cursed: n % 7 === 0 && tier >= 3 });
      const props = (item.props ?? []).map(([id, v]) => [PROPERTY_BY_ID.get(id)!, v] as const);
      const good = props.filter(([p]) => !p.curse);
      expect(good.length).toBe(tier < 3 ? 0 : tier === 3 ? 1 : tier === 4 ? 2 : good.length);
      if (tier === 5) expect([2, 3]).toContain(good.length);
      const kinds = propertyKinds(item);
      const groups = props.flatMap(([p]) => (p.group ? [p.group] : []));
      expect(new Set(groups).size).toBe(groups.length);
      for (const [p, v] of props) {
        expect(p.on.some((k) => kinds.includes(k)), `${p.id} on ${item.base}`).toBe(true);
        expect(p.minTier ?? 0).toBeLessThanOrEqual(tier);
        expect(v).toBeGreaterThanOrEqual(p.roll?.[0] ?? 1);
        expect(v).toBeLessThanOrEqual(p.roll?.[1] ?? 1);
      }
      if (n % 7 === 0 && tier >= 3) expect(item.cursed && props.some(([p]) => p.curse)).toBe(true);
    }
  });

  it("only names mods the rules read", () => {
    const read = [
      /^(multiHit|crit|critMult|drainPct|tpGainPct|mpPerHit|speed|readiness|giantPct|executePct|charged|counter|reaching|spellbound|siphon|oathPct|hungry|lucky)$/,
      /^(thornsPct|secondWind|moveCostPerCell|bulwark|accuracy|sanityTakenPct|tpStart|mpPerTurn|sanityPerTurn|maxSanityPct|noDefend|markedStart|sanityStart|shieldGuard)$/,
      /^(edge|ward|element)\.(fire|water|earth|wind|holy|dark)$/,
      /^bias\.(head|body|arms|legs)$/,
      /^onHit\.(bleed|poison|burn|stun|fear|slow)$/,
      /^bane\.\w+$/,
      /^resist\.\w+$/,
      /^(might|resilience|guile|acuity|sagacity)Flat$/,
      /^(@|head)(DurabilityPct|Steps)$/,
    ];
    const outside = new Set(["unmoved", "ambushPct", "loyaltyPerYear", "essencePct"]);
    for (const p of PROPERTIES) {
      for (const key of Object.keys(p.mods)) {
        if (outside.has(key)) expect(p.effect ?? "unmoved", p.id).toMatch(/campaign|unmoved/);
        else expect(read.some((r) => r.test(key)), `${p.id}: ${key}`).toBe(true);
      }
    }
  });
});

describe("properties in the gear totals", () => {
  it("resolve the piece's location, cap Quickening at one, and need a shield for Guarding", () => {
    const s = campaign(1);
    const p = promote(rollRecruit(createRng(1), s.nextId++, 0), "knight");
    s.people.push(p);
    const helm = mint(s, "coif", 0, 4);
    helm.props = [["fortified", 20], ["guarding", 1]];
    equip(s, p, helm, "head");
    const legs = mint(s, "greaves", 0, 4);
    legs.props = [["quickening", 1]];
    equip(s, p, legs, "legs");
    const ring = mint(s, "ring", 0, 4);
    ring.props = [["quickening", 1], ["stat_might", 4]];
    equip(s, p, ring, "acc1");
    const sword = mint(s, "sword", 0, 3);
    sword.props = [["blessed", 1]];
    equip(s, p, sword, "main");
    let t = gearTotals(s, p);
    expect(t.mods.headDurabilityPct).toBe(20);
    expect(t.mods.speed).toBe(1);
    expect(t.guard).toBe(0);
    expect(t.weapon.element).toBe("holy");
    equip(s, p, mint(s, "buckler", 0), "off");
    t = gearTotals(s, p);
    expect(t.guard).toBe(15 + 10);
    const c = scionCombatant(p, { id: 1, col: 0, row: 3, gear: t });
    const bare = scionCombatant(p, { id: 1, col: 0, row: 3 });
    expect(c.might).toBeGreaterThan(bare.might);
    expect(c.mods.speed).toBe(1);
  });
});

describe("properties in battle", () => {
  const scion = (mods: Record<string, number> = {}): Combatant => {
    const [u] = standardParty(1, 6, 1);
    return { ...u!, col: 0, row: 3, mods: { ...u!.mods, ...mods } };
  };
  const skeleton = (extra: Partial<Combatant> = {}) => ({ ...enemyCombatant("barrow_skeleton", { id: 9, level: 2, col: 0, row: 3 }), evasion: 0, ...extra });
  const hitFor = (u: Combatant, t: Combatant, seed = 5) => strike(newBattle(1, [u, t]), createRng(seed), u, t, ATTACK).damage;

  it("Bane, Giantslayer and Executioner's raise damage against the right foes", () => {
    const plain = hitFor(scion(), skeleton());
    expect(hitFor(scion({ "bane.undead": 50 }), skeleton())).toBeGreaterThan(plain);
    expect(hitFor(scion({ "bane.undead": 50 }), skeleton({ tags: [] }))).toBe(plain);
    expect(hitFor(scion({ giantPct: 30 }), skeleton({ size: [1, 2] }))).toBeGreaterThan(hitFor(scion(), skeleton({ size: [1, 2] })));
    const low = skeleton({ hp: 1 });
    expect(hitFor(scion({ executePct: 50 }), low)).toBeGreaterThan(hitFor(scion(), low));
  });

  it("an edge adds its element, unless the foe is immune to it", () => {
    const plain = hitFor(scion(), skeleton());
    expect(hitFor(scion({ "edge.fire": 40 }), skeleton())).toBeGreaterThan(plain);
    expect(hitFor(scion({ "edge.fire": 40 }), skeleton({ affinity: { fire: 100 } }))).toBe(plain);
  });

  it("Draining heals, Mana-thirst restores MP, Thorned hurts the attacker", () => {
    const u = scion({ drainPct: 20, mpPerHit: 3 });
    u.hp = 1;
    u.mp = 0;
    const t = skeleton();
    hitFor(u, t);
    expect(u.hp).toBeGreaterThan(1);
    expect(u.mp).toBe(3);
    const armored = { ...scion({ thornsPct: 50 }), evasion: 0 };
    const foe = skeleton({ accuracy: 500 });
    const before = foe.hp;
    strike(newBattle(1, [armored, foe]), createRng(2), foe, armored, ATTACK);
    expect(foe.hp).toBeLessThan(before);
  });

  it("Second Wind leaves a Scion at 1 HP once a battle", () => {
    const u = { ...scion({ secondWind: 1 }), hp: 1, evasion: 0 };
    const foe = skeleton({ accuracy: 500 });
    const b = newBattle(1, [u, foe]);
    strike(b, createRng(1), foe, u, ATTACK);
    expect([u.hp, u.down]).toEqual([1, false]);
    expect(u.flags).toContain("second_wind");
    strike(b, createRng(2), foe, u, ATTACK);
    expect(u.down).toBe(true);
  });

  it("Multi-hit strikes again; a curse forbids Defending", () => {
    const u = scion({ multiHit: 100, crit: -100 });
    const foe = skeleton({ hp: 9999, maxHp: 9999 });
    const b = newBattle(1, [u, foe]);
    resolve(b, createRng(4), u, ATTACK, { side: "enemy", col: 0, row: 3 }, foe.id);
    expect(b.events.filter((e) => e.t === "hit" && e.unit === u.id).length).toBe(2);
    const cursed = scion({ noDefend: 1 });
    const b2 = newBattle(1, [cursed, skeleton()]);
    b2.actor = cursed.id;
    act(b2, createRng(1), cursed, { do: "defend" });
    expect(cursed.defending).toBeFalsy();
  });
});
