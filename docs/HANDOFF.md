# Handoff note for the implementer — The Sovereign Pact

Final, 2026-11-01. Written for the model or engineer who builds the game from [SPEC.md](SPEC.md). Read this first, then the spec front to back once, then build in the order below.

## 1. What you are building

A co-op (1–4 players) dark-fantasy noble-house tactics and management game: 20 Years of settlement building, expeditions through event chains, and 3×8-grid clock combat with hit locations and permanent injuries, scored by a hidden Ascendancy with a secret Ambition. Playable in a browser on its own, and ported natively into Vibe Pulse (`tetrahorizons/vibe-pulse`) the way Hardpoint Contract is. Josh (`b0ttlep0ppin`) owns the design; the spec is his decisions plus drafted proposals.

## 2. How to read the spec

- **[DECIDED]** is Josh's word: implement as written. **[PROPOSED]** is the spec writer's draft he has not yet confirmed: implement it as the default unless he says otherwise, and flag it in the PR. **[OPEN]** needs an answer: ask, don't invent.
- [GLOSSARY.md](GLOSSARY.md) is the vocabulary for code identifiers, UI text and content ids. Use its spellings. ❓ means the term is still the spec writer's; keep it unless Josh renames it.
- [DECISIONS.md](DECISIONS.md) is the dated log, newest first, with the open question numbers (Q1…). When Josh answers one, move it to the log and flip the tag in the spec.
- [CREDITS.md](CREDITS.md): every asset author must appear on the Credits screen; the licenses forbid shipping raw packs.
- Numbers are first-pass unless a section says otherwise. Josh said more than once "will see once it's built and iterate": build the knobs where the spec gives formulas and tables, then tune.

## 3. Non-negotiables

1. **Vibe Pulse shape from day one** (§4.2): every rule is a pure TypeScript reducer over plain JSON state in the `GameDefinition<State, Move, View>` form (`shared/src/game.ts` in Vibe Pulse): `setup`, `applyMove`, `activePlayers`, `result`, `view`, `botMove`, `checkpoint`. No `Math.random`, no clock reads, no DOM or Node APIs in the rules; the seeded `Rng` only.
2. **Hidden information lives only in `view()`** (§4.2, §15.7): exact Ascendancy, Ambition, pledges, bids, Ward Loyalty, unrevealed recruit potential, Pact marks.
3. **Saves fit 64 KB** (§4.4): checkpoint at the start of every Settlement Phase; store content by id, never text; write the size test first.
4. **Every decision point has a `botMove`** (§4.1): a bot takes a dropped seat after 30 s. The Sortie gambit engine (§6.11) is the combat bot; the settlement bot is cautious.
5. **Co-op loss** is `{kind: "win", winners: []}`; the Sovereign is the per-seat `placement`.
6. **Content is data**: events (§9.4), enemies (§14.1), bosses (§14.6), items (§13.4), traits (§5.7), Jobs' ability tables are JSON or typed content files validated by schema in CI, so Josh can edit them without touching rules.
7. **Never ship raw asset packs** (§17): sprites inside atlases only, SFX as processed cuts, LPC layers with their per-layer credits.

## 4. Build order

Each milestone is playable or testable on its own. Keep PRs small (Vibe Pulse's rule is ~400 lines).

| # | Milestone | What exists at the end | Spec |
|---|---|---|---|
| 0 | Skeleton | Repo layout (§5 below), `GameDefinition` stub with the state shape, seeded `Rng`, checkpoint with the 64 KB test, a standalone React host that renders state and sends moves, CI with lint, typecheck, tests, schema validation | §4 |
| 1 | Combat core | The clock, the 3×8 grid, shapes and targeting, the damage pipeline, statuses, Durability and injury rolls, Down and Last Stand, charging and telegraphs, gambits, a headless battle simulator and a text renderer | §7, §10, §11 |
| 2 | Scions and Jobs | Stats and formulas, the 14 Jobs with their ability sets, passives and sub-systems (Components, songs, Forms, summons, combos, Cast Lots), equipment slots and properties, enough content to field a party | §7, §12, §13 |
| 3 | Enemies and bosses | The enemy model, stat scaling, roles, group templates, the 12 pools' rosters, hazards, the 14 scripted bosses, variants; the simulator plays encounters at every level | §14 |
| 4 | Campaign loop | Years, Omens and the Reckoning, the Town Map's buildings and levels, Year assignments, resources, the Commons and votes, Crises and pledges, deals, auctions, Accord/Unrest/Doom, Ascendancy and scoring | §3, §8, §13.4a |
| 5 | Houses and recruits | House creation (traits, Bloodlines, emblem, Seats, Ambition, Flavor/Crunch), recruits and Insight, promotion, Wards and Loyalty, Retired and Mentors, Tarot, Fallen Houses | §5, §6 |
| 6 | Expeditions | Cards, nomination, the chain and its nodes, the event engine with every resolution rule and effect, Forks and Gates, Camps and Caches, loot and the draft, retreat and wipes, Sorties | §9, §6.11 |
| 7 | The mandatory arc and content fill | The four mandatory expeditions, Hunts, Arcana, Idols, the general event pool at its budget, named items, the bestiary | §14.7, §14.9, §9.7 |
| 8 | Presentation and audio | The sprite pipeline (pack atlases, LPC compositing, House tinting, emblems), the effects language, the battle screen and HUD, the Town Map, event panels, the mixer, cues, music assignment, accessibility toggles | §15, §16 |
| 9 | Vibe Pulse port | Sync into Vibe Pulse (`npm run sync:game` model), `meta.ts` with the music brief, `howto.ts`, 6–12 achievements and daily tasks, `emblem.svg`, the e2e move-picker and art moments, `credits.ts`, the quality-gate checklist, a recording, `preview: true` until Josh's playtest | §4.1, Vibe Pulse `CLAUDE.md` |

Milestones 1–3 need no UI beyond the text renderer; do them first and let the simulator find the balance problems before the screens exist.

## 5. Suggested repo layout

```
sovereign-pact/
  shared/        rules: the GameDefinition, combat, campaign, scoring (pure TS, no DOM)
  content/       JSON content: events/, enemies/<pool>/, bosses/, items/, traits/, jobs/, pools/, sprites/manifest.json, audio/sfx.json, music.json
  schemas/       JSON schemas for every content folder; CI validates
  client/        React host: screens, the engine adapters (Stage, FX, mixer), LPC compositing
  tools/         sims (soak, balance), content lints, asset pipeline (atlas, SFX cuts, LPC export)
  docs/          the spec files copied in, design template, decisions
```

## 6. Content budgets (first release)

| Content | Budget | Lint |
|---|---|---|
| General event pool | ≥ 150 events; each specific pool ≥ 25; mandatory chains hand-written | Option tags balanced (bold / cautious / clever pay off equally, §9.5); maiming ≤ 2% of outcome weight; every rule in the catalogue used at least 5 times |
| Enemies | 15–25 per pool, 12 pools | ≥ 1/3 of each pool is a back-line threat (§14.3); every level 1–10 fillable for every template |
| Bosses | 14 scripted + a Hunt quarry per pool + the 22 Arcana + 6 Idols | Each has phases, a pattern, a weakness, `say` lines |
| Items | ≥ 120 named Fine-or-better items, the property catalogue, ≥ 35 consumables | Every Job can be outfitted at every tier |
| Traits | The §5.7 lists plus individual traits | Every trait's effect is implemented or the trait is not offered |
| Buildings | §8.4's list with three levels each | |

## 7. Tests the spec expects

- Unit tests on the rules (pure functions): formulas (§7.3), hit and damage (§10.6), the injury tables (§11), scoring (§3.4), votes and ties (Accord −3), auctions, Loyalty.
- The **simulator**: seeded bot parties play encounters at every level and every template; assert the balance targets in §14.2 and the injury rates in §11; a nightly full run, a short daily sample (the Vibe Pulse `sims` pattern).
- **Save size**: a 20-Year, 4-House campaign's checkpoint stays under 64 KB.
- **Hidden-info test**: for every state and every seat, `view()` contains nothing from the forbidden list (§3 item 2).
- **Content lints** (tools/): the budgets above, schema validation, every sprite in the manifest exists in the atlas, every cue has takes, every asset in the manifest has a credit line.
- Vibe Pulse's own gates when porting: `scripts/check.sh`, howto, achievements, art, music tests.

## 8. Asset pipeline

1. **Monster packs** → `content/sprites/manifest.json` (source file, scale, flip, license line) → atlases at build (`npm run atlas`-style); never commit the packs or serve a source file as is.
2. **LPC** → export the full layer set from the generator with its `CREDITS.csv`; vendor the PNG layers used; the manifest carries each layer's authors and license (CC-BY-SA applies to modified art).
3. **BOOM Library** → cut, trim, normalize, OGG mono; a cue → takes table in `content/audio/sfx.json`; ship cuts only.
4. **Music** → the 18 Pixabay tracks with loop points; credits as CREDITS.md spells them; 1.5–3 minute cuts for Vibe Pulse's `music.ts`.
5. **Oryx** → backgrounds and Town Map tiles assembled by hand into the 12 pool strips and the 4 mandatory arenas (§14.10, §15.6); credit line in CREDITS.md.

## 9. Open at handoff

Check [DECISIONS.md](DECISIONS.md) "Open questions" for the live list. At handoff every design question (Q1–Q84) is answered. What remains:
- **Numbers marked first pass or tune** (stat formulas §7.3, enemy scaling §14.2, injury tables §11, Loyalty §6.9, Crisis bands §3.5, auction and bargain odds): build the knobs, then show Josh play.
- **Dark Bargains** (§14.7a): decided in principle (out of combat, boons or banes, never guaranteed, trait-shaped); the offer list and odds are first-pass.
- **Presentation** (§15–16) is accepted to judge on screen; prototype the Town Map (§15.6) early, since Josh found it hard to picture from text.
- **LPC runtime**: the asset folder holds one exported male base; the full layer set and its credits must be exported from the generator.
- **Oryx**: confirmed free to use; keep the credit line in CREDITS.md.

## 10. Ask Josh, don't invent

The spec is silent on purpose about names he may want to choose (the kingdom's name, the mandatory expeditions' titles, named items), about exact numbers he said to tune after building, and about anything touching how hidden information is shown to players. Where two readings of a rule are both plausible, pick the one that keeps the pillars in §1 (very hard, co-op with quiet rivalry, consequences that persist) and say which you picked in the PR.
