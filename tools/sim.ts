// The headless battle simulator from the command line (HANDOFF §7):
//   npm run sim -- [--seed N] [--level L] [--runs N] [--fight warband|battery] [--log]
// With --log it prints one battle turn by turn; otherwise it sums up many seeded battles.
import { renderGrid, renderLog, renderUnits } from "../src/shared/games/sovereign-pact/combat/render.ts";
import { simulate } from "../src/shared/games/sovereign-pact/combat/sim.ts";
import { warbandBattle, type EncounterId } from "../src/shared/games/sovereign-pact/combat/fixtures.ts";

const args = process.argv.slice(2);
const opt = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const seed = opt("seed", 1);
const level = opt("level", 2);
const runs = opt("runs", 200);
const fi = args.indexOf("--fight");
const fight = (fi >= 0 ? args[fi + 1] : "warband") as EncounterId;

if (args.includes("--log")) {
  const b = warbandBattle(seed, level, fight);
  console.log(renderGrid(b) + "\n");
  const s = simulate(b);
  console.log(renderLog(b));
  console.log("\n" + renderGrid(b) + "\n\n" + renderUnits(b) + "\n");
  console.log(s);
} else {
  const tally = { victory: 0, defeat: 0, retreat: 0 } as Record<string, number>;
  let turns = 0, hp = 0, rolls = 0, dead = 0;
  const bands: Record<string, number> = {};
  for (let i = 0; i < runs; i++) {
    const s = simulate(warbandBattle(seed + i, level, fight));
    tally[s.outcome]!++;
    turns += s.partyTurns / 4;
    hp += s.hpLost;
    rolls += s.injuryRolls;
    dead += s.dead;
    for (const [k, v] of Object.entries(s.bands)) bands[k] = (bands[k] ?? 0) + v;
  }
  console.log(`Barrows ${fight}, L${level}, party level ${level * 3}, ${runs} battles from seed ${seed}`);
  console.log(`  outcomes`, tally);
  console.log(`  turns per Scion ${(turns / runs).toFixed(1)}   HP lost ${((hp / runs) * 100).toFixed(0)}%`);
  console.log(`  injury rolls per battle ${(rolls / runs).toFixed(2)}   deaths per battle ${(dead / runs).toFixed(3)}`, bands);
}
