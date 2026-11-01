// Scripted bosses (§10.10, §14.6): a boss is an enemy plus phases. Each phase is entered once, in order,
// when its condition holds: new gambits and Speed, adds onto E1–E3, a dispel of the party's buffs,
// Parts regrown, statuses on itself, or flight. The party deploys at CT 30; never an Ambush or Surprise.
import { BOSS_BY_ID, ENEMY_BY_ID, type BossAdds, type BossDef } from "../content.ts";
import { TUNING } from "../tuning.ts";
import { enemyCombatant, newBattle } from "./build.ts";
import { holds } from "./conditions.ts";
import { partsOf } from "./enemyparts.ts";
import { isFree } from "./grid.ts";
import { kill } from "./injury.ts";
import { addStatus, meta, removeStatus } from "./status.ts";
import { COLS, ROWS, type Battle, type Combatant } from "./types.ts";

const B = TUNING.enemies.bosses;

/** The boss def behind a combatant, if it is one. */
export const bossDef = (u: Combatant): BossDef | undefined => (u.enemy ? BOSS_BY_ID.get(u.enemy) : undefined);

/** The next free combatant id below the Parts' range (1000 and up). */
const nextId = (b: Battle) => Math.max(100, ...b.units.filter((u) => u.partOf === undefined).map((u) => u.id)) + 1;

/** Rows from the middle out, for placing adds. */
const MIDDLE_OUT = Array.from({ length: ROWS }, (_, r) => r).sort((x, y) => Math.abs(x + 0.5 - ROWS / 2) - Math.abs(y + 0.5 - ROWS / 2) || x - y);

/** Puts a boss's adds on the enemy grid: their column first, then the others, middle rows first. Those with no room do not come. */
export function spawnAdds(b: Battle, boss: Combatant, adds: BossAdds): Combatant[] {
  const col = Number(adds.at.slice(1)) - 1;
  const cols = [col, ...Array.from({ length: COLS }, (_, c) => c).filter((c) => c !== col)];
  const out: Combatant[] = [];
  for (let i = 0; i < (adds.count ?? adds.spawn.length); i++) {
    const def = ENEMY_BY_ID.get(adds.spawn[i % adds.spawn.length]!)!;
    const spot = cols.flatMap((c) => MIDDLE_OUT.map((r) => [c, r] as const)).find(([c, r]) => isFree(b, "enemy", c, r, def.size));
    if (!spot) break;
    const u = enemyCombatant(def, { id: nextId(b), level: boss.level, col: spot[0], row: spot[1] });
    if (!u.tags.includes("add")) u.tags.push("add");
    b.units.push(u, ...partsOf(u, def));
    out.push(u);
  }
  if (out.length) b.events.push({ t: "summon", unit: boss.id, summon: out[0]!.enemy!, ids: out.map((u) => u.id) });
  return out;
}

/** A boss fight: the party at CT 30, the boss at its level centered on the grid with its Parts and opening adds. */
export function bossBattle(seed: number, party: Combatant[], id: string, level: number): Battle {
  const def = BOSS_BY_ID.get(id);
  if (!def) throw new Error(`unknown boss ${id}`);
  const row = Math.floor((ROWS - def.size[1]) / 2);
  const boss = enemyCombatant(def, { id: 101, level, col: 0, row, ct: B.ct });
  boss.phase = 0;
  if (def.parts?.length) boss.mods.noMove = 1;
  for (const u of party) u.ct = B.ct;
  const b = newBattle(seed, [...party, boss, ...partsOf(boss, def)]);
  for (const adds of def.adds ?? []) for (const u of spawnAdds(b, boss, adds)) u.ct = B.ct;
  b.events.push({ t: "say", unit: boss.id, line: "open" });
  return b;
}

/** Enters every phase whose condition now holds, in order, for each living boss; and says the death line once. */
export function bossPhases(b: Battle): void {
  for (const u of b.units) {
    const def = bossDef(u);
    if (!def || u.phase === undefined || u.partOf !== undefined) continue;
    if (u.dead) {
      if (!u.flags.includes("said_death") && !u.flags.includes("fled")) {
        u.flags.push("said_death");
        b.events.push({ t: "say", unit: u.id, line: "death" });
      }
      continue;
    }
    while (u.phase < def.phases.length && !u.dead && holds(b, u, def.phases[u.phase]!.at)) enterPhase(b, u, def, u.phase++);
  }
}

function enterPhase(b: Battle, u: Combatant, def: BossDef, i: number): void {
  const p = def.phases[i]!;
  b.events.push({ t: "phase", unit: u.id, phase: i + 1 });
  b.events.push({ t: "say", unit: u.id, line: i + 1 });
  if (p.flee) {
    u.flags.push("fled");
    b.events.push({ t: "flee", unit: u.id });
    kill(b, u);
    return;
  }
  u.gambits = p.gambits;
  if (p.speed) u.speed = p.speed;
  // A new phase breaks off whatever the boss was charging.
  delete u.charge;
  if (p.dispel)
    for (const t of b.units.filter((x) => x.side !== u.side && !x.dead))
      for (const s of t.statuses.filter((x) => meta(x.id).kind === "buff" && !meta(x.id).fixed)) removeStatus(b, t, s.id);
  if (p.regrow)
    for (const part of b.units.filter((x) => x.partOf === u.id && x.dead)) {
      Object.assign(part, { dead: false, hp: part.maxHp, statuses: [] });
      u.lost = (u.lost ?? []).filter((a) => !part.disables?.includes(a));
    }
  for (const s of p.statuses ?? []) addStatus(b, u, s.id, s.ticks);
  if (p.adds) spawnAdds(b, u, p.adds);
}

/** A boss that fled the field (the fight is won, the boss lives on). */
export const fled = (u: Combatant): boolean => u.flags.includes("fled");
