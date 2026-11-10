// A Scion's own gambits (§6.11; Josh 2026-11-10: "should be a way to configure gambits per scion, that
// they use for auto rift battles etc"). Up to `TUNING.gambits.maxRules` rules in priority order, each a
// When, a Do and a Target from the menus here. Whenever the Scion fights by gambits (a Sortie, a turn
// or battle handed over, a gambits table, an absent player), their own rules come first; anything none
// of them covers, they fight as before: the satchel when someone needs it, their usual ways, then attack.
import type { GambitRule } from "./combat/types.ts";
import { battleActives } from "./progression.ts";
import type { SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";

/** When a rule fires: a condition `holds` reads (combat/conditions.ts), and its words. */
export const GAMBIT_WHEN: Readonly<Record<string, string>> = {
  always: "Always",
  "turn<1": "On their first turn",
  "ally.hp<0.5": "An ally is below half HP",
  "ally.hp<0.25": "An ally is near death",
  "ally.down": "An ally is down",
  "self.hp<0.5": "They are below half HP",
  "self.hp<0.3": "They are below 30% HP",
  "self.hp>0.8": "They are above 80% HP",
  "foe.charging": "A foe is winding up",
  "foe.marked": "A foe is Marked",
  "foes>=3": "Three or more foes stand",
  "foes<=1": "One foe is left",
};

/** Whom a rule aims at (combat/gambits.ts `choose`); none means the usual: the weakest foe, the most hurt ally. */
export const GAMBIT_TARGETS: Readonly<Record<string, string>> = {
  lowest_hp: "The weakest",
  nearest: "The nearest",
  highest_might: "The strongest",
  marked: "The Marked",
  charging: "Whoever is winding up",
  lowest_durability: "The most battered",
  densest_cluster: "The thickest crowd",
  ally_lowest_hp: "The most hurt ally",
  ally_down: "An ally who is down",
  random: "Anyone",
};

/** What a rule does besides the Scion's own abilities. */
export const GAMBIT_ACTS: Readonly<Record<string, string>> = { attack: "Attack", defend: "Defend", wait: "Wait" };

export interface GambitsMove {
  person: number;
  rules: GambitRule[];
}

const isRule = (r: unknown): r is GambitRule =>
  !!r && typeof r === "object" && typeof (r as GambitRule).do === "string" && ["string", "undefined"].includes(typeof (r as GambitRule).if) && ["string", "undefined"].includes(typeof (r as GambitRule).target);

/** Why `house` cannot give that Scion those rules, or null. */
export function cannotSetGambits(s: SovState, house: number, m: GambitsMove): string | null {
  const p = s.people.find((x) => x.id === m.person);
  if (!p || p.host !== house || (p.status !== "scion" && p.status !== "retired")) return "Only your own Scions take gambits from you.";
  if (!Array.isArray(m.rules) || !m.rules.every(isRule)) return "Those are not gambits.";
  if (m.rules.length > TUNING.gambits.maxRules) return `A Scion keeps at most ${TUNING.gambits.maxRules} gambits.`;
  const can = new Set([...Object.keys(GAMBIT_ACTS), ...battleActives(p).map((a) => a.id)]);
  for (const r of m.rules) {
    if (r.if !== undefined && !(r.if in GAMBIT_WHEN)) return "Choose when it is done from the list.";
    if (!can.has(r.do)) return `${p.name} cannot do that in battle.`;
    if (r.target !== undefined && !(r.target in GAMBIT_TARGETS)) return "Choose whom it aims at from the list.";
  }
  return null;
}

/** Gives the Scion those rules; none clears them, and they fight their usual way. */
export function setGambits(s: SovState, m: GambitsMove): void {
  const p = s.people.find((x) => x.id === m.person)!;
  const rules = m.rules.map((r): GambitRule => ({ ...(r.if && r.if !== "always" ? { if: r.if } : {}), do: r.do, ...(r.target ? { target: r.target } : {}) }));
  if (rules.length) p.gambits = rules;
  else delete p.gambits;
}

