// Votes of the Houses (§8.1, §8.8): the Commons' stock is spent only by vote, and some settlement events
// are decided by one. The most votes win; a tie costs Accord −3 and goes to the highest-Renown House
// among those who voted for a tied option [DECIDED]. With one House there is no vote: it decides.
import { built, loseAccord, spendCommons, stillNeeded } from "./commons.ts";
import { PROJECT_BY_ID } from "./content.ts";
import type { SovState, Vote } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log } from "./year.ts";

/** What the Commons could give a project now, in units. */
export function commonsCanGive(s: SovState, project: string): number {
  return Object.entries(stillNeeded(s, project)).reduce(
    (sum, [k, n]) => sum + Math.min(n ?? 0, k === "gold" ? s.commons.gold : (s.commons.stores[k] ?? 0)),
    0,
  );
}

/** Why `house` cannot propose spending the Commons on `project`, or null. */
export function cannotPropose(s: SovState, project: string): string | null {
  if (s.vote) return "A vote is already open.";
  if (!PROJECT_BY_ID.has(project)) return "There is no such project.";
  if (!Object.keys(stillNeeded(s, project)).length) return built(s, project) ? "That project is complete." : "That project cannot be paid for yet.";
  if (!commonsCanGive(s, project)) return "The Commons holds nothing that project needs.";
  return null;
}

export function propose(s: SovState, house: number, project: string): void {
  s.vote = { kind: "spend", subject: project, options: ["yes", "no"], by: s.houses.map(() => null), proposer: house };
  log(s, `House ${s.houses[house]!.name} proposes spending the Commons on the ${PROJECT_BY_ID.get(project)!.name}.`);
  // Solo, the proposal is the decision.
  if (s.houses.length === 1) castVote(s, house, 0);
}

export function cannotVote(s: SovState, house: number, choice: number): string | null {
  if (!s.vote) return "There is nothing to vote on.";
  if (s.vote.by[house] !== null) return "You have already voted.";
  if (!Number.isInteger(choice) || choice < 0 || choice >= s.vote.options.length) return "That is not one of the choices.";
  return null;
}

export function castVote(s: SovState, house: number, choice: number): void {
  s.vote!.by[house] = choice;
  if (s.vote!.by.every((c) => c !== null)) settleVote(s);
}

/** The winning option of a vote, and whether it was a tie. Nobody voting: the last option (no). */
export function tally(s: SovState, vote: Vote): { choice: number; tie: boolean } {
  const counts = vote.options.map((_, i) => vote.by.filter((c) => c === i).length);
  const most = Math.max(...counts);
  if (most === 0) return { choice: vote.options.length - 1, tie: false };
  const tied = counts.flatMap((n, i) => (n === most ? [i] : []));
  if (tied.length === 1) return { choice: tied[0]!, tie: false };
  // The highest-Renown House among those who voted for a tied option breaks it (seat order if level).
  const voters = vote.by.flatMap((c, h) => (c !== null && tied.includes(c) ? [h] : []));
  const breaker = voters.reduce((best, h) => (s.houses[h]!.score.renown > s.houses[best]!.score.renown ? h : best));
  return { choice: vote.by[breaker]!, tie: true };
}

/** Settles the open vote: the tie's cost, Renown for the winning side, and what the vote decided. */
export function settleVote(s: SovState): void {
  const vote = s.vote;
  if (!vote) return;
  delete s.vote;
  const { choice, tie } = tally(s, vote);
  if (tie) {
    loseAccord(s, TUNING.tracks.tieCost);
    log(s, "The Houses are split; the tie is broken, and trust frays.");
  }
  if (s.houses.length > 1) vote.by.forEach((c, h) => c === choice && (s.houses[h]!.score.renown += TUNING.tracks.voteWonRenown));
  if (vote.kind === "spend") {
    const name = PROJECT_BY_ID.get(vote.subject)!.name;
    if (vote.options[choice] === "yes") log(s, `The Commons gives ${spendCommons(s, vote.subject)} to the ${name}.`);
    else log(s, `The Houses refuse to spend the Commons on the ${name}.`);
  }
}
