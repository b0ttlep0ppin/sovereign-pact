// The shape of a game's "How to play" text. Each game keeps its own in client/src/games/<id>/howto.ts,
// next to its code; the client shows it on the detail page and in rooms, the server on the page it
// renders for search engines.

export interface HowTo {
  /** One or two sentences: what you're trying to do. */
  goal: string;
  /** What's dealt or built before the first move. */
  setup: readonly string[];
  /** What happens on a turn, in order. */
  turn: readonly string[];
  controls: {
    mouse: string;
    touch: string;
    keyboard: string;
  };
  /** How the game ends and who wins. */
  win: string;
  /** How solo play and playing with others differ: bots, co-op. */
  players: string;
  /** Two to four. */
  tips: readonly string[];
}
