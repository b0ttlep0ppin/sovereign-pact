// Table options: the house rules and variants a game offers. Each game declares its options on its
// GameDefinition; the host picks them in the lobby, the room server checks the pick with
// parseTableOptions, and the game's setup gets them and keeps them in its state for its rules to read.

export interface TableOptionChoice {
  /** Stored in {@link TableOptions}; stable, since saved state and links may carry it. */
  value: string;
  /** Short, for the lobby picker and the table browser, e.g. "Draw until you can play". */
  label: string;
}

export interface TableOption {
  /** Key in {@link TableOptions}. */
  id: string;
  /** What the option is about, e.g. "Drawing". */
  label: string;
  /** One sentence for How to play: what the choices change. */
  description: string;
  /** At least two. */
  choices: readonly TableOptionChoice[];
  /** The choice standard rules use; ranked tables only ever use this one. */
  standard: string;
}

/** A table's pick for each of its game's options, by option id. Plain data, safe to send and store. */
export type TableOptions = Readonly<Record<string, string>>;

/** Every option at its standard choice. */
export function standardOptions(options: readonly TableOption[] = []): TableOptions {
  return Object.fromEntries(options.map((option) => [option.id, option.standard]));
}

/**
 * Checks a host's pick from the network against a game's options. Options left out keep their
 * standard choice. Returns the full set, or an error message for unknown options or choices.
 */
export function parseTableOptions(options: readonly TableOption[] = [], raw: unknown): TableOptions | string {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return "Pick the table's options.";
  const picked = new Map(Object.entries(raw));
  const parsed: Record<string, string> = {};
  for (const option of options) {
    const value = picked.get(option.id) ?? option.standard;
    picked.delete(option.id);
    if (!option.choices.some((choice) => choice.value === value)) return `That's not a choice for ${option.label}.`;
    parsed[option.id] = value as string;
  }
  if (picked.size > 0) return "This game has no such option.";
  return parsed;
}

/** Whether every option is at its standard choice (missing ones count as standard). */
export function isStandardOptions(options: readonly TableOption[] = [], picked: TableOptions): boolean {
  return options.every((option) => (picked[option.id] ?? option.standard) === option.standard);
}

/**
 * One line per option for How to play: "Drawing: How many cards … Choices: Draw one card
 * (standard); Draw until you can play." Empty for games without options.
 */
export function houseRuleLines(options: readonly TableOption[] = []): string[] {
  return options.map((option) => {
    const choices = option.choices.map((c) => (c.value === option.standard ? `${c.label} (standard)` : c.label));
    return `${option.label}: ${option.description} Choices: ${choices.join("; ")}.`;
  });
}

/** The house rules in force, as "Drawing: Draw until you can play" lines; empty for standard rules. */
export function describeTableOptions(options: readonly TableOption[] = [], picked: TableOptions): string[] {
  return options.flatMap((option) => {
    const value = picked[option.id] ?? option.standard;
    const choice = option.choices.find((c) => c.value === value);
    return value === option.standard || !choice ? [] : [`${option.label}: ${choice.label}`];
  });
}
