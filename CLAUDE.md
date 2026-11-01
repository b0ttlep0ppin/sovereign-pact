# The Sovereign Pact — instructions for any agent working in this repo

Read, in this order, before touching code:
1. `docs/HANDOFF.md` — what to build, the non-negotiables, the milestone order, budgets and tests.
2. `docs/SPEC.md` — the design. **[DECIDED]** is the owner's word; **[PROPOSED]** is the default until he says otherwise; **[OPEN]** means ask.
3. `docs/GLOSSARY.md` — the vocabulary for identifiers, UI text and content ids. Use its spellings.
4. `docs/DECISIONS.md` and `docs/CREDITS.md` as you need them.

Rules of the road:
- Work the milestones in HANDOFF.md §4 in order; one milestone is several small PRs (keep each under ~400 changed lines). Milestones 0–3 have no UI: build the rules and the headless combat simulator first.
- Every rule is a pure TypeScript reducer over JSON state with a seeded RNG, in Vibe Pulse's `GameDefinition` shape (see `docs/SPEC.md` §4). No `Math.random`, no clock reads, no DOM or Node APIs in `shared/`. Hidden information exists only inside `view()`. Checkpoints stay under 64 KB; the size test is written in Milestone 0.
- Content (events, enemies, bosses, items, traits, Jobs' ability tables) is data under `src/shared/games/sovereign-pact/content/`, validated by the schemas under `schemas/` in CI (`npm run content`). Never hard-code content into rules; read it through `content.ts`.
- Layout (Hardpoint Contract's, so the sync into Vibe Pulse copies folders unchanged): rules in `src/shared/games/sovereign-pact/`, client in `src/client/games/sovereign-pact/`, Vibe Pulse's game interface copied in `src/shared/*.ts`, the standalone host in `src/client/App.tsx`. Every "first pass" number goes in `tuning.ts`. `npm run check` runs lint, typecheck and tests.
- Assets: never commit the raw packs (monster packs, BOOM Library sources, Oryx sheets, LPC generator). Commit only atlases, processed cuts and the layers the game ships, each with its credit line in the manifest. `docs/CREDITS.md` lists every author who must appear on the Credits screen.
- When the spec is silent or two readings are plausible, follow the pillars in SPEC §1, say which reading you took in the PR, and add a dated line to `docs/DECISIONS.md`. When something needs the owner's decision, write it as a numbered question there and ask; do not invent names or hidden-information rules.
- Numbers marked "first pass" or "tune" are knobs: expose them in one config module and let the simulator (HANDOFF §7) find the problems before screens exist.
- Vibe Pulse port (Milestone 9) follows the Hardpoint Contract model: this repo is the source of truth and is synced into `tetrahorizons/vibe-pulse` natively; read that repo's `CLAUDE.md` before porting.

The owner is Josh (`b0ttlep0ppin`). He wants to see things in play before fixing numbers, so prefer a working slice over a complete one.
