# The Sovereign Pact

A co-op (1–4 player) dark-fantasy game of noble Houses torn into an otherworld: twenty Years of settlement building, expeditions through branching event chains, and clock-driven tactics on a 3×8 grid with hit locations and injuries that last. The Houses win together or not at all; one of them is named Sovereign.

- Design: [`docs/SPEC.md`](docs/SPEC.md). Start with [`docs/HANDOFF.md`](docs/HANDOFF.md).
- Terms: [`docs/GLOSSARY.md`](docs/GLOSSARY.md). Decisions: [`docs/DECISIONS.md`](docs/DECISIONS.md). Credits: [`docs/CREDITS.md`](docs/CREDITS.md).
- Target platforms: a standalone web build, and a native port into [Vibe Pulse](https://github.com/tetrahorizons/vibe-pulse).

Status: Milestone 0 of the handoff note (the skeleton: the campaign's state, the Year loop, saves, a plain host). The rules run headless first; screens come in Milestone 8.

## Run

```
npm ci
npm run dev      # the standalone host at http://localhost:5173: 1-4 Houses, hot-seat or bots
npm run check    # lint, typecheck (the rules also without DOM or Node), tests
npm run content  # validate the content JSON against schemas/
```

## Layout

- `src/shared/games/sovereign-pact/`: the rules, a Vibe Pulse `GameDefinition` (pure, seeded, JSON state). `tuning.ts` holds every number marked first pass; `content/` holds the game's data.
- `src/client/games/sovereign-pact/`: the game's screens; `src/client/App.tsx` hosts it in the browser.
- `src/shared/*.ts`: a copy of Vibe Pulse's game interface, so both folders sync into Vibe Pulse unchanged.
- `schemas/`: JSON schemas for the content; `tools/`: content checks, and later the simulator and asset pipeline.
