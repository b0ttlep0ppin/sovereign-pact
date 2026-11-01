# Decisions log — The Sovereign Pact

Newest first. Each entry: date, decision, who decided, where it lands in SPEC.md.

## 2026-11-01 (implementation, Milestone 0) — implementer
Readings and defaults taken while building; each is a knob in `tuning.ts` or easy to move.
- **Repo layout follows Hardpoint Contract**, not HANDOFF §5's sketch: the rules live in `src/shared/games/sovereign-pact/`, the client in `src/client/games/sovereign-pact/`, and a copy of Vibe Pulse's game interface in `src/shared/` (`game.ts`, `rng.ts`…). The game imports `../../rng.ts` exactly as it will inside Vibe Pulse, so `npm run sync:game` can copy the two folders unchanged (`games-synced.json`). Content therefore sits in `src/shared/games/sovereign-pact/content/` (it ships with the rules); `schemas/` and `tools/` stay at the top level.
- **Saves pack people compactly.** A crowded Year-20, 4-House checkpoint (12 veterans and a full recruit pool per House) measured 114 KB as plain objects. People are now saved as fixed-order arrays with a dictionary of their strings (`codec.ts`), still by content id: 43 KB, which leaves about 20 KB for items, the bestiary and expedition records. `Person.mastered` lists mastered Jobs so their abilities aren't listed one by one. The save-size test fails above 75% of 64 KB so later milestones see the margin shrink.
- **Checkpoint** is the Settlement Phase's first state; once anyone moves, the last one is what's kept (Vibe Pulse keeps the latest non-null).
- **Unset numbers, implementation defaults (first pass):** Accord and Unrest start at 60; Doom at 0. Upkeep per Year: a Scion 4 Gold and 1 Grain, a recruit 1 Grain, the Retired half (rounded up). Income per House is scaled by ×2 / ×1.4 / ×1.1 / ×1 for 1–4 Houses (§4.3 "similar kingdom total"). Each House starts with one Year's income. The Short campaign's mandatory Years are 3, 5, 8 and 10.
- **What another House can't see:** its Gold, debt, Stores and recruit pool (§6.9 lists them among the secrets a Ward leaks), its Ambition and exact score. A recruit's Sanity and MP hide with its stats below Insight 1, since they follow from them. Pact marks show to nobody, their own House included (§14.7a).

## 2026-11-01 (batch 12 answers) — Josh
- Art direction, LPC compositing, effects language, battle HUD, accessibility toggles, SFX mapping and music assignment: **accepted to build and judge on screen** ("let's see what it looks like"; music "can see how it goes"). → SPEC §15–16
- Town Map: hard to imagine from text; **prototype it early** and show it. → §15.6
- **Oryx megapack: Josh confirms we are free to use it.** Credit line stays as drafted. → CREDITS.md

## 2026-11-01 (batch 11 answers) — Josh
- The 12 regions as enemy pools accepted. → SPEC §14.5
- Mandatory arc and fiction accepted; **a settlement event can occasionally force an expedition** (rare). → §3.2, §9.1, §14.7
- **Dark bargains: keep the angle, but out of combat.** Boons for the bargaining House or banes for its rivals; **never guaranteed**, so nobody can be sure one happened; **some are influenced by House traits.** → §14.7a rewritten as "Dark Bargains" (an Omens / expedition event, private)
- Enemy model (one HP pool, weak points, Parts) accepted. → §14.1
- Stat scaling accepted. **Scions must also gain XP by training**, so later recruits are not hopelessly behind, **capped at one level below their Mentor at most.** → §6.6, §8.3
- **Arcana are mini-bosses inside an expedition** (a special node), not whole cards. → §14.9
- Idols accepted. → §14.9
- Exclusions and NPC-portrait use accepted. → §14.0, §14.10
- Hazards accepted as **occasional and interesting, not common**; rate caps added. → §14.8

## 2026-11-01 (batch 10 answers) — Josh
- Slots, carry weight and the satchel accepted. → SPEC §13.1
- **Dual wield any one-hand weapons** (swords, axes, maces…), not only knives. → §13.2
- **Armor and weapon stats are per item**; the class and type tables are guidelines. → §13.2–13.3
- **Items must be really interesting**: varied, flavorful, valuable, squabbled over. **Many unique weapon properties** (multi-hit chance, increased TP, massive crits, extra elemental damage, and more). **Coveted shop items are auctioned** when several Houses want one. Spec writer drafted sealed-bid auctions, House-to-House auctions, blind drafting of unidentified finds, and a property catalogue. → §13.4, §13.4a
- Cursed gear accepted; **removing a curse should be expensive.** → §13.5
- Consumable list accepted as a start; **keep a decent amount of varied, flavorful items** (list extended). → §13.7
- **The host House outfits its Wards**; host gear returns when a Ward leaves, **except cursed items, which go with the Ward.** → §13.8

## 2026-11-01 (batch 9 answers) — Josh
- Base/advanced Job split and prerequisites accepted; **Mentor training is the fast path to advanced Jobs.** → SPEC §12.1
- JP economy accepted. → §12.1
- **Passive budget raised: 5 at level 1, +1 every 6 levels, 10 at level 30** (3 base was too restrictive; 2–3 point passives should be uncommon). → §12.1
- Job table accepted as a start; ability lists to be iterated once built; sub-systems accepted. → §12.2–12.17

## 2026-11-01 (batch 8 answers) — Josh
- Injury roll mechanics accepted. The five tables drew no objections (Q50 unanswered: treated as accepted, open to later edits). → SPEC §11.1–11.7
- **Mortal wound: the Scion dies at battle end regardless**, with an acknowledgement that they fight it out until then (drafted as "Last Stand"). → §11.4
- Permanent-injury cures accepted; **events should also reward cure items** that can be squabbled over or brought home for a favorite injured Scion. → §11.2, §13
- Trauma incidents and Grit-Marked accepted. → §11.8–11.9

## 2026-11-01 (batch 7 answers) — Josh
- **Every party uses the full 3×8 grid** (room for summons and constructs); enemies may occupy several cells; enemy shapes should be column-wide or a third of the grid so empty space isn't safe. → SPEC §10.1–10.2
- **Back row must not be too safe: 45 / 35 / 20**, and the back line is threatened by more than melee single-target attacks. → §10.3
- Turn structure, charging, statuses (values unknown but fine), Down rules, turn forecast accepted. → §10.4–10.9
- Bosses accepted; **their minions are not immune** to the things bosses resist. → §10.10

## 2026-11-01 (batch 6 answers) — Josh
- Expedition cards, types, levels and vote: **try it.** → SPEC §9.1
- **Each House nominates its own Scions** for its seats; nobody votes on another House's roster. Exception: an event can make one House a temporary **Regent** (dictator/monarch). → §9.2
- Node chain accepted. → §9.3
- **No Supply/food resource**; events cover hunger. → §9.3
- Loot ownership, retreat and wipe rules accepted. → §9.9–9.10
- Year-assignment list accepted as a starting point. → §8.3

## 2026-11-01 (batch 5 answers) — Josh
- Resources accepted; the **Commons gets a portion of resources automatically** and the Houses **vote** to spend it. → SPEC §8.1
- Building list and one-build-per-Year accepted. → §8.4
- Shared project economics and shop unlocks accepted. → §8.5–8.6
- **No recorded promises: trades are instant within a Year.** Oathbreaker mechanic removed. → §8.9
- Event cadence accepted; **a tie-breaking vote lowers Accord.** Applied to every vote in the game. → §8.8, §9.1
- **Sanity can recover fully with the right building; slots grow with building tier.** **Every Scion is assigned to something for the Year** (Sanity restore, training, expedition, special events…). → §8.3, §8.10
- Broken-location rule accepted. → §7.4

## 2026-11-01 (batch 4 answers) — Josh
- Starting Scions/recruits table, recruit arrival ~50%/Year, pool cap 8, upkeep as the limiter: **accepted as a starting point.** → SPEC §6.2
- **Insight** via Scriptorium levels 0–3 accepted. → §6.4
- **Ward Loyalty** model accepted. → §6.9
- **Retired Scions are freely usable** either way (field or teach); no conscription gate or Accord cost. Teaching is just their most likely best use. → §6.12
- Stat scale and first-pass formulas accepted. → §7.2–7.3
- Hit location weights accepted; **Durability must not refill automatically** after an injury roll. Spec writer drafted a Resilience check (2×Resilience %, cap 60%) for a 25% refill, else the location stays Broken and every further hit forces another roll. → §7.4
- **Tarot = 22 Major Arcana** accepted. → §6.8
- **Fallen Houses** stay in play accepted. → §6.13

## 2026-10-31 (batch 3 answers) — Josh
- Trait slots: **2 Major, 2 Minor, 1 Major Flaw, 1 Minor Flaw; Bloodline replaces one Major Trait + the Major Flaw.** → SPEC §5.7
- **Flavor/Crunch is set once for the whole campaign** (host table option). → §5.2
- **Seats are purely cosmetic** (customization for fun, no perks). → §5.5
- Elemental affinity numbers accepted (+25 / −25 / −10% MP). → §5.6
- Ambition: **dealt 2, keep 1.** → §5.1
- **One expedition per Year**; other Scions can do gambit-style auto-battles ("Sorties") for a little XP, JP or resources. Doom accepted. → §3.2, §3.3, §6.11
- Emblem builder scope and overlay plan accepted. → §5.4

## 2026-10-31 (batch 2 answers) — Josh
- **20 Years is the default**; a 10-Year Short campaign exists only as the exception. → SPEC §3.1
- A **mandatory expedition can be failed**; failure is very bad for the settlement rather than instant loss. Spec writer reinstated a Doom track as PROPOSED so repeated failure still ends the campaign. → §3.2–3.3
- Solo play replaces Accord with **Unrest**. → §3.3
- **Own repo, synced into Vibe Pulse** like Hardpoint Contract. → §4.2
- **Crisis** pledge resolution accepted (numbers to tune). → §3.5

## 2026-10-31 (batch 1 answers) — Josh
- Full campaign = **20 Years**. Some expeditions are **mandatory, do-or-die**; others are resource runs (building, crafting, shop unlocks; shops must be built). → SPEC §3.1–3.2
- **Accord** track accepted, to be tried in playtest. → §3.3
- **Scoring** (8 categories, secret Ambition, Standing tiers) accepted. → §3.4
- **Subtle sabotage**: Houses can withhold from settlement event resolutions for their own gain, making outcomes worse; invisible to others; outcomes can fail on their own so nobody is ever certain. → §3.5
- **No AI Houses.** Game scales with House count; bots would be poor at combat. → §2, §4.3
- **Build in the Vibe Pulse game shape** from day one. → §4.2
- Terms: Great House = Noble House; Arms = hands; CT = Readiness = clock ticks. → GLOSSARY
- Backgrounds and town art from Oryx megapack (high-fantasy sets) or hand-drawn. `hardpoint music` is out of scope. → §14, CREDITS
- Save/resume: Josh pointed to Hardpoint Contract. Found it in current Vibe Pulse: checkpoint saves (64 KB, host's) and the native-sync model. → §4.1

## 2026-10-31
- **Brief captured.** Josh's initial brief recorded as DECIDED across SPEC §1–16 (pillars, platform, House creation elements, Scion lifecycle, stats, expedition event rules, combat clock and grid, injury locations, 14 Jobs). — Josh
- **Assets located** on Josh's PC under `Desktop\decompilation\assets` and Vibe Pulse at `Desktop\decompilation\vibe-pulse`. Vibe Pulse constraints recorded in SPEC §4.1. — spec writer

## Open questions

Batches 1–12 (answered 2026-10-31 / 2026-11-01): Q1–Q84 closed, see above. The design is handed off; see HANDOFF.md.

- **Q85 (asked 2026-11-01, Milestone 0): how is a House's Standing tier worked out?** §3.4 names the four tiers (Waning / Steady / Rising / Ascendant) but not the rule, and it decides how much the other Houses can read. Built as the default, PROPOSED: a House's Ascendancy divided by the kingdom's mean, Waning below 0.75, Steady 0.75–1, Rising 1–1.25, Ascendant 1.25 and up; Steady when solo or before anyone scores. Alternatives: tiers by rank (the leader is always Ascendant, which tells everyone who leads), or fixed Ascendancy thresholds that rise with the Year (tiers say how well a House does, not how it compares).

Implementation items (not design questions):
- LPC sprite runtime: the folder holds one exported male base; runtime recruit generation needs the generator's full layer set exported with its per-layer `CREDITS.csv`.
- Oryx: confirmed free to use by Josh (2026-11-01); the credit line in CREDITS.md stands.
