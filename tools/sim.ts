// The headless battle simulator from the command line (HANDOFF §7):
//   npm run sim -- [--seed N] [--level L] [--runs N] [--fight warband|battery] [--jobs a,b,c,d] [--log]
//   npm run sim -- --sweep [--levels 1,3,6] [--runs N] [--fight warband|battery]
// With --log it prints one battle turn by turn; otherwise it sums up many seeded battles. --jobs builds
// a real party (combat/roster.ts: rolled Scions, JP spent, real items); without it the stand-in party
// fights. --sweep puts each of the 14 Jobs into the real baseline party in turn, at each level.
import type { JobId } from "../src/shared/games/sovereign-pact/state.ts";
import { JOBS } from "../src/shared/games/sovereign-pact/content.ts";
import { warbandBattle, type EncounterId } from "../src/shared/games/sovereign-pact/combat/fixtures.ts";
import { renderGrid, renderLog, renderUnits } from "../src/shared/games/sovereign-pact/combat/render.ts";
import { BASELINE, realBattle, withJob } from "../src/shared/games/sovereign-pact/combat/roster.ts";
import { simulate } from "../src/shared/games/sovereign-pact/combat/sim.ts";
import type { Battle } from "../src/shared/games/sovereign-pact/combat/types.ts";

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const opt = (name: string, fallback: number) => Number(arg(name) ?? fallback);
const seed = opt("seed", 1);
const level = opt("level", 2);
const runs = opt("runs", 200);
const fight = (arg("fight") ?? "warband") as EncounterId;
const jobs = arg("jobs")?.split(",") as JobId[] | undefined;

const battle = (s: number, lvl: number, party?: readonly JobId[]): Battle => (party ? realBattle(s, lvl, party, fight) : warbandBattle(s, lvl, fight));

function tally(lvl: number, party: readonly JobId[] | undefined, n: number) {
  const out = { win: 0, turns: 0, hp: 0, rolls: 0, dead: 0, bands: {} as Record<string, number> };
  for (let i = 0; i < n; i++) {
    const s = simulate(battle(seed + i, lvl, party));
    if (s.outcome === "victory") out.win++;
    out.turns += s.partyTurns / 4;
    out.hp += s.hpLost;
    out.rolls += s.injuryRolls;
    out.dead += s.dead;
    for (const [k, v] of Object.entries(s.bands)) out.bands[k] = (out.bands[k] ?? 0) + v;
  }
  return { ...out, line: `win ${((out.win / n) * 100).toFixed(0)}%  turns ${(out.turns / n).toFixed(1)}  HP lost ${((out.hp / n) * 100).toFixed(0)}%  rolls ${(out.rolls / n).toFixed(2)}  deaths ${(out.dead / n).toFixed(3)}` };
}

if (args.includes("--log")) {
  const b = battle(seed, level, jobs);
  console.log(renderGrid(b) + "\n");
  const s = simulate(b);
  console.log(renderLog(b));
  console.log("\n" + renderGrid(b) + "\n\n" + renderUnits(b) + "\n");
  console.log(s);
} else if (args.includes("--sweep")) {
  const levels = (arg("levels") ?? "1,3,6").split(",").map(Number);
  console.log(`Barrows ${fight}, ${runs} battles each from seed ${seed}; each Job in place of the baseline member in its column`);
  for (const lvl of levels) {
    console.log(`\nL${lvl} (Scion level ${lvl * 3})`);
    console.log(`  ${"baseline".padEnd(12)} ${tally(lvl, BASELINE, runs).line}`);
    for (const j of JOBS) console.log(`  ${j.id.padEnd(12)} ${tally(lvl, withJob(j.id), runs).line}`);
  }
} else {
  const t = tally(level, jobs, runs);
  console.log(`Barrows ${fight}, L${level}, party level ${level * 3}, ${jobs ? jobs.join("/") : "stand-in party"}, ${runs} battles from seed ${seed}`);
  console.log(`  ${t.line}`, t.bands);
}
