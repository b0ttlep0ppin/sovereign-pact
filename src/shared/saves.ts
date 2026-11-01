// Mirrors Vibe Pulse's shared/src/saves.ts (the part the game uses): checkpoint saves continue a
// long game in a new room, and the server keeps nothing bigger than this.

/** The most a save may take as UTF-8 JSON: 64 KB. The server keeps nothing bigger. */
export const SAVE_MAX_BYTES = 64 * 1024;
