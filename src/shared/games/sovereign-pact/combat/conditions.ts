// Gambit and boss-phase conditions (§6.11, §10.11, §14.6): the `if` of a gambit rule and the `at` of a
// boss phase, read from the battle as it stands. Joined by `&&` all must hold, by `||` any (`&&` binds tighter); `!` negates one.
import { fallen } from "./summons.ts";
import { hasStatus, other, standing } from "./grid.ts";
import { allegiance } from "./targets.ts";
import type { Battle, Combatant } from "./types.ts";

const frac = (u: Combatant) => (u.maxHp ? u.hp / u.maxHp : 1);
const allies = (b: Battle, u: Combatant) => standing(b, allegiance(u)).filter((x) => x.id !== u.id && x.partOf === undefined && x.hazard === undefined);
const foes = (b: Battle, u: Combatant) => standing(b, other(allegiance(u)));
const OPS: Record<string, (a: number, b: number) => boolean> = {
  "<": (a, b) => a < b,
  "<=": (a, b) => a <= b,
  ">": (a, b) => a > b,
  ">=": (a, b) => a >= b,
  "==": (a, b) => a === b,
};

/** Whether a gambit's condition holds for `u` now. Unknown conditions are false. */
export function holds(b: Battle, u: Combatant, cond: string | undefined): boolean {
  if (!cond || cond === "always") return true;
  const any = cond.replace(/\s+/g, "").split("||");
  if (any.length > 1) return any.some((c) => holds(b, u, c));
  const all = any[0]!.split("&&");
  if (all.length > 1) return all.every((c) => holds(b, u, c));
  if (all[0]!.startsWith("!")) return !holds(b, u, all[0]!.slice(1));
  const c = all[0]!;
  // A status on itself: `self.rooted`, `!self.hidden`.
  let m = /^self\.([a-z_]+)$/.exec(c);
  if (m && !["hp", "sanity", "mp", "tp"].includes(m[1]!)) return hasStatus(u, m[1]!);
  m = /^turn%(\d+)==(\d+)$/.exec(c);
  if (m) return u.turns % Number(m[1]) === Number(m[2]);
  m = /^(turn|adds|foes|allies|swarm|fallen|parts)(<=|>=|<|>|==)(\d+)$/.exec(c);
  if (m) {
    const n = {
      turn: u.turns,
      adds: allies(b, u).length,
      allies: allies(b, u).length,
      foes: foes(b, u).length,
      // Living swarm on its side, itself included (the overrun, §14.3), and fallen kin a raise could lift.
      swarm: standing(b, allegiance(u)).filter((x) => x.role === "swarm").length,
      fallen: fallen(b, u).length,
      // Its own living Parts (§14.1).
      parts: b.units.filter((x) => x.partOf === u.id && !x.dead).length,
    }[m[1] as "turn"];
    return OPS[m[2]!]!(n, Number(m[3]));
  }
  m = /^(?:(self|ally|foe|enemy)\.)?(hp|sanity|mp|tp)(<=|>=|<|>)([\d.]+)$/.exec(c);
  if (m) {
    const who = m[1] ?? "self";
    const value = (x: Combatant) => (m![2] === "hp" ? frac(x) : m![2] === "sanity" ? x.sanity / (x.maxSanity || 1) : m![2] === "mp" ? x.mp : x.tp);
    // "ally" includes the combatant itself, as in Sortie gambits.
    const pool = who === "self" ? [u] : who === "ally" ? standing(b, allegiance(u)) : foes(b, u);
    return pool.some((x) => OPS[m![3]!]!(value(x), Number(m![4])));
  }
  m = /^(ally|foe|enemy)\.(marked|charging|down|telegraphing)$/.exec(c);
  if (m) {
    const side = m[1] === "ally" ? allegiance(u) : other(allegiance(u));
    const pool = b.units.filter((x) => !x.dead && x.side === side && x.id !== u.id);
    if (m[2] === "down") return pool.some((x) => x.down);
    if (m[2] === "marked") return pool.some((x) => !x.down && hasStatus(x, "marked"));
    return pool.some((x) => !!x.charge && (m![2] === "charging" || x.charge.ability.telegraph));
  }
  return false;
}

