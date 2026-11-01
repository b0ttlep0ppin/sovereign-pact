// The text renderer (HANDOFF §4, Milestone 1): the two grids and a battle log as plain text, for the
// simulator, tests and debugging before the battle screen exists.
import { INJURY_BY_ID } from "../content.ts";
import { covers } from "./grid.ts";
import { COLS, ROWS, type Battle, type BattleEvent, type Combatant } from "./types.ts";

const tag = (u: Combatant) => `${u.side === "party" ? "P" : "E"}${u.id}`;

/** One cell's label: who stands there, or a dot. */
function cell(b: Battle, side: Combatant["side"], col: number, row: number): string {
  const u = b.units.find((x) => !x.dead && covers(x, { side, col, row }));
  if (!u) return "  · ";
  const mark = u.down ? "_" : u.charge ? "*" : " ";
  return `${tag(u).padStart(3)}${mark}`;
}

/** Enemy E3 E2 E1 on the left, the party's F M B on the right (§10.1). */
export function renderGrid(b: Battle): string {
  const lines = ["   E3  E2  E1        F   M   B"];
  for (let row = 0; row < ROWS; row++) {
    const enemy = [2, 1, 0].map((col) => cell(b, "enemy", col, row)).join("");
    const party = Array.from({ length: COLS }, (_, col) => cell(b, "party", col, row)).join("");
    lines.push(`${row + 1} ${enemy}   ${party}`);
  }
  return lines.join("\n");
}

/** A status line per combatant: HP, MP, TP, Sanity, Durability, CT and statuses. */
export function renderUnits(b: Battle): string {
  return b.units
    .map((u) => {
      const state = u.dead ? " DEAD" : u.down ? " DOWN" : u.lastStand ? " LAST STAND" : "";
      const dur = u.dur ? ` dur ${(["head", "body", "arms", "legs"] as const).map((l) => (u.broken.includes(l) ? "X" : u.dur![l])).join("/")}` : "";
      const san = u.maxSanity ? ` san ${u.sanity}/${u.maxSanity}` : "";
      const st = u.statuses.length ? ` [${u.statuses.map((s) => s.id).join(",")}]` : "";
      return `${tag(u)} ${u.name.padEnd(16)} hp ${u.hp}/${u.maxHp} tp ${u.tp}${san}${dur} ct ${u.ct}${st}${state}`;
    })
    .join("\n");
}

/** One event as a log line. */
export function describeEvent(b: Battle, e: BattleEvent): string {
  const n = (id: number) => {
    const u = b.units.find((x) => x.id === id);
    return u ? `${u.name} (${tag(u)})` : `#${id}`;
  };
  switch (e.t) {
    case "turn":
      return `— ${n(e.unit)}'s turn at tick ${e.tick}`;
    case "move":
      return `${n(e.unit)} moves to ${"FMB"[e.col]}${e.row + 1}`;
    case "use":
      return `${n(e.unit)} uses ${e.ability}`;
    case "charge":
      return `${n(e.unit)} begins ${e.ability} (${e.ticks} ticks${e.telegraph ? ", telegraphed" : ""})`;
    case "cancel":
      return `${n(e.unit)}'s ${e.ability} is cancelled`;
    case "miss":
      return `${n(e.unit)} misses ${n(e.target)}`;
    case "hit":
      if (e.unit === e.target && !e.loc) return `${n(e.target)} suffers ${e.damage}`;
      return `${n(e.unit)} hits ${n(e.target)} for ${e.damage}${e.loc ? ` (${e.loc})` : ""}${e.crit ? " CRIT" : ""}${e.weak ? " weak point" : ""}`;
    case "heal":
      return `${n(e.unit)} heals ${n(e.target)} for ${e.amount}`;
    case "sanity":
      return `${n(e.target)} loses ${e.amount} Sanity`;
    case "status":
      return `${n(e.target)} ${e.on ? "is" : "is no longer"} ${e.status}`;
    case "injury":
      return `${n(e.target)} rolls ${e.roll} (total ${e.total}) on ${e.table}: ${INJURY_BY_ID.get(e.result)?.name ?? e.result}`;
    case "steeled":
      return `${n(e.target)} steels themselves (${e.loc})`;
    case "down":
      return `${n(e.target)} is Down`;
    case "dead":
      return `${n(e.target)} dies`;
    case "lots":
      return `${n(e.unit)} rolls ${e.total}`;
    case "fizzle":
      return `${n(e.unit)} doubles down, rolls ${e.total} and fizzles`;
    case "reflect":
      return `${n(e.unit)}'s Reflect turns the spell back on ${n(e.target)}`;
    case "counterspell":
      return `${n(e.unit)} counters ${n(e.target)}'s spell`;
    case "summon":
      return `${n(e.unit)} calls ${e.ids.map(n).join(" and ")}`;
    case "vanish":
      return `${n(e.unit)} leaves the field`;
    case "shift":
      return e.form ? `${n(e.unit)} shifts into ${e.form}` : `${n(e.unit)} reverts`;
    case "wait":
      return `${n(e.unit)} waits`;
    case "defend":
      return `${n(e.unit)} defends`;
    case "end":
      return `Battle over: ${e.outcome}`;
  }
}

export const renderLog = (b: Battle, from = 0): string => b.events.slice(from).map((e) => describeEvent(b, e)).join("\n");
