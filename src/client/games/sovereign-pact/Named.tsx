// The Scion a choice falls on, named inside its words in their House's colour (Josh 2026-11-10: "The
// sharpest eye, Bob, takes up his contest"). A choice that opens with its subject ("The strongest",
// "The one in plate", "The Leader") gets the name after that phrase; any other choice is left as written.
import type { SovView } from "@vibepulse/shared/games/sovereign-pact";
import { inkOf } from "./Emblem";

const WORD = "[A-Za-z][\\w'-]*";
const NOUN = "eye|ear|hand|voice|talker|healer|tracker|liar|mind|tongue|nose|one|Scion|fighter|swimmer|child|Saint";
const HEAD = new RegExp(`^(?:The|Your|Our own) (?:(?:most|least|best|worst) )?${WORD}(?: (?:${NOUN}))?(?: (?:of you|among you))?$`);
/** Words ending in -s that are never the verb. */
const NOT_VERBS = new Set(["enemies", "eyes", "hands", "ears", "always", "its", "this", "perhaps", "towards"]);
/** After these, an -s word is a noun: "the one with the most kills goes", "the one the arrows find". */
const DETERMINERS = new Set(["the", "a", "an", "most", "their", "his", "her"]);
const verb = (w: string | undefined) => {
  const x = w?.replace(/[,;.:]$/, "") ?? "";
  return x === "is" || x === "has" || (/^[a-z][\w-]*[^su']s$/.test(x) && !NOT_VERBS.has(x));
};

/** Where a choice's subject phrase ends (its length), or null when it does not open with one. */
export function subjectEnd(label: string): number | null {
  const words = label.split(" ");
  const at = (n: number) => words.slice(0, n).join(" ").length;
  // "Let your wisest step into the gap": the verb is bare after Let.
  const let_ = /^Let (?:the|your) (?:(?:most|least) [A-Za-z][\w'-]*|[a-z][\w-]*est)(?= [a-z])/.exec(label);
  if (let_) return let_[0].length;
  // Plural hands take a bare verb: "The quietest hands lift the sword".
  const hands = /^(?:The [a-z][\w-]*|Healer's) hands(?= [a-z])/.exec(label);
  if (hands) return hands[0].length;
  // "The one in plate wades in", "The Scion with the strongest will confronts": up to the first verb,
  // past the clause's own verb after who or it ("The one it names kneels").
  if (/^The (?:one|Scion) [a-z]/.test(label)) {
    let skip = ["who", "it"].includes(words[2]!) ? 1 : 0;
    for (let n = 3; n < Math.min(words.length, 12); n++) {
      if (!verb(words[n]) || DETERMINERS.has(words[n - 1]!)) continue;
      if (skip-- > 0) continue;
      return at(n);
    }
    return null;
  }
  for (let n = 6; n >= 2; n--) {
    if (n >= words.length) continue;
    const head = words.slice(0, n).join(" ");
    if (head === "The one" || !HEAD.test(head.replace(/,$/, ""))) continue;
    if (verb(words[n])) return head.replace(/,$/, "").length;
  }
  return null;
}

/** A choice's words with its Scion named in them, or the words alone when no one is known. */
export function Named({ label, person, view }: { label: string; person: number | null | undefined; view: SovView }) {
  const p = person === null || person === undefined ? undefined : view.people.find((x) => x.id === person);
  const end = p ? subjectEnd(label) : null;
  if (!p || end === null) return <>{label}</>;
  return (
    <>
      {label.slice(0, end)},{" "}
      <span className="sp-named" style={{ color: inkOf(view.houses[p.host]?.colors) }}>
        {p.name}
      </span>
      ,{label.slice(end)}
    </>
  );
}
