// The Alterer's Forms (§12.2, §12.17): a Shift swaps the Scion's abilities (and size, HP, Guard) for
// the Form's, its mods ride on a status, and Revert puts everything back with the Form's price.
import type { Rng } from "../../../rng.ts";
import { FORM_BY_ID, type FormDef } from "../content.ts";
import { TUNING } from "../tuning.ts";
import { isFree } from "./grid.ts";
import { addStatus, extraOf, removeStatus } from "./status.ts";
import type { AbilityDef, Battle, Combatant } from "./types.ts";

const statusId = (form: string) => `form_${form}`;

/** Where a Form that changes size would stand: the same cell if it fits, else one row up. */
function roomFor(b: Battle, u: Combatant, def: FormDef): number | undefined {
  const size = def.size ?? u.size;
  if (isFree(b, u.side, u.col, u.row, size, u.id)) return u.row;
  if (u.row > 0 && isFree(b, u.side, u.col, u.row - 1, size, u.id)) return u.row - 1;
  return undefined;
}

/** Whether `u` has room to take the Form (large Forms need a second cell). */
export const canShift = (b: Battle, u: Combatant, id: string): boolean => roomFor(b, u, FORM_BY_ID.get(id)!) !== undefined;

/** Abilities the Alterer keeps in any Form: Revert, Graft, Molt and the other Shifts. */
const tools = (abilities: AbilityDef[]) => abilities.filter((a) => a.form || a.revert || a.graft || a.id === "molt");

/** Shifts `u` into Form `id`, reverting any Form it is in first (§12.17). */
export function shift(b: Battle, u: Combatant, id: string): void {
  const def = FORM_BY_ID.get(id);
  if (!def) throw new Error(`unknown form ${id}`);
  if (u.form) revert(b, u);
  const row = roomFor(b, u, def);
  if (row === undefined) throw new Error("no room for the Form");
  u.form = { id, ends: b.tick + def.ticks + (u.mods.formTicks ?? 0), abilities: u.abilities, size: u.size, maxHp: u.maxHp, guard: u.guard };
  u.abilities = [...def.abilities, ...tools(u.abilities)];
  u.row = row;
  if (def.size) u.size = [...def.size];
  if (def.hpMult) {
    u.maxHp = Math.max(1, Math.round(u.maxHp * def.hpMult));
    u.hp = Math.min(u.hp, u.maxHp);
  }
  if (def.guard !== undefined) u.guard = Math.max(u.guard, def.guard);
  addStatus(b, u, statusId(id), 0, { mods: { ...def.mods } });
  for (const s of def.start ?? []) addStatus(b, u, s, 0, { src: u.id });
  b.events.push({ t: "shift", unit: u.id, form: id });
}

/** Ends the Form: the Scion's own abilities, size, HP cap and Guard come back, and the Revert price is paid (halved by Stable Flesh). */
export function revert(b: Battle, u: Combatant): void {
  const f = u.form;
  if (!f) return;
  const def = FORM_BY_ID.get(f.id)!;
  delete u.form;
  delete u.feral;
  u.abilities = f.abilities;
  u.size = f.size;
  u.maxHp = f.maxHp;
  u.guard = f.guard;
  removeStatus(b, u, statusId(f.id));
  for (const s of def.start ?? []) if (u.statuses.some((x) => x.id === s && x.src === u.id)) removeStatus(b, u, s);
  b.events.push({ t: "shift", unit: u.id, form: null });
  if (u.dead) return;
  const half = u.mods.stableFlesh ? 0.5 : 1;
  const r = def.revert;
  for (const s of r?.statuses ?? []) {
    const mods = s.mods && Object.fromEntries(Object.entries(s.mods).map(([k, v]) => [k, Math.round(v * half)]));
    addStatus(b, u, s.id, Math.round(s.ticks * half), extraOf(undefined, mods));
  }
  // Hybrid (§12.17): the Form's passive lingers a while.
  if (u.mods.hybrid && def.graft) addStatus(b, u, "graft", TUNING.combat.jobs.hybridTicks, { mods: { ...def.graft } });
  if (r?.sanityPct && u.maxSanity) u.sanity = Math.max(0, u.sanity + Math.round((u.maxSanity * r.sanityPct * half) / 100));
  if (r?.durability && u.dur && u.maxDur) {
    const { loc, pct } = r.durability;
    u.dur[loc] = Math.max(0, u.dur[loc] - Math.round((u.maxDur[loc] * pct * half) / 100));
  }
}

/** A feral Form chooses this turn's ability, unless Wild Blood lets the Alterer choose (§12.17). */
export function feralPick(rng: Rng, u: Combatant, usable: (ab: AbilityDef) => boolean): void {
  delete u.feral;
  if (!u.form || FORM_BY_ID.get(u.form.id)!.control !== "feral") return;
  if (u.mods.wildBlood && rng.int(100) < u.mods.wildBlood) return;
  const own = FORM_BY_ID.get(u.form.id)!.abilities.filter((a) => usable(u.abilities.find((x) => x.id === a.id)!));
  if (own.length) u.feral = rng.pick(own).id;
}

/** Graft: the Form's passive on an ally for 200 ticks. */
export function graft(b: Battle, u: Combatant, t: Combatant, ticks: number): void {
  const mods = u.form && FORM_BY_ID.get(u.form.id)!.graft;
  if (mods && !t.dead) addStatus(b, t, "graft", ticks, { mods: { ...mods } });
}
