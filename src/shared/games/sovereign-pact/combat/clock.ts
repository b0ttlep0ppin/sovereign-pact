// The clock (§10.4): every step each combatant gains CT equal to its Speed; at 100 it takes a turn.
// Durations, charges and damage-over-time count ticks, 10 to a step (DECISIONS 2026-11-01, M1).
import type { Rng } from "../../../rng.ts";
import { TUNING } from "../tuning.ts";
import { mend } from "./damage.ts";
import { revert } from "./forms.ts";
import { hazardStep } from "./hazards.ts";
import { vanish } from "./summons.ts";
import { hasStatus } from "./grid.ts";
import { down, injure, kill, steel } from "./injury.ts";
import { addStatus, frozenClock, meta, removeStatus, speedOf, statusValue, tickStatuses } from "./status.ts";
import type { Battle, Combatant } from "./types.ts";

const C = TUNING.combat;

/** Combatants the clock moves: on the field and not Down. */
const ticking = (b: Battle) => b.units.filter((u) => !u.dead && !u.down);

/** One clock step: CT, statuses, damage-over-time pulses, charges counting down. Returns the chargers that are ready. */
export function step(b: Battle, rng: Rng): Combatant[] {
  b.tick += C.ticksPerStep;
  const pulse = b.tick % C.pulse === 0;
  const ready: Combatant[] = [];
  for (const u of ticking(b)) {
    // A timed summon leaves when its time is up (§12.15).
    if (u.expires !== undefined && b.tick >= u.expires) {
      vanish(b, u);
      continue;
    }
    // A Form ends when its time is up (§12.17).
    if (u.form && b.tick >= u.form.ends) revert(b, u);
    if (!frozenClock(u)) u.ct += speedOf(u);
    if (u.charge) {
      // A charger holds at 100 until the ability resolves (§10.5).
      u.ct = Math.min(u.ct, C.turnAt);
      if (!frozenClock(u)) u.charge.ticks -= C.ticksPerStep;
      if (u.charge.ticks <= 0) ready.push(u);
    }
    if (pulse) pulseOf(b, rng, u);
    // Meditation, Wellspring, Mana Font: MP per 100 ticks.
    if (b.tick % C.regenEvery === 0) per100(b, u);
    if (!u.dead) tickStatuses(b, u);
  }
  hazardStep(b, rng);
  return ready;
}

const pctOf = (n: number, p: number) => Math.max(1, Math.round((n * p) / 100));

/** Every 100 ticks: Meditation, Wellspring, Mana Font; Cleansing Air and Plague Chant. */
function per100(b: Battle, u: Combatant): void {
  if (u.mods.mpPer100) u.mp = Math.min(u.maxMp, u.mp + u.mods.mpPer100);
  // The Marsh Lantern: Sanity to the allies beside it.
  if (u.mods.sanityAura)
    for (const o of b.units)
      if (o.side === u.side && o.id !== u.id && !o.dead && o.maxSanity && Math.abs(o.col - u.col) + Math.abs(o.row - u.row) === 1)
        o.sanity = Math.min(o.maxSanity, o.sanity + pctOf(o.maxSanity, u.mods.sanityAura));
  // Focus (Sword Saint, §12.3).
  if (u.mods.tpPer100 && !u.down) u.tp = Math.min(C.tp.max, u.tp + u.mods.tpPer100);
  if (u.mods.cleansePer100) {
    const ail = u.statuses.find((s) => meta(s.id).kind === "physical");
    if (ail) removeStatus(b, u, ail.id);
  }
  if (u.mods.poisonPer100 && !hasStatus(u, "poison")) addStatus(b, u, "poison");
}

/** Every 50 ticks: Poison, Bleed, Burn hurt; Regen, MP Regen, TP Regen restore (§10.8). */
function pulseOf(b: Battle, rng: Rng, u: Combatant): void {
  let hurt = 0;
  if (hasStatus(u, "poison")) hurt += pctOf(u.maxHp, C.poison);
  if (hasStatus(u, "burn")) hurt += statusValue(u, "burn") ?? pctOf(u.maxHp, C.burn);
  const bleed = u.statuses.find((s) => s.id === "bleed");
  if (bleed) {
    hurt += pctOf(u.maxHp, C.bleed);
    if (bleed.loc && u.dur) u.dur[bleed.loc] = Math.max(0, u.dur[bleed.loc] - C.bleedDurability);
  }
  if (hasStatus(u, "regen")) mend(b, u, u.id, pctOf(u.maxHp, C.regen));
  if (hasStatus(u, "mp_regen")) u.mp = Math.min(u.maxMp, u.mp + 2);
  if (hasStatus(u, "tp_regen")) u.tp = Math.min(C.tp.max, u.tp + 5);
  // Chorus songs (§12.11): Hearthsong, Fountain, Drumbeat.
  if (u.mods.regenPct) mend(b, u, u.id, pctOf(u.maxHp, u.mods.regenPct));
  if (u.mods.mpPerPulse) u.mp = Math.min(u.maxMp, u.mp + u.mods.mpPerPulse);
  if (u.mods.tpPerPulse) u.tp = Math.min(C.tp.max, u.tp + u.mods.tpPerPulse);
  if (!hurt) return;
  u.hp = Math.max(0, u.hp - hurt);
  b.events.push({ t: "hit", unit: u.id, target: u.id, damage: hurt });
  if (u.hp > 0) return;
  if (u.side === "enemy") return kill(b, u);
  if (u.lastStand) return down(b, u);
  // Bleeding out: the roll lands on the bleeding location, or the Body (§7.4).
  const loc = bleed?.loc ?? "body";
  down(b, u);
  if (!u.dead) {
    injure(b, rng, u, loc, C.injury.hpZero);
    if (!u.dead) steel(b, rng, u, loc);
  }
}

/**
 * Who acts next among those at CT ≥ 100 and not charging: highest CT, then highest Speed, then seeded
 * random (§10.4). Undefined if nobody is ready.
 */
export function nextActor(b: Battle, rng: Rng): Combatant | undefined {
  // Parts take no turns of their own (§14.1).
  const ready = ticking(b).filter((u) => u.ct >= C.turnAt && !u.charge && u.partOf === undefined && u.hazard === undefined);
  if (!ready.length) return undefined;
  const top = Math.max(...ready.map((u) => u.ct));
  const atTop = ready.filter((u) => u.ct === top);
  const fastest = Math.max(...atTop.map(speedOf));
  const tied = atTop.filter((u) => speedOf(u) === fastest);
  return tied.length === 1 ? tied[0] : rng.pick(tied);
}

/** Charge time in ticks: base × 100 / (100 + Acuity), with lasting mods (§7.3). */
export const chargeTicks = (u: Combatant, base: number): number =>
  Math.max(C.ticksPerStep, Math.round(((base * 100) / (100 + u.acuity)) * (1 + (u.mods.chargePct ?? 0) / 100)));

/** Move cost in CT for `cells` cells: 20 each, −1 per 5 Guile, at least 10 (§7.3). */
export function moveCost(u: Combatant, cells: number): number {
  const m = C.move;
  const per = Math.max(m.min, m.perCell - Math.floor(u.guile / m.guilePer) + (u.mods.moveCostPerCell ?? 0));
  return Math.round(per * cells * (1 + (u.mods.moveCostPct ?? 0) / 100));
}

/**
 * The turn forecast (§10.4): the next `n` turns simulated from current CT and Speed with no statuses
 * changing; charges appear as their own entries (`charge: true`).
 */
export function forecast(b: Battle, n = 10): { unit: number; charge?: boolean }[] {
  const sim = ticking(b).map((u) => ({ id: u.id, ct: u.ct, speed: speedOf(u), frozen: frozenClock(u), charge: u.charge?.ticks }));
  const out: { unit: number; charge?: boolean }[] = [];
  for (let guard = 0; out.length < n && guard < 10_000; guard++) {
    for (const s of sim) {
      if (!s.frozen) s.ct += s.speed;
      if (s.charge !== undefined) {
        s.ct = Math.min(s.ct, C.turnAt);
        s.charge -= C.ticksPerStep;
        if (s.charge <= 0) {
          out.push({ unit: s.id, charge: true });
          s.charge = undefined;
        }
      }
    }
    for (;;) {
      const ready = sim.filter((s) => s.ct >= C.turnAt && s.charge === undefined).sort((x, y) => y.ct - x.ct || y.speed - x.speed);
      if (!ready.length || out.length >= n) break;
      out.push({ unit: ready[0]!.id });
      ready[0]!.ct -= C.cost.action;
    }
  }
  return out.slice(0, n);
}
