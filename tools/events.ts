// The expedition event pool against its budget and lints (HANDOFF §6):
//   npm run events
// It prints how many events each pool has (≥ 150 general, ≥ 25 for each specific pool), how often each
// option tag is offered, the share of outcome weight that can maim (≤ 2%), and how often each subject
// rule is used (every rule at least 5 times). It is a report: the budget is still being filled.
import { INJURY_TABLE_BY_ID, POOLS, TRIP_EVENTS } from "../src/shared/games/sovereign-pact/content.ts";

const BUDGET = { general: 150, pool: 25 };
const MAIM_MAX = 2;
const RULE_MIN = 5;

// Pools of their own beside the twelve regions: card types and the arc's own events.
const special = new Set(["idol", "reflection", "mandatory"]);
const count = new Map<string, number>();
for (const e of TRIP_EVENTS) for (const p of e.pools) count.set(p, (count.get(p) ?? 0) + 1);

console.log(`${TRIP_EVENTS.length} expedition events\n\nBy pool (budget ${BUDGET.general} general, ${BUDGET.pool} for each other pool):`);
const pools = ["general", ...POOLS.map((p) => p.id), ...[...count.keys()].filter((k) => k !== "general" && !POOLS.some((p) => p.id === k)).sort()];
for (const p of pools) {
  const n = count.get(p) ?? 0;
  const want = p === "general" ? BUDGET.general : special.has(p) ? 0 : BUDGET.pool;
  console.log(`  ${p.padEnd(16)} ${String(n).padStart(4)}${want ? ` / ${want}${n >= want ? "  ok" : ""}` : ""}`);
}

// A d20 injury roll maims on a devastating result; the chance is the table's share of the d20.
const maimChance = (table: string): number => {
  const t = INJURY_TABLE_BY_ID.get(table as never);
  if (!t) return 0;
  let prev = 0;
  let maim = 0;
  for (const r of t.results) {
    const hi = Math.min(20, r.max);
    if (r.band === "devastating") maim += Math.max(0, hi - prev);
    prev = Math.max(prev, hi);
  }
  return maim / 20;
};

const tags = new Map<string, number>();
const rules = new Map<string, number>();
let options = 0;
let maim = 0;
for (const e of TRIP_EVENTS) {
  for (const o of e.options) {
    options++;
    for (const t of o.tags ?? []) tags.set(t, (tags.get(t) ?? 0) + 1);
    for (const r of o.rule.split("|")) rules.set(r, (rules.get(r) ?? 0) + 1);
    const total = o.outcomes.reduce((n, x) => n + x.w, 0) || 1;
    for (const x of o.outcomes) {
      const chance = Math.max(0, ...x.effects.map((f) => (f.injury ? maimChance(f.injury) : 0)));
      maim += (x.w / total) * chance;
    }
  }
}

console.log("\nOption tags:");
for (const [t, n] of [...tags].sort((a, b) => b[1] - a[1])) console.log(`  ${t.padEnd(16)} ${String(n).padStart(4)}`);

const share = (100 * maim) / options;
console.log(`\nMaiming: ${share.toFixed(2)}% of outcome weight (budget ≤ ${MAIM_MAX}%)${share <= MAIM_MAX ? "  ok" : "  OVER"}`);

console.log(`\nSubject rules (each at least ${RULE_MIN} times):`);
for (const [r, n] of [...rules].sort((a, b) => b[1] - a[1])) console.log(`  ${r.padEnd(40)} ${String(n).padStart(4)}${n < RULE_MIN ? "  few" : ""}`);
