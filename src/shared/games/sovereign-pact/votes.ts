// Votes of the Houses (§8.1, §8.8): the Commons' stock is spent only by vote, and some settlement events
// are decided by one. The most votes win; a tie costs Accord −3 and goes to the highest-Renown House
// among those who voted for a tied option [DECIDED]. With one House there is no vote: it decides.
import { built, loseAccord, spendCommons, stillNeeded } from "./commons.ts";
import { PROJECT_BY_ID, TOWN_EVENT_BY_ID } from "./content.ts";
import { cautious, settleEventVote } from "./omens.ts";
import type { SovState, Vote } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log, withRng } from "./year.ts";

/** What the Commons could give a project now, in units. */
export function commonsCanGive(s: SovState, project: string): number {
  return Object.entries(stillNeeded(s, project)).reduce(
    (sum, [k, n]) => sum + Math.min(n ?? 0, k === "gold" ? s.commons.gold : (s.commons.stores[k] ?? 0)),
    0,
  );
}

/**
 * What House `house` still owes an answer before it may seal the Year (Josh 2026-11-03: "make sure
 * events that require everyone's input are addressed prior to seal year"): a vote, or a town event it decides.
 */
export function owed(s: SovState, house: number): string | null {
  if (s.vote && s.vote.by[house] === null) {
    const what =
      s.vote.kind === "spend"
        ? `spending the Commons on the ${PROJECT_BY_ID.get(s.vote.subject)?.name ?? s.vote.subject}`
        : s.vote.kind === "levy"
          ? "the levy"
          : (TOWN_EVENT_BY_ID.get(s.vote.subject)?.title ?? s.vote.subject);
    return `Vote first: ${what}.`;
  }
  const pe = s.events.find((e) => e.deciders.includes(house) && e.choices[house] === null);
  return pe ? `Choose first: ${TOWN_EVENT_BY_ID.get(pe.id)?.title ?? pe.id}.` : null;
}

/** Why `house` cannot propose spending the Commons on `project`, or null. */
export function cannotPropose(s: SovState, project: string): string | null {
  if (s.vote) return "A vote is already open.";
  if (!PROJECT_BY_ID.has(project)) return "There is no such project.";
  if (!Object.keys(stillNeeded(s, project)).length) return built(s, project) ? "That project is complete." : "That project cannot be paid for yet.";
  if (!commonsCanGive(s, project)) return "The Commons holds nothing that project needs.";
  return null;
}

/** Why a project cannot be sited in House `host`'s district: it already stands somewhere, or there is no such House. */
export function cannotSite(s: SovState, project: string, host: number): string | null {
  if (!Number.isInteger(host) || !s.houses[host]) return "There is no such House.";
  const at = s.commons.hosts?.[project] ?? s.commons.funds[project]?.host;
  if (at !== undefined && at !== host) return `The ${PROJECT_BY_ID.get(project)?.name ?? project} is already sited in House ${s.houses[at]!.name}'s district.`;
  return null;
}

export function propose(s: SovState, house: number, project: string, host: number = house): void {
  const at = s.commons.hosts?.[project] ?? s.commons.funds[project]?.host ?? host;
  s.vote = { kind: "spend", subject: project, options: ["yes", "no"], by: s.houses.map(() => null), proposer: house, host: at };
  const site = s.houses.length > 1 ? `, sited in House ${s.houses[at]!.name}'s district` : "";
  log(s, `House ${s.houses[house]!.name} proposes spending the Commons on the ${PROJECT_BY_ID.get(project)!.name}${site}.`);
  // A sealed House is called back to vote: nobody seals past a question put to them.
  s.houses.forEach((h, i) => i !== house && (h.sealed = false));
  // Solo, the proposal is the decision.
  if (s.houses.length === 1) castVote(s, house, 0);
}

/** A levy (the Commons Council): every House pays `TUNING.commons.levyGold` (or what it has) into the Commons if it passes. */
export function cannotLevy(s: SovState): string | null {
  if (s.vote) return "A vote is already open.";
  if (s.houses.length === 1) return "With one House there is nobody to levy.";
  return null;
}

export function proposeLevy(s: SovState, house: number): void {
  s.vote = { kind: "levy", subject: "levy", options: ["yes", "no"], by: s.houses.map(() => null), proposer: house };
  log(s, `House ${s.houses[house]!.name} moves a levy of ${TUNING.commons.levyGold} Gold on every House, for the Commons.`);
  s.houses.forEach((h, i) => i !== house && (h.sealed = false));
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

/**
 * Bots that voted against the people at the table may come round to them (Josh 2026-11-03: "there should
 * be a chance they decide to agree with you instead so accord is preserved"). Only when the people agree
 * on one choice; the chance grows as Accord falls. Changes `votes` in place.
 */
export function goAlong(s: SovState, votes: (number | null)[]): void {
  const bots = new Set(s.botSeats ?? []);
  const theirs = votes.filter((c, h) => c !== null && !bots.has(h)) as number[];
  const counts = new Map<number, number>();
  for (const c of theirs) counts.set(c, (counts.get(c) ?? 0) + 1);
  const most = Math.max(0, ...counts.values());
  const lead = [...counts].filter(([, n]) => n === most);
  if (lead.length !== 1) return;
  const [want] = lead[0]!;
  const t = TUNING.tracks;
  const pct = Math.min(t.botAgreeMax, t.botAgreePct + Math.max(0, 50 - s.accord));
  votes.forEach((c, h) => {
    if (!bots.has(h) || c === null || c === want || withRng(s, (rng) => rng.int(100)) >= pct) return;
    votes[h] = want;
    log(s, `House ${s.houses[h]!.name} comes round to the others, for the city's sake.`);
  });
}

/** Settles the open vote: the tie's cost, Renown for the winning side, and what the vote decided. */
export function settleVote(s: SovState): void {
  const vote = s.vote;
  if (!vote) return;
  delete s.vote;
  goAlong(s, vote.by);
  const nobody = vote.by.every((c) => c === null);
  const { choice, tie } = vote.kind === "event" && nobody ? { choice: cautious(TOWN_EVENT_BY_ID.get(vote.subject)!), tie: false } : tally(s, vote);
  if (tie) {
    loseAccord(s, TUNING.tracks.tieCost);
    log(s, "The Houses are split; the tie is broken, and trust frays.");
  }
  if (s.houses.length > 1) vote.by.forEach((c, h) => c === choice && (s.houses[h]!.score.renown += TUNING.tracks.voteWonRenown));
  if (vote.kind === "event") settleEventVote(s, vote.subject, choice);
  if (vote.kind === "levy") {
    if (vote.options[choice] !== "yes") return void log(s, "The Houses refuse the levy.");
    let raised = 0;
    for (const h of s.houses) {
      const n = Math.min(Math.max(0, h.gold), TUNING.commons.levyGold);
      h.gold -= n;
      raised += n;
    }
    s.commons.gold += raised;
    log(s, `The levy passes: ${raised} Gold goes into the Commons.`);
  }
  if (vote.kind === "spend") {
    const name = PROJECT_BY_ID.get(vote.subject)!.name;
    if (vote.options[choice] === "yes" && vote.host !== undefined) {
      const f = (s.commons.funds[vote.subject] ??= { paid: {}, by: s.houses.map(() => 0) });
      f.host ??= vote.host;
    }
    if (vote.options[choice] === "yes") log(s, `The Commons gives ${spendCommons(s, vote.subject)} to the ${name}.`);
    else log(s, `The Houses refuse to spend the Commons on the ${name}.`);
  }
}
