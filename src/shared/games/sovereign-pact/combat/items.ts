// Consumables in battle (§13.7): any Scion may use one from the party satchel as its action, for 100 CT
// (60 under Quick Hands). Each one acts as an ability built from its content; healing rises with Herb
// Lore and the Herbalists. Bots reach for the satchel when someone is Down, badly hurt or afflicted,
// a caster runs dry, or the foes bunch up for a bomb.
import { ACTIVE_BY_ID, CONSUMABLE_BY_ID } from "../content.ts";
import { TUNING } from "../tuning.ts";
import type { Action } from "./battle.ts";
import { hasStatus, standing } from "./grid.ts";
import { meta } from "./status.ts";
import { bestCell, cellOf, singleTargets } from "./targets.ts";
import type { AbilityDef, Battle, Combatant } from "./types.ts";

const C = TUNING.combat;
const B = TUNING.consumables.bots;

/** The ability a consumable acts as when `u` uses it, or undefined if it has no battle effect of its own. */
export function itemAbility(u: Combatant, id: string): AbilityDef | undefined {
  const def = CONSUMABLE_BY_ID.get(id);
  // A Scroll casts its spell at once, from the reader's own stats, for no MP.
  const spell = def?.battle?.cast ? ACTIVE_BY_ID.get(def.battle.cast) : undefined;
  if (spell) {
    return { ...spell, mp: 0, charge: 0, id: `item:${id}`, name: def!.name, cost: u.mods.itemCt ?? C.cost.action };
  }
  if (!def?.battle) return undefined;
  const more = u.mods.itemHealPct ?? 0;
  const r = def.battle.restore;
  const restore = r && more ? { ...r, ...(r.hpPct ? { hpPct: Math.round(r.hpPct * (1 + more / 100)) } : {}), ...(r.durPct ? { durPct: Math.round(r.durPct * (1 + more / 100)) } : {}) } : r;
  return { ...def.battle, ...(restore ? { restore } : {}), id: `item:${id}`, name: def.name, cost: u.mods.itemCt ?? C.cost.action };
}

/** Whether `u` may use consumable `id` now: a Scion, with it in the satchel. */
export function cannotUseItem(b: Battle, u: Combatant, id: string): string | null {
  if (u.side !== "party" || u.person === undefined) return "Only a Scion reaches into the satchel.";
  if (!b.satchel?.includes(id)) return "The satchel holds none.";
  return itemAbility(u, id) ? null : "That is not used in battle.";
}

/** Takes one `id` out of the satchel, for the expedition to remember. */
export function spendItem(b: Battle, id: string): void {
  b.satchel!.splice(b.satchel!.indexOf(id), 1);
  (b.used ??= []).push(id);
}

const frac = (u: Combatant) => (u.maxHp ? u.hp / u.maxHp : 1);
const durFrac = (u: Combatant) => Math.min(1, ...Object.entries(u.dur ?? {}).map(([k, v]) => v / ((u.maxDur as Record<string, number> | undefined)?.[k] || 1)));
const afflicted = (u: Combatant, kind: "physical" | "mental") => u.statuses.some((s) => meta(s.id).kind === kind && !meta(s.id).fixed);

/** A bot's use of the satchel, or undefined when nothing calls for it. */
export function itemPlan(b: Battle, u: Combatant): Action | undefined {
  if (!b.satchel?.length || cannotUseItem(b, u, b.satchel[0]!) === "Only a Scion reaches into the satchel.") return undefined;
  const has = (id: string) => b.satchel!.includes(id) && !!itemAbility(u, id);
  const scions = b.units.filter((x) => x.side === "party" && x.person !== undefined && !x.dead && !x.catatonic);
  const on = (id: string, t: Combatant | undefined): Action | undefined => {
    if (!t) return undefined;
    const ab = itemAbility(u, id)!;
    return singleTargets(b, u, ab).some((x) => x.id === t.id) ? { do: "item", item: id, target: cellOf(t) } : undefined;
  };
  const first = (ids: readonly string[]) => ids.find(has);
  // Up the fallen, then the badly hurt, then the afflicted.
  const salts = first(["smelling_salts"]);
  if (salts) {
    const plan = on(salts, scions.find((x) => x.down));
    if (plan) return plan;
  }
  const up = scions.filter((x) => !x.down);
  const hurt = [...up].sort((x, y) => frac(x) - frac(y) || x.id - y.id)[0];
  const tonic = first(["tonic", "strong_tonic", "vital_draught"]);
  if (tonic && hurt && frac(hurt) < B.hpBelow) {
    const plan = on(tonic, hurt);
    if (plan) return plan;
  }
  const clarity = first(["clarity_draught"]);
  if (clarity) {
    const plan = on(clarity, up.find((x) => afflicted(x, "mental")));
    if (plan) return plan;
  }
  const antidote = first(["antidote"]);
  if (antidote) {
    const plan = on(antidote, up.find((x) => hasStatus(x, "poison") || hasStatus(x, "burn") || hasStatus(x, "blind") || hasStatus(x, "disease")));
    if (plan) return plan;
  }
  const salve = first(["bone_salve", "whole_salve"]);
  if (salve) {
    const plan = on(salve, up.find((x) => x.dur && durFrac(x) < B.durBelow));
    if (plan) return plan;
  }
  const ether = first(["ether", "mana_crystal"]);
  if (ether && u.maxMp && u.mp / u.maxMp < B.mpBelow && u.abilities.some((a) => a.mp)) {
    const plan = on(ether, u);
    if (plan) return plan;
  }
  const bomb = first(["firebomb", "frost_flask", "shock_jar"]);
  if (bomb && standing(b, "enemy").length >= B.bombFoes) return { do: "item", item: bomb, target: bestCell(b, u, itemAbility(u, bomb)!, "enemy") };
  // Dust for the dead and the made, when enough of them stand; Oathwine once, when the field is full.
  const foes = standing(b, "enemy");
  for (const [dust, tags] of [["grave_dust", ["undead"]], ["hollow_ivory_dust", ["undead", "construct"]]] as const)
    if (has(dust) && foes.filter((x) => tags.some((t) => x.tags.includes(t))).length >= B.dustFoes) return { do: "item", item: dust, target: bestCell(b, u, itemAbility(u, dust)!, "enemy") };
  if (has("oathwine") && foes.length >= B.bombFoes && !scions.some((x) => x.house === u.house && hasStatus(x, "oathbound"))) return { do: "item", item: "oathwine", target: cellOf(u) };
  return undefined;
}
