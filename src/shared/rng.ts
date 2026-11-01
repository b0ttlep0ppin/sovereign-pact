/** A seeded random number generator, so games and bots replay the same way from the same seed. */
export interface Rng {
  /** A float in `[0, 1)`. */
  next(): number;
  /** An integer in `[0, maxExclusive)`. */
  int(maxExclusive: number): number;
  /** A random element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** A shuffled copy; the input is left alone. */
  shuffle<T>(items: readonly T[]): T[];
  /** The current internal state. `createRng(rng.seed())` carries on with the same sequence. */
  seed(): number;
}

/** Creates a {@link Rng} (mulberry32) from any number; only its low 32 bits matter. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (maxExclusive: number) => {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
      throw new RangeError(`int() needs a positive integer, got ${maxExclusive}`);
    }
    return Math.floor(next() * maxExclusive);
  };

  return {
    next,
    int,
    pick: (items) => {
      if (items.length === 0) throw new RangeError("pick() needs a non-empty array");
      return items[int(items.length)]!;
    },
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      }
      return copy;
    },
    seed: () => state,
  };
}
