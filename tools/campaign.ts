// Whole bot campaigns from the command line (HANDOFF §7, the level-curve tuning pass):
//   npm run sim:campaign -- [--houses H] [--runs N] [--seed S] [--short] [--each]
// Bots play every seat from Year 1 to the end. It prints how the campaigns ended, how expeditions
// went (triumph, wiped, turned back; mandatory ones apart), and the best four Scions' average level
// by Year, the number the 3L reference (§14.2) is measured against. --each prints every expedition.
import { sovereignPact as g, type SovState } from "../src/shared/games/sovereign-pact/index.ts";
import { campaign } from "../src/shared/games/sovereign-pact/testing.ts";
import { TUNING } from "../src/shared/games/sovereign-pact/tuning.ts";

const args = process.argv.slice(2);
const opt = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const houses = opt("houses", 2);
const runs = opt("runs", 6);
const first = opt("seed", 1);
const each = args.includes("--each");
// The state keeps only the last lines of the log; the simulator reads every line.
(TUNING as { logLines: number }).logLines = Number.MAX_SAFE_INTEGER;

const RESULT = /returns in triumph|falls before the boss|falls before an encounter|expedition turns back|party is overrun/;
const levels: Record<number, number[]> = {};
const ends: Record<string, number> = {};
const tally = { all: { triumph: 0, wiped: 0, back: 0 }, mandatory: { triumph: 0, wiped: 0, back: 0 } };

const best4 = (s: SovState): number => {
  const top = s.people.filter((p) => p.status === "scion").map((p) => p.level).sort((a, b) => b - a).slice(0, 4);
  return top.length ? top.reduce((a, b) => a + b, 0) / top.length : 0;
};

for (let seed = first; seed < first + runs; seed++) {
  let s = campaign(houses, seed, args.includes("--short") ? { length: "short" } : undefined);
  let year = 0;
  let read = 0;
  let card: { mandatory: boolean; line: string } | undefined;
  for (let i = 0; i < 100_000 && s.phase !== "over"; i++) {
    const p = g.activePlayers(s)[0]!;
    const r = g.applyMove(s, p, g.botMove!(s, p, undefined as never));
    if (!r.ok) throw new Error(`seed ${seed}: ${r.error}`);
    s = r.state;
    for (const line of s.log.slice(read)) {
      const e = s.expedition;
      if (/through the Rift Gate/.test(line) && e) {
        const lv = e.party.flatMap((x) => x ?? []).map((id) => s.people.find((q) => q.id === id)!.level);
        card = { mandatory: e.card.type === "mandatory", line: `Y${s.year} ${e.card.type} L${e.card.level}, ${lv.length} Scions of average level ${(lv.reduce((a, b) => a + b, 0) / lv.length).toFixed(1)}` };
      }
      const m = RESULT.exec(line);
      if (m && card) {
        const k = m[0] === "returns in triumph" ? "triumph" : m[0] === "expedition turns back" ? "back" : "wiped";
        tally.all[k]++;
        if (card.mandatory) tally.mandatory[k]++;
        if (each) console.log(`  seed ${seed} ${card.line}: ${m[0]}`);
        card = undefined;
      }
    }
    read = s.log.length;
    if (s.year !== year) (levels[(year = s.year)] ??= []).push(best4(s));
  }
  const end = s.outcome ? (s.outcome.won ? "won" : s.outcome.reason) : "unfinished";
  ends[end] = (ends[end] ?? 0) + 1;
}

const avg = (xs: number[] | undefined) => (xs?.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : "-");
console.log(`${runs} campaigns of ${houses} House${houses === 1 ? "" : "s"} from seed ${first}`);
for (const [end, n] of Object.entries(ends)) console.log(`  ${n} × ${end}`);
const line = (t: typeof tally.all) => `${t.triumph} triumph, ${t.wiped} wiped, ${t.back} turned back`;
console.log(`  expeditions: ${line(tally.all)}; mandatory: ${line(tally.mandatory)}`);
console.log(`  best four Scions' level by Year: ${Object.keys(levels).filter((y) => +y % 5 === 0 || y === "1" || y === "3").map((y) => `Y${y} ${avg(levels[+y])}`).join(", ")}`);
