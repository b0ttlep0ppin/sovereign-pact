# Decisions log — The Sovereign Pact

Newest first. Each entry: date, decision, who decided, where it lands in SPEC.md.

## 2026-11-01 (implementation, Milestone 2f: the Minstrel) — implementer
- **A song is a status on each hearer** that carries the song's mods, and it ends for everyone when the Minstrel is Silenced, Deaf, Down or dead, or replaces that layer (§12.2). Songs start at 35 CT; Perfect Pitch (the Minstrel's innate) makes it 25. Hearers are every ally (or, for Harmonies and Plague Chant, every enemy) on the field who is not Deaf when it begins.
- **Readings**: Lullaby's Sleep is a 20% chance on each enemy as it begins; Dirge Fears undead as it begins (chance 100 before resist); Ballad of Embers is a Fire edge of 10%; Cleansing Air removes one physical ailment per ally each 100 ticks; Plague Chant re-Poisons enemies each 100 ticks. Carrying Voice, Crescendo, Finale and Encore's fourth layer wait for a later pass.

## 2026-11-01 (implementation, Milestone 2e: the Gambler) — implementer
- **Cast Lots** runs at the start of every Gambler turn that is not lost, per the §12.7 table. The "until next turn" results (6: Evasion, 10: Accuracy) end at the Gambler's next turn; 11 makes the next hit on a foe land; 12 makes the next action a crit. Numbers in `combat.dice`.
- **Double Down** is part of the action (`doubleDown`: 0–3 extra rolls). Each new roll replaces the total unless it is 4 or more lower, which fizzles the ability and spends the turn. House Edge and Risk Taker each add a point to that margin; §12.7 says Risk Taker lowers the threshold by 1, and that is read as "fizzles one point later". Bots never Double Down yet.
- **Marked Card**'s 11 applies to the next ability dice rolled against that target and is then used up. **All In** at 4 or under hits the Gambler instead of the burst. **Last Chip** ("(100 − your HP%) × 3% of max") and **Cheat Death** wait: whose max HP the first means needs a reading in play, and the second needs injury rerolls.

## 2026-11-01 (Q88 answered) — Josh
- **Keep the placeholder names for now** for the negative and cursed item properties (Brittle nerve, Sickly, Unnerving, Exposed: <Element>, Curse of the Withered Mind, of the Unhallowed, of the Open Guard, of the Beacon, of Whispers). Renaming later changes only `name` in `content/properties.json`.

## 2026-11-01 (implementation, Milestone 2d: Job abilities, first five) — implementer
- **Ability sets are content**, one file per Job (`content/abilities/<job>.json`, schema `abilities.schema.json`): Soldier, Knight, Magus, Soothsayer and Vagabond, every drafted active and passive with a JP price. Gambler, Pugilist and Minstrel come with Cast Lots, combos and songs; the advanced Jobs after that.
- **JP earned stay earned**: buying spends from what is left (earned − prices of what was bought in that Job), so buying never re-locks an advanced Job. Buying the last ability masters the Job.
- **Prices** run 50 (the basic opener) to 300–400 (ultimates); passives 100–300. A whole set costs 2,600–3,450 JP (§12.1 says "about 2,500"); first pass, tune in play.
- **A Scion's spell at 1.0×** has the power of the enemy power block at the caster's level ÷ 3 (a level-9 party fights level-3 enemies, §14.2), so spells keep pace like weapons do. `combat.spellLevelDivisor`.
- **Readings where §12 gives no number or the system is not built**: Shield Bash Stuns 35% of the time and War Cry Fears 35% (before resist; "by Might" waits for tuning); Hold the Line uses Protect; Lance's first-target bonus is left out; Backstab doubles only against Marked targets for now; Coup de Grâce always crits and is fatal below 20% HP, bosses excepted; Spirit Lamp restores Sanity, its Fear immunity comes later. Abilities whose system does not exist yet (moves, swaps, stances, Steal, Interpose, the unbuilt passives) are learnable but marked `later` and stay out of battle.

## 2026-11-01 (implementation, Milestone 2c: item properties) — implementer
- **Properties are content** (`content/properties.json`, 100 entries): every §13.4 weapon, armor and accessory property, one per element for edges and wards, one per ailment for Resistant, one per tag for Banes, plus negative and curse properties (§13.4, §13.5). Each names what it rolls on, its value range, a roll weight, an optional minimum tier and exclusive group, and battle `mods` per point of value. Fine items roll 1, Masterwork 2, Relics 2 or 3.
- **Readings taken where §13.4 gives no number**: Hamstringer Slows on 25% of hits; Visored is Head Durability +20%; an edge adds its % of the finished hit (after armor), through the target's affinity; Quickening rolls only on Masterwork or better wherever it can appear and counts once per Scion; rare properties roll less often (Quickening 1, Multi-hit 3, Massive crits and Second Wind 4, the rest 10). "Hungry's loss clause without its gain" is left out: with no gain there is nothing to lose.
- **What works in battle now**: every weapon property but Returning and Twinned (they wait on thrown weapons and dual wield), every armor property but Gravewalker and Stalwart (they wait on enemy fear sources and forced movement, Milestone 3), and the accessory stats, Ready, Attuned, Resolute and Keen eye. Quiet, Sworn, Essence sense, Renowned, the Tarot amplifier, the event tags and the Whispers curse act outside battle and arrive with expeditions and events (marked `effect` in the content).
- **Placeholder names** for the properties §13.4–13.5 describe without naming (see Q88).

## 2026-11-01 (implementation, Milestone 2b: items) — implementer
- **Item bases are content** (`content/items.json`, 32 bases: 13 weapon types, throwing knives, three shields, light/medium/heavy armor for each of the four slots, and three accessory kinds). A weapon's `power` is an index (Sword = 100) on the enemy power block at the item's level (6 + 3L + 0.1L², §14.2); armor's defense is its class weight (0.5/1/1.5) × slot share (head .2, body .4, arms .2, legs .2) × the defense block (1 + L + 0.08L²). So a Fine sword and full armor at level L keep pace with enemies of level L. Tier multiplies both (Crude 0.9 … Relic 1.3) and each dent takes a tier step off.
- **Item level (`ilvl`) is a stored number on each item**, set when it drops or is bought; the spec gives tiers but not how stats grow with the expedition, and this keeps old gear falling behind as the campaign gets harder. Reading taken: drops will be minted at the expedition's level (Milestone 4).
- **Starting kit**: every Scion promoted at campaign start gets a Crude weapon of their Job's first weapon type and Crude body and head armor of their Job's class (heavy-armor Jobs start in medium: plate is earned). Recruits promoted later get the same kit (wired in when promotion is a move).
- **Carry**: 10 + Might/2; each point of weight over it is −1 Evasion (§13.1 says over-carry slows; the exact penalty is a first pass in `tuning.items`).
- **Gear is visible**: what any visible Scion wears is public; a House's unworn items (its stash) are seen only by that House.
- **Saves are version 2**: people and items are packed as varint strings (codec.ts). The crowded Year-20 test fixture (4 Houses, 12 veterans each in full Fine-to-Relic gear, 16 spare items each) is 38.7 KB of 64 KB.

## 2026-11-01 (implementation, Milestone 2) — implementer
- **XP is flat: 100 per level**, cap 30. First pass: 15 XP a battle won and 60 for finishing an expedition (about 1.3 levels a Year, so a Scion on most expeditions reaches the mid-20s by Year 20, §7.2); JP per §12.1. All in `tuning.progression`.
- **Job multipliers apply to the stats everything else reads**: MP, Sanity, HP, Durability, Evasion and resists come from the multiplied stats, then the Job's HP or MP multiplier (§7.3 "× Job HP mult").
- **Jobs are content** (`content/jobs.json`): multipliers, Speed bonus, permitted weapon types (with `:1h`/`:2h`), heaviest armor class, shields, prerequisites, and the innate and mastery passives. Passives with a plain number (Stalwart, Bulwark, Iron Body, Warfare Veteran, Attunement, Ironhide) carry `mods`; Oath and Warded put Protect or Shell on at battle start. The rest are rules that arrive with their sub-systems.

## 2026-11-01 (Q86 answered) — Josh
- **Lightning is part of Wind.** There are six elements (Holy, Dark, Fire, Water, Earth, Wind). Lightning creatures, spells and the pools' "weak Lightning" use Wind. → SPEC §7.3, §14.5 (read "Lightning" as Wind)

## 2026-11-01 (implementation, Milestone 1) — implementer
Combat-core readings; numbers are in `tuning.ts` (`combat`, `formulas`, `enemies`).
- **Clock scale.** One clock step adds Speed to CT and counts every duration down by **10 ticks**, so a status of 300 ticks lasts about three turns at Speed 10 (§10.8's "per 50 ticks" pulses fall every fifth step). Charges count the same ticks: a 100-tick charge resolves about one turn later at Acuity 0.
- **Melee is row-bound** (§10.3): enemy melee reaches the front-most Scion in each row it occupies; an empty Front in that row exposes Middle, then Back. Scion melee from Middle reaches only E1–E2; from Back it needs a reach weapon. Flyers reach anyone in their rows. So formation is per row: a Back Scion with nobody in front of them in their row is a melee target.
- **Single-target weights** (§10.3): pick a column 45/35/20 (Back-heavy 20/30/50 for `lob`) among occupied columns, an empty column's weight passing to the next one back; then a combatant in it, Provoke ×3.
- **Spells** hit on 90 + 0.5 × Sagacity (Evasion does not apply) and are reduced by the target's 0.5 × Sagacity % (§7.3). Spells carry their own power (`base`); weapon abilities use the weapon's. Enemies scale both by their level factor and have no Sagacity, so only affinity and Shell reduce spells against them.
- **One injury roll per hit.** HP 0 rolls on the hit's location at −1 step (and the Scion goes Down); otherwise a location reaching 0 Durability rolls, at −1 more if it was already Broken (§7.4); then the Resilience check. A telegraphed hit that names a location is −1 step; Defend +1. A Down Scion caught by an AoE rolls on each hit (§10.9). Sanity at 0 rolls on the Sanity table, then the Sagacity check.
- **Last Stand** Scions take no further rolls, and dropping to 0 HP kills them (they were dying at the battle's end anyway, §11.4).
- **Lost turns:** Knockdown and Skip end the next turn and cost 100 CT; Stun, Sleep and Stop freeze CT.
- **Movement** happens before the action in bot plans. A melee combatant with nothing in reach closes in on the nearest foe's rows and Waits.
- **Enemy `stats` replace the role's multipliers** (the §14.1 Hollow Soldier's `hp 1.6 … eva 0.6` are the bruiser's); an enemy that names none takes its role's. Content writes an enemy ability's `side` as `"player"` (§14.1); the rules read that as its foe.
- **Enemy Power follows the formula** (6 + 3L + 0.1L²): 23.5 at L5 and 46 at L10 where §14.2's table shows 23 and 43.
- **Elements are the six of §7.3 and the Glossary** (Holy, Dark, Fire, Water, Earth, Wind). Lightning is Wind (Q86, answered).
- **Stand-in gear for the simulator** (`combat/fixtures.ts`): weapons and armor scaled to the expedition level each party is built for, until Milestone 2's items. Nothing in it is content.
- **First balance run** (`npm run sim`, a 4-Scion party at level 3L against a Barrows Warband, 300 battles each): L1 is on §14.2's target (all wins, 20% HP lost, 4.5 turns per Scion, 0.1 injury rolls a battle). The rolls climb with level (1.1 at L3, 3.7 at L7, 6.3 at L10) and L10 parties lose 19% of Warbands, because enemy damage grows about five times from L1 to L10 while Durability has no level term. See Q87; `formulas.durabilityPerLevel` is the knob (0 as specified).

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

Batches 1–12 (answered 2026-10-31 / 2026-11-01): Q1–Q84 closed, see above. Q86 and Q88 answered 2026-11-01. The design is handed off; see HANDOFF.md.

- **Q85 (asked 2026-11-01, Milestone 0): how is a House's Standing tier worked out?** §3.4 names the four tiers (Waning / Steady / Rising / Ascendant) but not the rule, and it decides how much the other Houses can read. Built as the default, PROPOSED: a House's Ascendancy divided by the kingdom's mean, Waning below 0.75, Steady 0.75–1, Rising 1–1.25, Ascendant 1.25 and up; Steady when solo or before anyone scores. Alternatives: tiers by rank (the leader is always Ascendant, which tells everyone who leads), or fixed Ascendancy thresholds that rise with the Year (tiers say how well a House does, not how it compares).
- **Q87 (asked 2026-11-01, Milestone 1): should Durability grow with level?** The simulator finds injury rolls in an ordinary fight climbing from 0.1 at L1 to about 6 at L10, because §7.3's Durability (10–15 + 1.5–2 × a stat) grows slowly while enemy damage grows about fivefold. A level term (+1 or +2 Durability per level on every location) brings L10 to about 2–3 rolls; heavier armor in Milestone 2 may do the rest. Built as specified (no level term) until Josh decides; `formulas.durabilityPerLevel` is the knob.


Implementation items (not design questions):
- LPC sprite runtime: the folder holds one exported male base; runtime recruit generation needs the generator's full layer set exported with its per-layer `CREDITS.csv`.
- Oryx: confirmed free to use by Josh (2026-11-01); the credit line in CREDITS.md stands.
