# The Sovereign Pact — Game Design Spec

Status: **v1.0 handoff draft** (2026-11-01). Every section has been reviewed with Josh (batches 1–12). Living document, built section by section with Josh.
Companion files: [GLOSSARY.md](GLOSSARY.md) (canonical terms), [DECISIONS.md](DECISIONS.md) (dated decision log), [CREDITS.md](CREDITS.md) (asset authors and licenses), [HANDOFF.md](HANDOFF.md) (the implementer's starting note: build order, budgets, tests).

**Audience:** the implementing model/engineer. Where the spec is silent, follow the pillars in §1 and ask rather than invent.

**Tags used throughout**
- **[DECIDED]** Josh stated or approved it. Implement as written.
- **[PROPOSED]** Drafted by the spec writer, awaiting Josh's yes/no. Do not implement until it flips to DECIDED.
- **[OPEN]** Question not yet answered. Listed again in §18.

---

## 1. Vision and pillars [DECIDED]

The capital of a kingdom, together with each player's Great House, is torn through a rift into a hostile dark-fantasy otherworld. Each player leads one Great House. The Houses must cooperate to survive, yet each is quietly scored on its own standing, and the strongest becomes Sovereign if the kingdom endures.

1. **Co-op first, ambition second.** The campaign is won or lost together. If it is won, everyone wins, and the House in the strongest position becomes ruler and "wins more". If the kingdom falls (infighting or being overwhelmed), everyone loses.
2. **Hidden standing.** Each House's exact score is visible only to its own player (initially).
3. **Very challenging.** Combat is brutal; difficulty assumes players exploit job/equipment synergies as expedition level rises. Clever tactics, and occasionally luck, are required.
4. **Grim, grotesque, mysterious.** Dark fantasy tone; suspicion is usually warranted (the perfectly laid banquet), but boldness, recklessness, caution and cleverness are each sometimes rewarded. Rare moments of hope or joy provide contrast.
5. **Everything feeds everything.** House traits shape recruits; recruits' traits shape events; injuries and trauma unlock events; events alter the settlement; and so on. Systems should cross-reference each other.
6. **Deep customization.** Houses should almost never resemble each other.
7. **Lots of content.** Especially expedition events: "A LOT OF EVENTS", including re-flavored variants of the same mechanics.
8. **Animation and color for everything.** Every action has a visual and a sound.

## 2. Platform and players [DECIDED]

- Playable in a web browser. 1–4 players, one Great House per player. Multiplayer. Campaign resume and save/load.
- Will later run natively on **Vibe Pulse** and use its rooms and seats. See §4.
- **No AI-run Houses.** The game scales with the number of Houses in play (§4.3). Bots exist only to stand in briefly for a disconnected player (Vibe Pulse requirement), not as rival Houses.

## 3. Campaign structure, winning and scoring

### 3.1 The Year [DECIDED]

A turn is one Year. [PROPOSED step names and order:]
1. **Omens** — settlement-wide events and House events are drawn and resolved (some carry decisions, including Crises, §3.5).
2. **Settlement Phase** — all players act at once: build, recruit, promote, train, craft, shop, trade, negotiate, pledge to shared projects. Each player presses *Seal the Year*; the phase ends when all have sealed.
3. **Expedition Phase** — choose an expedition (§3.2), nominate the party, choose the Expedition Leader, depart. Event chain, then boss.
4. **Reckoning** — injuries tick down, upkeep is paid, delayed consequences (e.g. sanity incidents) are queued into next Year's timeline, and each House privately sees its score change.

**Length [DECIDED]:** a full campaign is **20 Years**, and that is the default and the mode balanced first. A Short campaign of 10 Years (compressed milestones) is offered as the exception.

### 3.2 Expedition types [DECIDED]

- **Mandatory expeditions** are do-or-die. They are fixed points in the campaign timeline.
- **Resource expeditions** are optional and yield building materials, crafting materials for gear, and unlocks for item shops. Shops themselves must also be built in the settlement.
- [DECIDED] A mandatory expedition **can be failed**. Failure does not end the campaign by itself (except Year 20's), but is devastating for the settlement (§3.3).
- [DECIDED, batch 11] Mandatory expeditions fall at fixed Years (5, 10, 15, 20; the arc in §14.7) and are announced in the timeline at least 2 Years ahead with ominous foreshadowing. Year 20's is the assault on the source of the rift.
- [DECIDED] **One expedition per Year.** Other able Scions may be sent on a **Sortie**: a gambit-driven auto-battle foray for a little XP, JP or resources (§6.11).
- [DECIDED, batch 11] **Forced expeditions.** Rarely, a settlement event forces an expedition this Year (the source of a raid must be burned out; a recruit was taken; the well's sickness has a nest). The Rift Gate then offers only that card, at the Year's band, and it counts as mandatory for the Year with lesser stakes: failure ruins one building, costs Accord (or Unrest) −10 and adds Doom +10. [PROPOSED limits] At most two per campaign, never in a Year that already has a mandatory expedition, never before Year 3, and the Watchtower foreshadows it one Year ahead.

### 3.3 Winning and losing [DECIDED: win together; infighting or being overwhelmed = loss]

- **Accord** [DECIDED, to be playtested]: shared 0–100 track of trust between the Houses, visible to all. Falls when Crises fail, deals are broken, Wards betray, certain votes go badly. At 0 the Houses turn on each other: campaign lost. Active with 2+ Houses.
- **Unrest** [DECIDED for solo]: with one House, Accord is replaced by Unrest, the common folk's patience with their lords. Same 0–100 scale and the same triggers that apply without other Houses (failed Crises, famine, atrocities in events); at 0 the people revolt: campaign lost.
- **Failed mandatory expedition** [DECIDED: survivable but very bad]. [PROPOSED consequences] The settlement suffers a Devastation: 1–3 buildings ruined, a share of stores lost, the next Year's recruit arrivals cancelled, Accord (or Unrest) −20, and +25 Doom.
- **Doom** [DECIDED, numbers to tune]: 0–100, visible to all. +2 each Year, +25 per failed mandatory expedition, + from Calamity-band Crises; − from certain shared projects and triumphant expeditions. At 100 the city is overwhelmed: campaign lost.
- Lost if every House is extinct (no usable Scions, Retired included) when a mandatory expedition departs.
- Won by completing the Year 20 mandatory expedition.

### 3.4 Scoring [DECIDED]

A House's **Ascendancy** is the sum of eight categories, each House's exact total visible only to that House:

| Category | Earned by |
|---|---|
| Lineage | Living Scions and recruits, their quality, heirs, Wards hosted |
| Valor | Bosses slain, expeditions attended/led, monsters killed by your Scions |
| Treasury | Wealth held at campaign end |
| Holdings | House buildings and estates |
| Lore | Artifacts, discoveries, bestiary entries |
| Renown | Contributions to shared projects and Crises, lives saved, votes won (so co-op play also scores, just less) |
| Intrigue | Favors owed to you, secrets learned, deals honored |
| Relics | Unique items held at campaign end |

- Each House secretly draws an **Ambition** at creation that doubles one category and halves another, so rivals cannot compute each other's score from visible facts.
- Other players see only a rough **Standing** tier for each House: Waning / Steady / Rising / Ascendant.
- On victory, the highest Ascendancy becomes **Sovereign**. On defeat, nobody wins.

### 3.5 Co-op versus self-interest, and subtle sabotage [DECIDED]

- Shared projects are more economical per resource than solo House projects, but credit contributors only through Renown. [PROPOSED ratio: about 1.5x]
- No direct House-vs-House combat.
- **Subtle sabotage via withholding.** Settlement events that need the Houses' help (**Crises**) let each House contribute less than its fair share to keep resources, or to gain gear or other advantages. Withholding makes the outcome worse. It is **invisible** to other Houses; they may only suspect.
- **Deniability:** a Crisis can fail even when everyone contributed fully, so a failure never proves anyone withheld.

[DECIDED Crisis resolution, numbers to tune]
1. The Crisis shows a Need (e.g. 40 Timber + 20 Grain) and a few outcome bands.
2. Each House pledges privately; pledges are revealed only as a total.
3. Result = total pledged ÷ Need, adjusted by a hidden random swing (roughly ±20%) and modifiers (traits, buildings, Scions in town).
4. Bands: ≥100% Triumph, 75–99% Holds, 50–74% Falters, <50% Calamity. Lower bands cost Accord and cause harm (buildings damaged, recruits lost, unrest).
5. Some Crises offer a private temptation (e.g. "the quartermaster offers to look the other way"): withhold and gain an item.
6. Leaks: a Ward hosted by another House, certain buildings, or events can reveal a House's exact pledge to someone else. This is the only way withholding becomes known.

## 4. Multiplayer, saves and Vibe Pulse

### 4.1 Findings from the Vibe Pulse code (GitHub `tetrahorizons/vibe-pulse`, main at 3556fb4, 2026-10-31)

Note: Josh's local checkout is from 2026-10-18 and is stale; these findings come from the current GitHub copy.

- Stack: npm workspaces monorepo, Node 22, TypeScript strict. `client/` React 19 + Vite; `server/` Express 5 + Socket.IO; `shared/` pure TS (no DOM/Node APIs).
- Every native game implements `GameDefinition<State, Move, View>` (`shared/src/game.ts`): `setup`, `applyMove`, `activePlayers` (several players for simultaneous turns), `result`, `view(state, playerId)` (must hide hidden info), `botMove`, plus optional `lobbyChoice`, `options`, `achievements`, `progress`.
- **Server-authoritative**: moves are applied only on the server. State is plain JSON. No `Math.random` or clock reads; randomness comes from the seeded `Rng`.
- A dropped player keeps their seat for 30 s, then a bot takes over, so every decision point needs a `botMove` (it can be simple and cautious).
- Co-op loss is reported as `{kind: "win", winners: []}`; per-seat `score`/`placement` exist, which fits Ascendancy and the Sovereign.
- **Saves** (`docs/decisions/2026-10-18-saves.md`): a game returns a JSON save from `checkpoint(state)` at rest points; `setup(..., save)` resumes it; `describeSave` gives a one-line summary. One save per account and game (the host's), **max 64 KB**, versioned, no player ids inside. A redeploy drops play back to the last checkpoint.
- **Precedent: Hardpoint Contract** (Josh's own game, `b0ttlep0ppin/hardpoint-contracts`) is ported natively and synced from its own repo with `npm run sync:game` (`docs/decisions/2026-10-21-hardpoint-contract-ported-natively.md`). It checkpoints between missions (its "port" phase) and also has save codes. It credits Pixabay music and BOOM Library cuts in a `credits.ts`.
- **Release gate** (`docs/decisions/2026-10-22-quality-gate-for-new-games.md`): design doc on `docs/templates/game-design.md`, a quality checklist (sound for every action, 16-bit art at a 480×270 view, bots that feel like players…), a recording, and a playtest before listing. Also required: `howto.ts`, 6–12 achievements, `emblem.svg`, e2e move-picker, cover art.

### 4.2 Architecture [DECIDED: Vibe Pulse shape from day one]

- All rules are a pure TypeScript reducer over JSON state with seeded RNG, in the `GameDefinition` shape. The standalone web build is a thin host around the same module.
- [DECIDED] Follow the Hardpoint Contract model: the game lives in its own repo (e.g. `b0ttlep0ppin/sovereign-pact`) and is synced into Vibe Pulse natively.
- Hidden information (exact scores, pledges, Ward intel, unrevealed recruit potential) lives only in each player's `view()`.

### 4.3 Scaling with House count [DECIDED: scales with Houses in play; no AI Houses]

[PROPOSED] Values scale by House count H (1–4):
- Party size stays 4 (or 8); each House fields roughly 4/H Scions per party, so a solo House fields all 4.
- Starting recruits, recruit arrival rate and yearly income scale so total kingdom manpower is similar at any H.
- Crisis Needs and shared project costs scale with H.
- Accord is replaced by Unrest when H = 1 (§3.3).

### 4.4 Simultaneity, control and saves [PROPOSED]

- Settlement Phase: simultaneous; every player is active until they seal.
- Expedition events: each decision resolves by that event's resolution rule (§9).
- Combat: when a Scion's CT reaches 100, its owner acts; others watch. Optional host turn timer (off / 60 s / 30 s); on timeout or disconnect the bot acts cautiously.
- **Checkpoint** at the start of each Settlement Phase (every Year). The save must fit 64 KB, so store content by id (events seen, items, traits), not text. Standalone web build: autosave each phase plus export/import file.

## 5. House creation

[DECIDED, from the brief] Name, traits that shape recruits' stats and growths, elemental affinity, macabre traits, emblem, color, seat aesthetic, Settlement theme song, base recruit appearance, Flavor/Crunch display, and enough options that two Houses rarely match. Everything below this line is **[PROPOSED]** unless tagged.

### 5.1 Creation steps (one screen per step, Back always allowed)

1. **Name and motto.** House name (2–24 chars), optional motto (≤60 chars). Both pass the Vibe Pulse profanity filter.
2. **Colors.** Primary and secondary House color from a 24-swatch palette (dark-fantasy friendly, all WCAG-legible on the UI). Two Houses in one campaign may not share a primary color; later pickers see taken swatches greyed out.
3. **Emblem** (§5.4).
4. **Seat** (§5.5).
5. **Elemental affinity** (§5.6).
6. **Traits** (§5.7) [DECIDED]: 2 Major Traits, 2 Minor Traits, 1 Major Flaw, 1 Minor Flaw, or a Bloodline in place of one Major Trait and the Major Flaw.
7. **Ambition** [DECIDED]: deal 2 secretly, the player keeps 1 (§3.4).
8. **The look of your line** (§5.8): appearance weights for generated recruits.
9. **Theme song** (§5.9).
10. **Review**: a summary card of the House, then *Swear the Pact*.

A **Random House** button fills every step (themed, not uniform noise), and each step has its own dice button.

### 5.2 Flavor Mode / Crunch Mode [DECIDED]

- A **table option** set by the host before House creation, applying to everyone for the whole campaign.
- **Flavor Mode:** trait cards show the name and a line of evocative text only. Exact numbers stay hidden all campaign; tooltips speak in words ("your blood runs hot").
- **Crunch Mode:** cards show the same text plus exact effects. All numbers are visible everywhere.
- Same rules either way; only the display changes. Every trait therefore needs both a `flavor` and a `crunch` string in content data.

### 5.3 How traits feed the rest of the game

Every House trait is data with any of these effect kinds, so other systems can read it:
- `recruitStatBase` / `recruitGrowth`: added to every recruit generated for the House (and its Wards' children, if lineage ever matters).
- `recruitInnateTraitWeights`: raises or lowers the odds that recruits roll specific individual traits.
- `resist` / `elemental`: ailment resistance % and element % for recruits.
- `appearanceTags`: weights for the sprite generator (§5.8).
- `economy`: income, upkeep, build or craft cost modifiers.
- `eventTags`: tags events can test ("Scions from a House with `seafaring`…"), unlock or block events, and resolution criteria can target.
- `injuryTable` / `sanityTable`: roll modifiers per location.
- `jobXp`: XP rate modifiers per Job.

Numbers below are first-pass and assume the stat scale is set later (§7); "growth" means growth-rate per level.

### 5.4 Emblem designer [DECIDED scope]

A heraldry builder rendered from layers (SVG in UI, pre-baked pixel sizes for sprites):
- **Shield shape** (6): heater, round, kite, banner, lozenge, skull-plate.
- **Division** (12): plain, per pale, per fess, per bend, per bend sinister, quarterly, per saltire, chevron, pall, bordure, chief, checky.
- **Tinctures:** field colors from the House's two colors plus black, bone, blood, gold, silver.
- **Charge** (≥40 icons, one main, optional small secondary in a corner): wolf, raven, stag skull, serpent, moth, spider, eye, open hand, severed hand, rose, thorned crown, crown, tower, gate, key, bell, chalice, candle, sun, eclipse, crescent, star, comet, sword, crossed swords, axe, spear, hammer, lantern, book, quill, hourglass, mask, antlers, horned skull, tree, dead tree, wave, flame, mountain, anchor, chain, heart, dagger-through-heart.
- **Overlay in game:** a House-colored ring under each Scion's feet in battle; the Scion's tabard or cloak layer tinted the House primary color; the emblem stamped (8×8 px) on tabard chests where the LPC layer allows; full emblem on portraits, turn order, party roster, buildings, banners on the Town Map and the House's Standing card.

### 5.5 Seat (the House's home) [DECIDED: an advantage and a drawback each (Josh, 2026-11-02); the numbers are PROPOSED]

The Seat is the look of the House's home on the Town Map and in House screens, and the backdrop of House events. Josh (2026-11-02) asked for "pros and cons to each type of household" (this replaces "purely cosmetic"). Each Seat has a short flavor line, its own silhouette and layout of building plots on the Town Map, **one advantage and one drawback**. The numbers are first pass, held as content in `content/seats.json`.

| Seat | Flavor | Advantage | Drawback |
|---|---|---|---|
| Keep | "Grey stone, narrow windows, no surrender." | Starts with a Training Ground | Everyone's max Sanity −5% |
| Chateau | "Gilded halls built on older, darker cellars." | Gold income +10% | House events +12 points (troubles at home a quarter more often) |
| Manor | "Ivy, hounds and a long table." | One more recruit at the start | Gold upkeep +10% |
| Abbey | "Bells at every hour, and something under the crypt." | Starts with an Infirmary | Gold income −10% |
| Spire | "A tower that hums when the stars align." | Starts with a Scriptorium | Everyone's max HP −5% |
| Catacomb Hall | "The house above is modest. The house below is not." | The Retired cost no upkeep | House events +12 points |
| Longhall | "Smoke, mead, oaths sworn on old iron." | Starts with a Forge | Gold upkeep +10% |
| Harbor House | "Salt-stained, half on the water." | Shop prices −10% | 5% of the House's stores spoil each Year |

### 5.6 Elemental affinity [DECIDED numbers]

Elements are three opposed pairs: Holy/Dark, Fire/Water, Earth/Wind. The House picks one element or Unaligned:
- **Aligned:** recruits get +25% resistance to the chosen element and −25% (a weakness) to its opposite; spells of that element cost 10% less MP for them. Recruits also roll elemental individual traits of that element more often.
- **Unaligned:** no strengths or weaknesses; +5% to all ailment resistances.

### 5.7 Traits [DECIDED structure; lists PROPOSED]

Rules:
- Pick 2 **Major Traits**, 2 **Minor Traits**, 1 **Major Flaw**, 1 **Minor Flaw**.
- Or take one **Bloodline**, which fills one Major Trait slot and the Major Flaw slot (its drawbacks are the flaw).
- No duplicates within a House. Different Houses may share traits, though the number of combinations makes full matches unlikely.
- Each list below is a starting set for review; target sizes for content: 20 Major, 30 Minor, 15 Major Flaws, 20 Minor Flaws, 10 Bloodlines.

#### Major Traits

| Name | Flavor | Crunch |
|---|---|---|
| Sun-Blessed | "Dawn finds them first, and lingers." | Holy +20%; Sagacity growth +10%; Blind resist +25%; recruits favor fair hair and gold eyes |
| Favors the Night | "They were never afraid of the dark. The dark is afraid of them." | Dark +15%; Evasion +5%; Guile growth +10%; night-tagged events offer an extra option |
| Students of the Arcane | "Every child learns the words before they learn to walk." | Acuity growth +15%; max MP +10%; Magus, Conjurer, Abjurer Job XP +15% |
| Iron Discipline | "Ranks hold. Ranks always hold." | Resilience growth +10%; Wait/Defend costs 50 CT instead of 60 |
| Martial Lineage | "Every portrait in the hall holds a blade." | Might growth +10%; Arms Durability +15%; Soldier, Knight, Ravager, Sword Saint Job XP +15% |
| Old Blood of Kings | "Their claim is older than the throne." | Recruit pool +1; Charm resist +25%; Lineage score +10% |
| Forge-Born | "Soot in the cradle, sparks at the wedding." | Fire +15%; crafting costs −15%; Might growth +5% |
| Silver Tongues | "They never lie. They never need to." | Intrigue score +10%; your Crisis pledges can never be leaked; persuasion-tagged events resolve in your favor more often |
| Salt in the Veins | "Born on decks, buried at sea." | Water +20%; Legs Durability +10%; sea and drowning events offer an extra option |
| Hunters of the Deep Wood | "They hear the forest breathe." | Wind +15%; bow and thrown weapon accuracy +10%; Legs Durability +10% |
| Faithful of the Pale Saint | "Their prayers are answered. Not always kindly." | Sanity +20%; mental ailment resist +15%; Soothsayer Job XP +15% |
| Long-Lived | "Grandmother fought in the war before the last war." | Mentors teach 50% faster; injuries heal 1 Year sooner; Retired Scions keep their passives |
| Many-Branched Tree | "There is always another cousin." | +1 recruit arrival every other Year; recruit growths −5% |
| Lucky Star | "Fortune has a favorite, and it's them." | Tarot drawn twice, keep the better; crit chance +3%; Gambler Job XP +20% |
| Deep Coffers | "Old mines, older debts owed to them." | Income +20%; Earth +15% |
| Fleet of Foot | "Couriers, outriders, thieves." | 30% of recruits roll the innate trait Fleet (+1 Speed); move CT cost −10 |
| Unbroken | "Whatever happens, they get back up." | Injury table rolls +1 step on all locations |
| Beastmasters | "The kennels are larger than the house." | Conjurer summons +15% HP; beast-tagged events offer an extra option; Alterer beast forms last 20% longer |
| Patrons of the Guilds | "Every craftsman owes them a favor." | Shop prices −10%; shop unlocks one tier earlier for this House |
| Grim Physicians | "They have opened more bodies than any graveyard." | Healing received +10%; Body Durability +10%; Infirmary upkeep −50% |

#### Minor Traits

| Name | Flavor | Crunch |
|---|---|---|
| Fond of Wine | "A glass for courage, a bottle for grief." | Poison resist +25%; Sanity recovers +1 step per Year in town |
| Keen-Eyed | "Nothing escapes their notice." | Accuracy +3% |
| Stout | "Built like the walls of their keep." | Body Durability +10% |
| Hardy Stock | "Plain food, hard winters, long lives." | Max HP +5% |
| Light Sleepers | "One eye open, always." | Sleep resist +30%; ambush events: your Scions act first |
| Scholarly | "The library has more doors than the house." | Insight buildings cost −20% |
| Pious | "They pray before every meal and every killing." | Holy +10%; Sanity +5% |
| Thrifty | "Waste is a sin, and so is generosity." | Upkeep −10% |
| Herbalists | "Every garden bed is medicinal. Mostly." | Consumable healing +20% |
| Duelists | "First blood settles most arguments." | Counter chance +5% with a one-handed weapon |
| Iron Stomach | "They have eaten worse." | Food and feast events never poison them; Poison resist +10% |
| Cold-Blooded | "Calm when the roof is on fire." | Stun and Fear resist +15% |
| Night-Eyed | "They see by starlight." | Blind resist +30%; no accuracy penalty in darkness |
| Steady Hands | "Patient as a surgeon." | Crit +3% with knives and ranged weapons |
| Beloved of the Common Folk | "The people would bleed for them." | Crisis hidden swing shifts +5% in your favor when you pledge fully |
| Well-Traveled | "They have seen stranger things than this." | Once per expedition, reveal one hidden event outcome |
| Musical | "Every Scion can carry a tune." | Minstrel Job XP +20%; Deaf resist +25% |
| Tinkerers' Blood | "They take apart clocks for fun." | Tinkerers start battles with +1 Component |
| Dicers | "They bet on everything, including you." | Gambler dice: one reroll per battle |
| Horse-Lords | "They ride before they walk." | Travel and pursuit events offer an extra option; escape checks +20% |
| Grave-Keepers | "They know every name in the cemetery." | Death-tagged events offer an extra option; Sanity loss from corpses −50% |
| Ink and Seal | "Every bargain is written down." | Your deals are always public and count double for Renown; your Wards' Loyalty swings are halved |
| Hound-Loyal | "Their servants would die for them, and have." | Wards placed with you are 20% less likely to leak intel |
| Sure-Footed | "They have never fallen. Not once." | Knockdown and Slow resist +25% |

#### Major Flaws

| Name | Flavor | Crunch |
|---|---|---|
| Cursed Line | "Something was promised, long ago." | Each Year, 20% chance a random Scion gains a Curse trait |
| Brittle Bones | "They break like dry kindling." | Arms and Legs Durability −20%; injury rolls on those locations −1 step |
| Haunted Halls | "The house is never empty." | Sanity −15%; extra haunting House events |
| Poor Lands | "Thin soil, thinner harvests." | Income −20% |
| Sickly | "Coughs that never quite go away." | Poison and Disease resist −30%; max HP −5% |
| Craven Legacy | "Their grandfather ran. Everyone remembers." | Fear resist −30%; Valor score −10% |
| Debt-Ridden | "The creditors followed them through the rift." | Start with a debt; interest each Year until repaid; default costs a building |
| Bad Blood | "No one trusts them, and they know it." | Recruit pool −1; Wards you give arrive Distrustful |
| Hot-Blooded | "Every insult is answered in blood." | Berserk and Confuse resist −30%; some events force the bold option |
| Elemental Bane | "One element hates them." | Pick an element: −50% to it (stacks with affinity) |
| Hubris | "They were born to lead. They insist on it." | When your Scion is Expedition Leader, negative leader-targeted outcomes are worse |
| Feud | "A rival family followed them into the dark." | Assassination and sabotage House events target you |
| Barren | "The cradles stay empty." | Recruit arrivals every other Year only; recruit growths +5% |
| Faithless | "No god has ever answered them." | Holy −20%; blessing events offer you fewer options |
| Hollow Hearts | "They feel little, and show less." | Sanity +10% but Sanity never recovers in town; only events and buildings restore it |

#### Minor Flaws

| Name | Flavor | Crunch |
|---|---|---|
| Vain | "Every Scion owns a mirror." | Disfiguring injuries also cost Sanity |
| Superstitious | "Salt on the sill, iron over the door." | Tarot has a 25% chance to be Reversed (inverted effect) |
| Proud | "They do not take charity." | Accepting a Ward or loan costs Accord |
| Gluttonous | "The larders are always empty." | Upkeep +10% |
| Slow to Wake | "Late to every battle." | Scions start battles at −20 CT |
| Squeamish | "They faint at the sight of blood." | Sanity loss from gore events +50% |
| Restless | "They hate waiting." | Recruits idle 2 Years may leave |
| Insular | "Outsiders are not welcome." | Mentor loans to or from you cost double |
| Sun-Shy | "Pale, and pained by daylight." | Holy −10%; day-tagged events cost a little Sanity |
| Loud | "You hear them before you see them." | Stealth and ambush event options are worse |
| Light-Fingered Servants | "Things go missing." | Lose a small amount of stores each Year |
| Heavy-Handed | "They break more than they mend." | Crafting failure chance +10% |
| Grudge-Holders | "They never forget." | Whenever your House loses a vote, your Scions in town lose 5% Sanity that Year |
| Drunkards | "Fond of wine, and then some." | Accuracy −10% for the first 200 ticks of each battle; Sanity +5% |

#### Bloodlines (macabre; replaces one Major Trait and the Major Flaw)

| Name | Flavor | Crunch | Look |
|---|---|---|---|
| Demon-Blooded | "A bargain sealed in the family's blood." | Dark +30%, Fire +15%; Might and Acuity growth +10%. Holy −40%; holy-faction events turn hostile; possession events can target your Scions | Horns, red or ashen skin, ember eyes |
| Grave-Touched | "Their dead don't stay buried. Neither, quite, do they." | Dark +40%; Poison and Death resist +50%. Healing received −25%; no natural HP regeneration on expeditions | Pallid or grey skin, sunken eyes; rare skeletal features |
| Fae-Changeling | "Not every child in the nursery is theirs." | 50% of recruits roll Fleet; Charm resist +50%; Wind +20%. Cannot wear heavy armor; changeling events may swap a recruit | Pointed ears, odd-colored eyes |
| Wyrm-Blooded | "Scales under the skin." | Max HP +15%; Fire +25%. Relics can never leave the House (no gifts or trades); Treasury upkeep +10% | Scaled patches, slit pupils, rare small horns |
| Moon-Cursed | "On certain nights, the hounds don't bark at them. They flee." | Alterer werewolf form for any Scion as an innate ability; Might growth +10%. Full-moon events: chance of uncontrolled frenzy in town | Wolfish features, rare tails |
| Hollow-Eyed Seers | "They see what's coming. It doesn't help them sleep." | Once per event, preview one outcome; Acuity growth +15%. Sanity −25% | Pale eyes, eye-markings |
| Sanguine | "They drink to their health. Not wine." | Melee attacks drain 5% of damage as HP. Holy −40%; daylight events cost HP | Very pale skin, red eyes |
| Drowned God's Kin | "Promised to the deep before they were born." | Water +40%; Sanity +10%. Fire −30%; the sea calls: drowning events target you | Blue-grey skin tints, gill marks |
| Nephilim | "Something winged knelt in their family chapel." | Holy +40%; healing dealt +15%. Dark −40%; refuse surrender and retreat options in events | Radiant eyes; rare small wings |
| Hive-Touched | "The house hums at night." | Poison resist +50%; summons +1 per cast. Sanity −15%; insect-tagged events target you | Chitin patches, black eyes |

### 5.8 The look of your line (recruit appearance)

Using the LPC Universal Spritesheet Character Generator layers:
- The player sets **weights**, not one fixed look: skin tone range, hair colors, hair styles, body types and sexes the House's recruits are drawn from (each a set of checkboxes or sliders).
- Traits and Bloodlines add **appearanceTags** that unlock non-human parts (horns, pointed ears, wings, tails, unusual skin colors). These are only available when a trait, bloodline, transformation or event grants them, never freely.
- Generated recruits roll their look from the House weights plus their own traits. Players can later restyle hair, beard, and clothes freely, and Job outfits follow the current Job, but body features stay as rolled or granted.
- [OPEN, implementation] The asset folder holds a single exported male base. The implementer must vendor the generator's full layer set (CC-BY-SA/GPL/OGA-BY art) and build a runtime compositor, keeping a credits list per layer used.

### 5.9 Theme song

Pick any track from the Sovereign Pact music folder as the House's Settlement theme. When several Houses share the Town Map, the music plays the theme of the House whose screen each player is looking at (each player hears their own; the shared Town Map view plays the host's or rotates per Year). Two Houses may pick the same track.

## 6. Recruits, Scions, Wards and the Retired

[DECIDED, from the brief] Recruit pool shaped by House traits (stats, growths, look); insight buildings reveal potential and traits; recruits arrive slowly; promotion to Scion; Wards with mixed loyalty; unique Scions from events; Retired Scions as Mentors, loanable, and fieldable again in a pinch; a House with nothing left is extinct. Everything below is **[PROPOSED]** unless tagged.

### 6.1 Lifecycle

```
Recruit ──promote──▶ Scion ──retire / maimed──▶ Retired (Mentor) ──reinstate──▶ Scion
   ▲                   │ gift                        │
   │ arrival           ▼                             ▼
 events, traits,     Ward (in another House)      Fallen (dead) ─ stays in the House chronicle
 buildings
```

### 6.2 Starting numbers and arrivals (scale with House count H) [DECIDED as a starting point]

| | H = 1 | H = 2 | H = 3 | H = 4 |
|---|---|---|---|---|
| Starting Scions per House (already promoted, level 1) | 6 | 3 | 2 | 2 |
| Starting recruits per House | 9 | 6 | 5 | 5 |
| Base chance of a new recruit per House per Year | 100% | 70% | 55% | 50% |

- Arrival modifiers: House traits (Many-Branched Tree, Barren…), a Hall of Petitions building (+25%), settlement events (refugees, a caravan), expedition events (a rescued prisoner joins). **Pool cap: 8** unpromoted recruits; extra arrivals are turned away (or, with Restless, leave).
- Each Scion costs **upkeep** each Year (gold and food). Retired Scions cost half. This, not a hard cap, limits House size.

### 6.3 The recruit record

Every recruit and Scion is one JSON record (kept small for the 64 KB save):
- `id`, `house` (birth House), `host` (current House, differs for Wards), `name`, `sex`, `look` (sprite layer ids), `age` (cosmetic, affects some event text).
- `base` six core stats, `growth` six growth rates, `level`, `xp`, `jp` per Job, `jobs` learned (abilities and passives by id), `traits` (individual trait ids), `tarot`, `affinity` (per element), `resist` (per ailment), `injuries` (with Years remaining), `sanity`, `mp` (persists), `gear`, `history` counters (kills, expeditions, heals done, times targeted… used by event resolution rules).

Generation: `base` rolls 8–12 per stat, then House `recruitStatBase` adds; `growth` rolls from a potential tier (Common 60%, Promising 30%, Gifted 9%, Prodigy 1%) and House `recruitGrowth` multiplies. Individual traits: 1–3 rolled from the trait table with House `recruitInnateTraitWeights`. Tarot: one card, hidden until promotion.

### 6.4 Insight [DECIDED]

What the player sees about a recruit depends on the House's **Scriptorium** level (or a loaned Seer):

| Level | Reveals |
|---|---|
| 0 | Name, look, age, one visible trait, a one-word impression ("sturdy", "sly", "frail") |
| 1 | Base stats and potential tier |
| 2 | Growth rates and all individual traits |
| 3 | Tarot and any hidden flaw (e.g. a Curse, a hidden Ward loyalty) |

Scions reveal everything once promoted except hidden flaws (level 3 still needed).

### 6.5 Promotion

- A Settlement action: costs gold and a ceremony slot (one promotion per House per Year, two with a Chapel). The new Scion picks a starting Job from the base set (§12), draws their Tarot face-up, and starts at level 1 (or higher if a Mentor trained them, §6.9).
- Promotion is permanent. Scions cannot be demoted to recruits.

### 6.6 Progression: XP and JP [DECIDED that both exist]

- **XP** → levels (stats via growths). From expedition events, Sorties (§6.11) and kills; level cap 30.
- [DECIDED, batch 11] **Training gives XP too**, so later recruits are not hopelessly behind the veterans. A Scion on the **Train** assignment (§8.3) gains XP for the Year, **capped at one level below their Mentor** (never equal to or above). [PROPOSED numbers] A Year of training under a Mentor gives 60% of a normal expedition's XP; without a Mentor, the Training Ground alone gives 30% and caps at three levels below the House's highest-level Scion. Training XP never raises a Scion above level 20.
- **JP** (Job Points) → buys a Job's actives and passives, per Job. Earned in the Job the Scion is currently in, at the same moments as XP, plus Mentor training.
- Reaching JP thresholds in one Job **masters** it (all abilities bought), which unlocks advanced Jobs (§12).

### 6.7 Individual (Scion) traits

Separate table from House traits; 1–3 at generation, more from events, injuries and transformations. Each has flavor and crunch text like House traits and `eventTags`. First set (target 60):

| Trait | Effect |
|---|---|
| Fleet | +1 Speed |
| Sluggish | −1 Speed |
| Brave | Fear immune; bold event options never penalize this Scion |
| Craven | Fear resist −30%; may refuse to be Expedition Leader |
| Thick Skull | Head Durability +25% |
| Glass Jaw | Head Durability −25% |
| Iron Lungs | Poison and Gas resist +30% |
| Bleeder | Bleed lasts twice as long |
| Berserker | At HP < 30%, physical damage +20% |
| Steady | Charging gives no evasion malus |
| Nightmares | Sanity does not recover in town unless an Infirmary tends them |
| Devout | Holy +15%, Dark −10% |
| Heretic | Dark +15%, Holy −10% |
| Ambidextrous | Dual wield penalty removed |
| Clumsy | Dual wield penalty doubled; 5% chance to drop a thrown weapon |
| Sharp | Accuracy +5% |
| Nearsighted | Ranged accuracy −10% |
| Lucky | Once per battle, reroll one failed injury roll |
| Doomed | Injury rolls −1 step; some events seek out this Scion |
| Scarred | Intimidation event options improve; Charm resist +20% |
| Beautiful | Charm-tagged events offer an extra option; some enemies target them more |
| Quiet | Stealth-tagged options improve |
| Loud | Stealth-tagged options worsen |
| Kindly | Soothing and healing effects they cast +10% |
| Cruel | Sanity damage they inflict +25%; Sanity loss from atrocities −50% |
| Curious | Explores: reveal extra options in mystery events; more likely to be chosen for "the curious one" |
| Veteran of the Rift | Gained after 5 expeditions: event resolution rules can target "the most veteran" |
| Touched by the Deep | Gained from sea events: Water +20%, Sanity −10%, dreams of the sea |
| Grafted | Gained when a limb is regrown by something: that limb is immune to injury rolls but Holy −20% |
| Cursed: <name> | From Cursed Line or events; each Curse is its own effect (Withering: growths −20%; Hunger: upkeep ×2; Shadow: Dark +30%, Sanity −20%) |

### 6.8 Tarot (22 Major Arcana) [DECIDED]

Dealt one per Scion at generation. A small bonus, and an `eventTag` ("the Scion who bears The Hanged Man") for event triggers and resolution rules. With the Superstitious flaw, 25% are dealt Reversed (effect inverted where meaningful).

| Card | Bonus |
|---|---|
| 0 The Fool | Evasion +3%; reckless options are more often rewarded |
| I The Magician | Max MP +5% |
| II The High Priestess | Sanity +10% |
| III The Empress | Healing received +5% |
| IV The Emperor | Allies in the same row: accuracy +2% |
| V The Hierophant | Holy +10% |
| VI The Lovers | +3% accuracy while adjacent to an ally |
| VII The Chariot | Movement costs 5 less CT |
| VIII Strength | Might +2 |
| IX The Hermit | Sanity loss −20% when no ally is adjacent |
| X Wheel of Fortune | Crit chance +2%; Gambler rolls: 7s count as 8s |
| XI Justice | Counter chance +5% |
| XII The Hanged Man | Injury rolls at HP 0 get +1 step |
| XIII Death | Once per campaign, survive a fatal injury result (becomes Devastating non-fatal) |
| XIV Temperance | Ailment durations −20% |
| XV The Devil | Dark +10%, Holy −10%; bargain events offer an extra option |
| XVI The Tower | Telegraphed attacks deal −15% to this Scion |
| XVII The Star | MP regen +1 per 100 ticks in battle |
| XVIII The Moon | Mental ailment resist +10% |
| XIX The Sun | Blind immune; Holy +5% |
| XX Judgement | Revival and redemption events favor this Scion |
| XXI The World | Passive budget +1 |

### 6.9 Wards [DECIDED model, numbers to tune]

- **Giving a Ward** is a Settlement deal between two Houses (any terms: gold, resources, a Mentor loan, facility use, or nothing). The Scion keeps their birth House traits, affinity and emblem; in the host's party they wear the host's color border with their birth emblem inside.
- **Loyalty** 0–100, hidden from both Houses unless revealed by Insight 3 (host) or a House event. Starts at 40 (20 if the birth House has Bad Blood; 60 with Hound-Loyal on the host side).
  - Each Year: +5 if the Ward was fielded with gear of at least the host's average quality; +10 if the host saved their life; −10 if they were injured on the host's expedition; −15 if the host fielded them while Retired, or withheld in a Crisis that harmed their birth House; +/− from events.
  - **Score split:** Valor and Lore the Ward earns count for the host at Loyalty% and for the birth House at (100 − Loyalty)%.
  - **Leaks:** at Loyalty < 50, each Year a 25% chance the birth House learns one secret of the host: exact treasury, exact Crisis pledge, Standing as an exact number, or the recruit pool.
  - **Sworn** at ≥ 80: fully the host's (no split, no leaks), may be gifted onward.
  - **Estranged** at ≤ 10: may defect back to the birth House between Years, or sabotage once (a Crisis pledge quietly halved).
- A Ward cannot be given back within 3 Years, and may never be given to a third House unless Sworn.
- With H = 1 there are no Wards; some events can grant a **Hostage** (an NPC House's Scion) with the same loyalty rules against an unseen House.

### 6.10 Unique Scions

Event-granted, always with a `unique` trait that no generation can roll, often a non-human look (§5.8). They count as the receiving House's Scions and may be Wards. First set, each with its own trigger event: a knight who is only armor (no Body injuries, no healing); a fallen angel (Holy +50%, Dark −50%, Nephilim-like refusal of retreat); a repentant ghoul (Grave-Touched kin, eats the dead for HP); a mirror-twin of an existing Scion; a child of the rift (random element each battle); an old war-dog in human shape (Alterer beast form innate).

### 6.11 Sorties (the second party's auto-battle) [DECIDED concept: "gambit" auto-battles for a second party for a little XP, JP or resources]

- One real expedition per Year. Any other able Scions (up to 4) can be sent on a **Sortie**: a short foray chosen from a small list (patrol the walls, hunt the marsh, escort a caravan, dig the old mine).
- Each Scion is given a **gambit list**: up to 3 rules in priority order from a menu ("Heal ally below 50%", "Attack the weakest", "Attack the nearest", "Defend when below 30% HP", "Use strongest MP ability if MP > 50%", "Hold the back row"…).
- The Sortie resolves as 1–2 simulated battles against low-tier enemies using the real combat rules with the gambits as inputs, followed by a short result card (XP, JP, resources, any injuries).
- Rewards are roughly 25% of an expedition's; injury risk is real but the tables are capped at Moderate.
- The same gambit engine drives a disconnected player's Scions in real combat, so Vibe Pulse's `botMove` is this engine. [See §4.4]

### 6.12 Retired Scions and Mentors [DECIDED: Retired Scions can always be fielded or taught with freely]

- A Scion becomes **Retired** when the player retires them (any time in town) or when a Devastating injury forces it (lost limb without a prosthetic, blindness, madness). Retired Scions keep their record and gear is returned to stores.
- **Mentor:** a Retired Scion assigned to a Training Ground teaches up to 2 students (recruits or Scions) per Year. Each student gains JP in a Job the Mentor has mastered (one Job per Year), and a recruit trained for 2+ Years is promoted at level 3 with a starting passive from the Mentor. Long-Lived doubles the rate.
- **Loans:** a Mentor may be loaned to another House for a Year as part of a deal (§3.5 deals cost Accord if broken).
- **Reinstating:** a Retired Scion can be fielded again at any time, on expeditions or Sorties, with their injuries' penalties in force (a one-armed Scion cannot use that hand's slot, a blind one has the accuracy malus, and so on). There is no gate and no cost beyond the risk; teaching is simply where most of them are most useful. "Retired" is a status the player sets, not a lock.

### 6.13 Death and extinction [DECIDED]

- Death is permanent. The Scion moves to the House **Chronicle** (name, deeds, cause of death), which feeds Lineage score (heroic deaths count a little) and haunting/resurrection events.
- A House with no Scions, no recruits and no Retired is **Fallen**. The player still plays: votes, pledges, deals, buildings and Treasury continue; they can receive a Ward or a recruit event to rebuild. Lineage score drops to 0 while Fallen. If every House is Fallen when a mandatory expedition departs, the campaign is lost.

## 7. Statistics and formulas

[DECIDED, from the brief] The stat list and what each stat influences (§7.1). **[PROPOSED]** scale and formulas (§7.2+), first pass, to be tuned in playtest. The implementer should keep every constant in one tuning table.

### 7.1 The stats

| Stat | Effects |
|---|---|
| **HP** | Total HP pool. At 0: incapacitated and an automatic Injury roll on the location of the final blow, regardless of remaining Durability. Mainly from Might and Resilience. |
| **Mana (MP)** | Large, slow pool that **persists between combats**. Fuels spells and some abilities. Mainly from Acuity and Sagacity. |
| **Tactical Points (TP)** | Fast-gaining, fast-spending combat resource. Gained by hitting, being hit, and certain abilities. Slightly from Acuity and Guile; mostly traits and passives. |
| **Might** | All physical damage, greatly traditional martial weapon damage. Feeds the **Arms** Durability pool ("hands" and "arms" are the same location). |
| **Resilience** | Greatly HP; minorly Sanity. Feeds **Body** Durability. Bonus to Injury rolls. Resist physical ailments (poison, stun…). |
| **Guile** | Greatly Evasion; somewhat Accuracy. Feeds **Legs** Durability. Reduces CT cost of movement. |
| **Acuity** | Spell damage. Faster Charge resolution. Resist mental ailments (confusion, sleep, charm…). Feeds **Head** Durability. |
| **Sagacity** | Spell healing, spell accuracy, slight spell damage reduction. Feeds the **Sanity** pool. |
| **Speed** | Mostly static, baseline 10. Very mildly from Acuity and Guile; mostly traits, job passives, equipment. Very powerful (12 vs 8 Speed = 50% more turns). |
| **Ailment resistances** | Per ailment. Mostly innate traits (from the House), plus equipment (can raise or lower). |
| **Elemental affinities** | % damage reduction or increase vs Holy/Dark, Fire/Water, Earth/Wind. Innate traits (from House) and equipment. |
| **Tarot** | A small innate bonus dealt at random to each Scion (§6.8). Usable as triggers for events and event resolutions. |

### 7.2 Scale [DECIDED as first pass]

- Core stats start around **10** (recruits roll 8–12 plus House modifiers) and reach the **40s–60s** by level 30 for a focused stat. Level cap 30; a 20-Year campaign reaches roughly level 20–30 for a Scion who goes on most expeditions.
- Growth rates are per level, 0.4–1.6 per stat (potential tier × House modifier). Level-up adds growth to a fractional accumulator; the integer part is the stat gain.
- Speed baseline 10; realistic range 6–16. Every +1 is ~10% more turns.
- Each Job applies a **stat multiplier while in it** (e.g. Soldier Might ×1.15, Magus Acuity ×1.2, Resilience ×0.9).

### 7.3 Derived pools [DECIDED as first pass]

| Pool | Formula |
|---|---|
| Max HP | 20 + Might + 3×Resilience + 2×Level, × Job HP mult |
| Max MP | 10 + 2×Acuity + 2×Sagacity + Level, × Job MP mult |
| Max TP | 100. Battle start at 0 (traits/passives can change). TP gain per event = 10 + ⌊(Acuity + Guile)/20⌋ |
| Head Durability | 10 + 1.5×Acuity |
| Body Durability | 15 + 2×Resilience |
| Arms Durability | 10 + 1.5×Might |
| Legs Durability | 10 + 1.5×Guile |
| Sanity | 20 + 2×Sagacity + 0.5×Resilience |
| Evasion % | 5 + Guile |
| Accuracy % | Weapon base (80–95) + 0.5×Guile + mods; hit chance = Accuracy − target Evasion, clamped 5–95 |
| Physical damage | Weapon power × (1 + Might/25) × location and row mods × crit (1.5) × element and affinity |
| Spell damage | Spell power × (1 + Acuity/25) × affinity; reduced by target's 0.5×Sagacity % |
| Spell healing | Spell power × (1 + Sagacity/25) |
| Spell accuracy % | 90 + 0.5×Sagacity − target mental/physical resist as the spell says |
| Physical ailment resist % | 1.5×Resilience + traits + gear |
| Mental ailment resist % | 1.5×Acuity + traits + gear |
| Injury roll bonus | +1 step per 15 Resilience, plus trait and House modifiers |
| Movement CT cost | 20 per cell moved, −1 per 5 Guile, minimum 10 |
| Charge time | Ability base × 100 / (100 + Acuity) |

Elemental affinity is clamped to −100…+100 (+100 = immune). Opposed pairs: Holy/Dark, Fire/Water, Earth/Wind. [DECIDED 2026-11-01] Lightning is Wind: wherever this spec says Lightning (pool weaknesses, storm creatures), read Wind.

### 7.4 Hits and locations [DECIDED]

- Every damaging hit targets a location. Unaimed attacks roll **Body 40% / Arms 25% / Legs 20% / Head 15%**; aimed abilities and some enemy attacks name their location. Damage goes to HP in full and to that location's Durability in full.
- When a location's Durability reaches 0, the Scion rolls on that location's **injury table** (§11) immediately. [DECIDED: no automatic refill.] The location stays **Broken** at 0. Right after the roll the Scion makes a **Resilience check** (chance = 2 × Resilience %, capped at 60%): on success they steel themselves and the location refills to 25% of max; on failure it stays Broken. While a location is Broken, **every further hit to it forces another injury roll** (each followed by the same Resilience check), so enemies that focus a broken limb are lethal and healers' Durability restoration matters.
- HP 0: incapacitated for the battle and an automatic roll on the final blow's location table with a −1 step penalty.
- Sanity damage comes from specific attacks and events; at 0, roll on the sanity table, then the same Resilience check (Sagacity instead of Resilience) for a 25% refill; while at 0, every further Sanity hit forces another roll.
- Durability and Sanity refill fully between battles only via rest events, Soothsayer abilities, or Reckoning in town; otherwise they carry across the expedition, like MP.

## 8. Settlement Phase

[DECIDED, from the brief] Co-op and solo building; players pledge resources as they see fit; insight, training and mentoring buildings; facilities other Houses can use by deal; shops must be built and their stock unlocked; settlement-wide and House-specific events with decisions; delayed trauma incidents. Everything below is **[PROPOSED]** unless tagged.

### 8.1 Resources [DECIDED]

| Resource | Where it comes from | Spent on |
|---|---|---|
| **Gold** | Yearly income, Market, selling loot, deals | Upkeep, promotions, shop purchases, hiring, bribes in events |
| **Grain** | Farms, Granary, forage events | Scion and recruit upkeep (food); famine Crises |
| **Timber** | Lumber Camp, expedition finds | Buildings (all tiers) |
| **Stone** | Quarry, expedition finds | Buildings (tier 2+), Walls |
| **Iron** | Mine, expedition finds, salvage | Forge crafting, Walls, Workshop |
| **Essence** | Expeditions only (rift residue, boss drops), Shrines | Enchanting, Abjurer/Conjurer buildings, Alterer forms, advanced crafting |
| **Rare materials** (Wyrmbone, Moonsilver, Voidglass, Saint's Ash, Hollow Ivory…) | Specific expeditions and bosses | Named recipes, relic repair, unique buildings |

- Each House has its own **Treasury** (Gold) and **Stores** (materials). The settlement has the **Commons**, a shared stockpile used by shared projects and Crises. [DECIDED] The Commons receives a **tithe** automatically (10% of every House's income and of expedition materials), and spending it requires a **vote** of the Houses (a tie costs Accord −3 and goes to the highest-Renown House). Houses may also pledge extra to it at will.
- Income and upkeep are paid at Reckoning. A House that cannot pay upkeep loses Grain first (Scions go Hungry: −10% HP next expedition), then Gold (Debt), then buildings decay a level.
- Base income per House per Year: 30 Gold, 10 Grain; scaled by H so the kingdom's total is similar at any player count (§4.3).

### 8.2 The Town Map and the Settlement screen

- One map, **districts**: a central Commons quarter (shared projects, shops, the Rift Gate), and one district per House with its Seat (§5.5) and House buildings. Fallen Houses' districts go dark.
- Each player hears their own House theme while viewing their district; the Commons plays the settlement theme; viewing another House's district plays theirs (so you can go listen).
- Every building is clickable for its actions. A right-hand panel lists the Year's **timeline** (§8.7), the Doom and Accord tracks, and who has sealed.
- The phase ends when every player has pressed **Seal the Year**. A sealed player can unseal until the last player seals. Optional host timer (10/20/30 min) auto-seals.

### 8.3 Actions in the Settlement Phase

No action points. Each action has a cost and, where noted, a per-Year limit:

| Action | Cost | Limit |
|---|---|---|
| Build or upgrade a House building | Materials + Gold; completes at the end of this Year (the benefit starts next Year) | 1 per House per Year (2 with Masons' Guild) |
| Pledge to a shared project | Any amount from Stores/Treasury into the Commons, earmarked | none |
| Pledge to a Crisis | Private, earmarked (§3.5) | the Crisis window only |
| Promote a recruit | Gold | 1 per House per Year (2 with Chapel) |
| Assign Mentors and students | — | by Training Ground capacity |
| Change a Scion's Job, secondary set, passives | — | free, any Scion in town |
| Equip, craft, enchant | Forge/Workshop materials | by building level |
| Buy from shops | Gold | by stock |
| Rest / treat injuries | Infirmary capacity | — |
| Propose a deal to another House | — | none; both must accept before sealing |
| Retire or reinstate a Scion | — | free |
| Set up a Sortie (§6.11) | — | 1 per Year, up to 4 Scions not on the expedition |
| Nominate Scions for the expedition and vote for the Leader | — | closes when all seal |

**Year assignments [DECIDED; list and slots accepted as a starting point]:** every Scion is assigned to one thing for the Year. The Settlement screen shows each Scion as a card dragged onto a slot:

| Assignment | What it does | Slots |
|---|---|---|
| **Expedition** | Nominated for this Year's expedition | party size |
| **Sortie** | Gambit auto-battle (§6.11) | 4 |
| **Rest** | Recover: Sanity +25%, injuries tick normally | unlimited |
| **Chapel** | Full Sanity restore and mental-ailment cure | Chapel L1 2, L2 4, L3 6 (Cathedral +2 for every House) |
| **Infirmary** | One injury heals a Year faster; disease cured | Infirmary L1 1, L2 2, L3 4 |
| **Train** (student) | JP and XP under a Mentor (XP capped at Mentor level −1, §6.6); half as much without one | Training Ground seats × 2 |
| **Teach** (Mentor) | Retired or any Scion with a mastered Job teaches | Training Ground seats |
| **Study** | JP in the current Job without a Mentor (slower) | Scriptorium L1+ 1, University unlimited |
| **Work** | Adds +4 output to a producer building | 1 per producer |
| **Guard** | Theft, haunting and sabotage events against the House are weakened | 2 |
| **Special** | An event-provided task (the Vision of the Gate, a Saint's vigil…) | by event |

Unassigned Scions idle (Sanity +10% only). A Scion on the expedition still gets the Rest recovery at Reckoning (the Year is long).

### 8.4 House buildings (3 levels each, built in the House's district) [DECIDED list as a starting point]

| Building | L1 | L2 | L3 |
|---|---|---|---|
| **Training Ground** | 1 Mentor seat (2 students) | 2 Mentor seats; students +50% JP | 3 seats; trained recruits promote at level 5 |
| **Scriptorium** | Insight 1 | Insight 2 | Insight 3; once a Year, peek one expedition event |
| **Infirmary** | Moderate injuries heal 1 Year sooner | 2 Scions treated per Year; disease immunity in town | A Devastating injury may be downgraded once per campaign (prosthetics, surgery) |
| **Chapel** | Sanity +25% per Year in town; 2nd promotion slot | Mental ailment resist +10% for House Scions | Resurrection and redemption events become possible |
| **Forge** | Craft tier 1 weapons and armor; repair | Tier 2; reforge (reroll one gear property) | Tier 3; rare-material recipes |
| **Workshop** | Consumables; Tinkerers start with +1 Component | Thrown weapons, traps, prosthetics | Constructs can be pre-built for battle |
| **Hall of Petitions** | Recruit arrival +25% | Choose between 2 arriving recruits | Recruits arrive with Insight 1 revealed |
| **Vault** | Treasury score +10%; immune to theft events | +20%; interest 5%/Year on Gold | +30%; Relics score +10% |
| **Shrine** (of the House's element) | Essence +2 per Year; affinity +5% for House Scions | Element spells −10% MP (stacks with affinity) | Once per expedition, one Scion is immune to that element for a battle |
| **Crypt** | Chronicle; Sanity loss from a Scion's death −50% | Haunting events can be bargained with | The dead can be asked one question per Year (reveal a hidden thing) |
| **Farm / Lumber Camp / Quarry / Mine** | +8 of the resource per Year | +16 | +24; one random rare material every 3 Years (Mine) |
| **Kennels** | Beast companions in Sorties | Conjurer beast summons +15% HP | Alterer beast forms last longer |
| **Watchtower** | Preview next Year's settlement event category | Ambush events on expeditions: your Scions act first | Preview the exact event |

Build costs scale by level (e.g. L1: 20 Timber + 20 Gold; L2: 30 Timber + 20 Stone + 40 Gold; L3: 40 Stone + 20 Iron + 80 Gold). Producers are cheap; Vault, Shrine, Crypt are expensive.

### 8.5 Shared projects (built in the Commons from the tithe and pledges; benefit every House) [DECIDED]

[DECIDED] More economical than House projects but credited only through Renown. [PROPOSED] A shared project costs about **1.3× a House building of the same tier** yet benefits all H Houses; pledges are public (unlike Crises). A project completes the Year its cost is fully pledged. Renown is granted by share pledged.

| Project | Effect |
|---|---|
| **Walls** (3 levels) | Devastation ruins one fewer building per level; Doom gain from failed mandatory expeditions −5 per level |
| **Granary** | Famine Crises halved; Grain upkeep −20% for all |
| **Great Market** | Unlocks the shops (§8.6); +10 Gold per House per Year |
| **Cathedral** | All Scions Sanity +25% per Year in town; Holy +10% for all; resurrection events for all Houses |
| **Rift Observatory** | Shows the expedition's event pool and boss type before departure; mandatory expeditions foreshadowed 1 Year earlier |
| **Arena** | Sorties yield +50%; Sortie injuries capped at Mild |
| **Aqueduct** | Disease events removed; Infirmary effects +1 level for all |
| **Beacon** | Recruit arrival +25% for all; unique-Scion events more likely |
| **Court of Peers** | Accord losses −25%; deals breakable only at double cost; Unrest −10 (solo) |
| **University** | Every Scion in town gains JP each Year in their current Job |
| **Bastion of the Gate** | The Year 20 expedition starts with a shield on every Scion and one free retreat |
| **Mausoleum of the Pact** | A Relic found by any House counts for all Houses' Lore at 25% |

### 8.6 Shops [DECIDED: shops must be built, and their stock unlocked]

- Shops live in the Great Market (shared project). Each shop is itself a shared project; each has **stock tiers 1–3** unlocked by bringing back a specific thing from a **resource expedition** (a trade contact, a recipe book, a caravan master, a rare material), never by Gold alone.
- Shops: **Armorer** (armor, shields), **Weaponsmith** (weapons), **Apothecary** (consumables, cures), **Curio Dealer** (accessories, Tarot-linked trinkets, one random magic item per Year), **Beastmonger** (summon upgrades, pets), **Fence** (buys loot; sells stolen goods at a discount; using it costs Intrigue… or gains it).
- Stock refreshes each Year, seeded; prices modified by House traits. Each House buys from its own Treasury.

### 8.7 The timeline

A visible strip of the 20 Years. Entries: mandatory expeditions (known 2+ Years ahead), queued consequences ("Year 9: the thing Lord Vane's Scion brought back hatches"), debts due, and hidden entries shown as "?" that a Watchtower or Observatory reveals. Trauma incidents (§11) are queued here when a Scion's sanity breaks.

### 8.8 Events in town [DECIDED cadence]

Resolved in the **Omens** step before the Settlement Phase opens:
- **One settlement-wide event every Year** (about 40% are Crises, §3.5). Drawn from a pool weighted by Year band (early / mid / late), Doom, Accord and tags from the last expedition.
- **Each House rolls a House event with 50% chance** (more with Haunted Halls, Feud, Cursed Line, less with Watchtower), drawn from a pool filtered by the House's traits, Bloodline, Scions' traits and Tarots, and recent history.
- Every event is: flavor text, 2–4 options, a **resolution rule** that fits the fiction, and outcomes with hidden weights. Some events are multi-Year (a decision now, a payoff later on the timeline).

**Resolution rules for settlement-wide events** (each event names one): majority vote of Houses (a tie costs Accord −3 and is broken by the House with the highest Renown) [DECIDED: ties cost Accord]; the House with the most / least Gold; the House with the most Scions in town; a random House; the House whose Scion bears a named Tarot; the House with a named trait tag; the House that led last Year's expedition; each House chooses for itself (independent outcomes); secret simultaneous choice (prisoner's-dilemma style, outcomes revealed together).

**First settlement-wide events** (target 60):

| Event | The choice | Rule | Notes |
|---|---|---|---|
| The Hungry Winter (Crisis) | Pledge Grain to the Commons | Pledges | Calamity: recruits starve, Unrest/Accord −15 |
| The Breach in the Wall (Crisis) | Pledge Stone and Iron | Pledges | Calamity: next expedition departs a Year late; Doom +10 |
| The Plague Cart | Burn it / quarantine / let the Apothecary study it | Vote | Study: Apothecary tier up, 30% a Scion is Sickly |
| A Stranger at the Gate | Admit / turn away / interrogate | Random House decides | Admit: a unique Scion or an assassin |
| The Eclipse | Each House: pray, hide, or go out under it | Each House itself | Under it: a random Scion gains a Dark trait or Sanity loss |
| Tithe of the Pale Saint | Give a Scion to the church for a Year / pay / refuse | House with most Holy affinity | Refuse: Holy events hostile for 3 Years |
| The Market Caravan | Trade windows for every House | Each House itself | Rare materials for sale once |
| The Rift Whispers | A chosen Scion listens | Scion bearing The Moon | Learn the next boss, or the Scion goes mad |
| The Child Who Came Back | Keep the returned child / banish / test with the Crypt | Vote | Keep: a prodigy recruit for a random House, or a Hive-Touched incursion later |
| Bread and Circuses | Hold games (Gold) for Unrest/Accord | Secret simultaneous: each House funds or not | Funders gain Renown; if none fund, Accord −10 |
| The Debt Collector | Pay the kingdom's old debt / refuse / set the Vagabonds on him | House with most Gold | Refuse: Treasury scores −10% for all for 3 Years |
| The Night of Open Doors | Doors won't lock; each House guards or hides | Each House itself | Guarding Scions may be injured; hiding may lose stores |
| A Saint's Bones | Enshrine in the Cathedral / sell / give to one House | Vote | Enshrine: Sanity for all; a House: Relic score |
| The Mold in the Granary | Burn stock / scrape / ignore | House with the least Grain | Ignore: Grain loss next Year ×2 |
| The Rebellious Commons | Hang the ringleaders / hear them / pay them | Vote | Hang: Unrest +20 now, −10 per later Year |
| The Vision of the Gate | Send a Scion into the vision | Scion with the most expeditions | Learn the Year 20 boss's weakness or lose the Scion for a Year |

**First House events** (target 60):

| Event | The choice | Rule | Notes |
|---|---|---|---|
| The Cousin's Claim | Pay off / duel / recognize a bastard | House | Recognize: +1 recruit with Bad Blood tag |
| Portrait Gallery | A Scion refuses to sit for a portrait | Scion with lowest Sanity | Insight into a hidden trait or a haunting |
| The Creditors Call | (Debt-Ridden) pay or forfeit | House | — |
| Night Terrors | A traumatized Scion wanders | Queued from a sanity break | Murder, sabotage, or a confession that heals |
| The Old Mentor's Secret | A Retired Scion asks to teach a forbidden Job | House | Advanced Job early, Sanity cost per student |
| The Demon's Due | (Demon-Blooded) the bargain comes round | Scion with the most kills | A boon or a possession |
| The Hound That Returned | (Beastmasters) a dog comes back from the rift changed | House | Beast companion, or it bites |
| A Letter From the Other House | A Ward's birth House writes | The Ward | Loyalty shifts; intel leaks |
| The Ward's Request | A Ward wants to visit home | Host House | Refuse: Loyalty −15; allow: 10% defect |
| The Locked Wing | A room in the Seat appears that was never there | Scion bearing The Hermit | A Relic, a Curse, or a recruit |
| The Forge Sings | (Forge L2+) the smith hears something in the iron | House | A unique weapon with a Curse |
| Feast of the Dead | (Crypt) the dead invite the living | Scion with the most dead comrades | Sanity, Lore, or a resurrection offer |
| The Suitor | A noble from a Fallen line proposes alliance | House | +1 recruit; a Feud with another House |
| Cold Spot in the Nursery | (Haunted Halls) | House | Exorcise with Essence or accept a Grave-Touched child |

### 8.9 Deals between Houses [DECIDED: instant]

- [DECIDED: **instant trades only, no recorded promises.**] A deal is proposed in a UI, accepted by both, and executes at once: Gold, materials, items, a Ward, a Mentor loan for this Year, facility use for this Year (e.g. a Chapel slot, a Shrine, a Forge tier). Anything about the future is table talk, not a game object; the game never judges it.
- Deals are private between the two Houses unless either makes them public (a public deal counts for Renown). 
- With H = 1, deals are made with NPC factions (the church, the guilds, the Fence) through events instead.

### 8.10 Reckoning (end of Year)

1. Income and upkeep; debts and interest.
2. Buildings and shared projects complete.
3. Injuries tick down one Year; Infirmary effects apply.
4. Scions recover by their Year assignment (§8.3): Rest gives Sanity +25%; a Chapel slot restores Sanity fully; Durability and MP refill fully for everyone. [DECIDED: full Sanity recovery is possible with the right building investment; slots grow with building tier.]
5. Accord/Unrest and Doom adjusted.
6. Trauma incidents queued; recruit arrivals rolled; Loyalty updated.
7. Each House sees its private Ascendancy change by category; everyone sees Standing tiers.
8. Checkpoint save (§4.4).

## 9. Expedition Phase

[DECIDED, from the brief] Houses jointly nominate a party; an Expedition Leader is chosen at departure; parties of 4 or 8, sometimes several parties of 4 progressing independently to unlock each other; a chain of events from an expedition-specific pool plus a much larger general pool, then a boss; the full range of outcomes (maiming very rare, traits, blessings, stat boosts, mundane and magic items, transformation, random encounters, House-score artifacts, House improvements, resources); heavy flavor text with re-flavored duplicates welcome; decisions with resolution rules that fit the fiction. Everything below is **[PROPOSED]** unless tagged.

### 9.1 Choosing the expedition [DECIDED, to try]

- Each Year the **Rift Gate** offers **2–3 expedition cards** (seeded), plus the mandatory one when due. [DECIDED] A **forced expedition** (§3.2) replaces the whole offer with its one card. A card shows: name, type, **level** (1–10), party size (4 or 8, or 2×4), its event-pool tags, its reward class, and, with a Rift Observatory, its boss type and pool preview.
- Types: **Mandatory**, **Resource** (materials, shop unlocks, recipes), **Hunt** (a named monster; Valor and a trophy), **Rescue** (a lost party, a recruit, a Hostage), **Delve** (Relics, Lore, Essence; highest event density), **Pilgrimage** (blessings, Sanity, Holy/Dark pools).
- Level: resource cards at the Year's band (Years 1–4: 1–3; 5–9: 3–5; 10–14: 5–7; 15–19: 7–9; 20: 10). Mandatory expeditions at levels 3 (Year 5), 6 (Year 10), 8 (Year 15), 10 (Year 20). Houses may pick a card above band for better rewards.
- Houses **vote** on the card. [DECIDED for settlement votes; Expedition Phase ties cost nothing, 2026-11-02] A tie costs Accord (−3) and is broken by the House with the highest Renown.

### 9.2 Nomination, the Leader and departure

- [DECIDED] **Each House fills its own seats with its own Scions.** Seats are divided equally among the Houses that want to field Scions (4 seats, 4 Houses: 1 each; 3 Houses: 2/1/1 with the extra seat going to the House with the fewest expeditions attended so far, then by rotation; 8 seats: double). A House may decline any of its seats, which pass to the others by the same order. Each House then picks which of its able Scions take its seats; nobody votes on another House's Scions. If the seats cannot be filled, the card cannot depart and the Houses choose another.
- [DECIDED] Some events temporarily make one House **Regent** (a dictator or monarch for a Year or an expedition): the Regent allocates all seats, names the Leader and decides any `vote`-rule event alone. Regency is the only exception to self-nomination.
- **Expedition Leader:** vote among the roster (each House one vote); ties go to the Scion with the most expeditions [DECIDED 2026-11-02: no Accord cost, only settlement ties cost Accord]. The Leader's House gains Renown; the Leader is the subject of leader-targeted events (good and bad) and of **Hubris**.
- At departure, each Scion's Job, secondary set, passives and gear lock for the expedition.
- Each 8-Scion expedition (and some 2×4 cards) uses the full 3×8 grid; 4-Scion cards use a 3×4 half grid (§10).

### 9.3 Structure: the chain [DECIDED]

- An expedition is a chain of **N nodes** then the **Boss**: N = 4 + level/2 (5 at level 1, 9 at level 10). Mandatory expeditions add +2.
- Node mix (rolled per node, then shuffled so the shape is unknown): **Encounter 40%** (a battle from the card's enemy pool, §14), **Event 45%** (an event from the card's specific pool 50% / the general pool 50%), **Camp 10%** (rest: recover some Durability and Sanity, a camp event may interrupt), **Cache 5%** (loot, sometimes trapped).
- Some events are **Forks**: the chosen option changes the remaining chain (a shorter, nastier path; a detour with a Cache).
- **Multi-party cards (2×4):** two parties roll separate chains in parallel. Some nodes are **Gates**: a party waits there until the other party clears a matching node ("the lever on the far side"), so the players alternate control. Each party has its own Leader; the first-named is the expedition's Leader for leader-targeted events.
- [DECIDED] **No Supply or food tracking.** Hunger, thirst and exposure are handled by events (a bad Camp, a poisoned well, "the last of the bread"), never by a resource counter.

### 9.4 Anatomy of an event (content format)

```json
{
  "id": "banquet_of_the_hollow_host",
  "pools": ["general", "delve", "undead"],
  "weight": 3,
  "band": [2, 8],                       // expedition levels where it may appear
  "requires": ["!flag:banquet_seen"],  // predicates: traits, tarots, House tags, injuries, history, flags
  "title": "The Banquet",
  "text": "…a table laid for exactly as many as you are, the candles still warm…",
  "options": [
    { "id": "eat", "label": "Sit and eat.", "rule": "vote",
      "outcomes": [ { "w": 50, "text": "…", "effects": [{"sanity": "+20%"}, {"durability": "all:+50%"}] },
                    { "w": 35, "text": "…", "effects": [{"status": "poison"}, {"encounter": "hollow_host"}] },
                    { "w": 15, "text": "…", "effects": [{"trait": "+Touched_by_the_Feast"}, {"item": "magic:ring_of_the_host"}] } ] },
    { "id": "one_tastes", "label": "One of you tastes it first.", "rule": "scion:most_expeditions", "subject": true, "outcomes": [ … ] },
    { "id": "leave", "label": "Leave it.", "rule": "leader", "outcomes": [ { "w": 100, "text": "…", "effects": [{"sanity": "-5%"}, {"flag": "banquet_seen"}] } ] }
  ]
}
```

- **Rules** (`rule`) decide who picks the option, and often who the **subject** is (the Scion the effects apply to). The full catalogue, each tied to a kind of fiction:
- [DECIDED, Q90, 2026-11-02] **The party votes on the option** (every House with someone in the party; a tie goes to the Leader's House at no cost: only settlement ties cost Accord); **the chosen option's rule names its subject**. `each_scion` and `secret` keep their own way of choosing.

| Rule | Who decides / who is the subject | Fits fictions like |
|---|---|---|
| `vote` | All players present vote; ties go to the Leader (no Accord cost) | Group deliberation |
| `leader` | The Expedition Leader's player | Command decisions |
| `scion:random` | A random Scion is the subject; their owner decides | Fate, traps, a voice picks one |
| `scion:most_kills` / `fewest_kills` | Bloodiest / cleanest hands | Spirits of the slain; a pacifist shrine |
| `scion:most_expeditions` / `fewest` | The veteran / the greenest | Trials; things that prey on the naive |
| `scion:most_healing` | The healer | Saints, plague, the wounded |
| `scion:most_targeted` | The one enemies seek | Marked by something |
| `scion:highest:<stat>` / `lowest:<stat>` | e.g. lowest Sanity, highest Might | Locks, tests of strength, whispering |
| `scion:heaviest_gear` / `most_open_slots` | Laden / unburdened | Narrow passages, offers of gifts |
| `scion:tarot:<card>` | The bearer of a card | Omens, prophecy |
| `scion:trait:<tag>` / `house:trait:<tag>` | Scions (or Houses) with a tag; else falls back to `vote` | Bloodline bargains, religious tests |
| `scion:injured:<location>` / `scion:retired_once` | The maimed | Offers to regrow, to replace |
| `house:lowest_standing` / `highest_standing` | The House most desperate / most proud | Temptations, demands |
| `each_scion` | Every Scion's owner picks for them, resolved together | Each hears a different voice |
| `secret` | Each player picks secretly; revealed together | Betrayal-shaped events |

- **Effects** catalogue (all referenced by id so saves stay small): `hp`, `mp`, `tp`, `sanity`, `durability`, `status` (an ailment for the next battle), `xp`, `jp`, `stat` (permanent), `growth`, `trait` (+/−), `tarot` (redraw), `blessing` (a timed positive trait), `curse`, `injury` (forced roll on a table, or a named result), `change` (§9.6; `unchange` reverses it), `item` (mundane / magic / relic / recipe / rare material), `resources` (to the finder's House or to the Commons), `house_score` (category, amount, House), `house_improvement` (a building level, a shop tier, a recruit), `accord`, `unrest`, `doom`, `loyalty` (a Ward), `encounter` (a battle now, by enemy group id, with optional modifiers such as ambush or surprise), `fork`, `flag`, `timeline` (queue a settlement event in N Years), `retreat` (expedition ends), `scion_lost` (a Scion is gone, possibly to return via a Rescue).
- Every option can have a **hidden weight shift** from tags (Veteran passive, Curious, Lucky, House traits such as Silver Tongues), applied to outcome weights, never shown in Flavor Mode and shown as "favored" in Crunch Mode.

### 9.5 Writing rules for events (for content authors)

- Default to dread. Comfort is bait about half the time; the rest it is real, so players can never be sure.
- Across the pool, **boldness, caution and cleverness each pay off about as often**, and recklessness pays off a little less often but bigger. Tag each option `bold` / `cautious` / `clever` / `reckless` / `cruel` / `kind` so the pool's balance can be measured by script.
- About **1 in 8** events is a moment of hope or beauty with no catch.
- Maiming outcomes: no more than 2% of all outcome weight in the general pool; forced injury rolls are the usual way harm happens.
- Mechanical duplicates with different flavor are encouraged; the `id` differs, the `effects` may be identical.
- Every event names its resolution rule in a way the text justifies (the thing *chooses the veteran*; the *group* argues; the *lock* yields to the strongest).

### 9.6 Transformation

A `change` effect replaces the Scion's base stats, growths, individual traits, look and injuries with a **Change** record (`content/changes.json`; Josh 2026-11-02: Form stays the Alterer's word) (e.g. Barrow Knight, Marsh Thing, Seraph Husk, Wyrmling). The Scion keeps: name, House, Tarot, level, JP and learned Jobs (if the Form allows Jobs; some Forms have a fixed Job), gear slots the Form allows, Loyalty. Forms are strong but strange: most have at least one severe restriction (cannot enter the Chapel; no healing from Holy; must eat Essence as upkeep). Some events can reverse a Form; some Forms count as a unique Scion for events.

### 9.7 First expedition events (target 300+; 40 here)

| Event | Pools | Choice and rule | Notable outcomes |
|---|---|---|---|
| The Banquet | general, delve | Eat (vote) / one tastes (most expeditions) / leave (leader) | Heal, or poison and ambush, or a ring |
| The Trial of the Veteran | general | A hooded thing demands the most veteran face it alone (most expeditions; no refusal) | A duel node: win for a blessing and Valor; lose for a Devastating injury roll |
| The Beggar at the Ford | general | Give him your bread (vote) / refuse / rob him | Give: later he is the boss's keeper and spares one; rob: Intrigue, a Curse |
| The Mirror Pool | general, water | Look (each_scion) | See your Tarot's reversed self: a stat +2, or Sanity −30% |
| The Altar of Hands | undead, delve | Lay a hand on it (scion:injured:arms, else lowest Might) | The hand is regrown (Grafted), or taken |
| A Perfectly Preserved Library | delve | Read (highest Acuity) / burn / carry a book out (heaviest gear can't) | Lore +; a recipe; a Curse of Hunger; Sanity loss |
| The Hanging Garden | pilgrimage | Eat the fruit (tarot: The Empress, else vote) | Healing and +1 growth, or Sleep in the next battle |
| The Child in the Well | general | Pull it up (most healing) / leave it / drop a torch | A recruit; a Hive-Touched thing; nothing |
| Wolves at the Fire | camp | Fight / feed / sing (Minstrel present) | Encounter; Camp heals nothing; the pack follows and joins the boss fight on your side |
| The Toll | general | Pay gold (house:highest_standing) / fight / offer a Ward's secret | Pay: pass; fight: strong encounter; secret: Loyalty −20, Accord −5 |
| The Saint's Tongue | pilgrimage | Kiss it (most Holy affinity) | Holy +15% permanent, or struck mute (ailment: Silence 3 battles) |
| The Rot That Thinks | delve | Study (highest Sagacity) / burn / bargain | Alterer form unlocked; Sickly; a Curio |
| Twins | general | One twin lies, one tells the truth (clever tag: highest Guile) | Fork: a safe path, a Cache, or a trap node |
| The Armor That Walks | undead | Wear it (fewest kills) | Transform: Barrow Knight |
| The Lantern Keeper | general | Trade a memory (lowest Sanity) for light | Skip a node; Sanity −20%; a Lore clue |
| The Rift Scar | general | Cross (leader) / go around (an extra Encounter node) | Random elemental affinity ±20% to all; or nothing |
| The Field of Flowers | pilgrimage, hope | Rest here (vote) | Full Sanity and Durability. No catch. |
| The Hunters' Mark | hunt | Follow the blood (most targeted leads) | Shortcut to the boss; an ambush |
| An Offer of Wings | general, late | A winged thing offers wings to the lightest (most open slots) | Trait: Winged (Fleet, flight in events); Holy −20% |
| The Weeping Statue | pilgrimage | Drink the tears (most healing) | MP +20% permanent, or Nightmares |
| The Bone Market | undead, delve | Buy with a limb (scion:random) / buy with gold / browse | A relic for an injury result; magic items for gold |
| The Collapsed Chapel | pilgrimage | Dig (highest Might) | A Saint's Ash (rare material); or a cave-in: Legs injury roll |
| The Hermit of the Gate | general | Ask one question (tarot: The Hermit, else vote) | Reveal the boss's pattern; or the hermit lies |
| Footprints Leading Back | general | Follow (fewest expeditions) | A lost Scion from an earlier Year (Rescue); a doppelganger |
| The Still-Warm Camp | camp | Take their gear (vote) | Mundane items; the owners return (encounter) or thank you |
| Feast of Crows | hunt | Scatter them (any) / read the omens (The Moon) | Doom −2; or a Curse |
| The Spider Queen's Court | late, delve | Bow (leader) / fight / offer a Ward | Essence ×5; strong encounter; the Ward is gone, Loyalty of all Wards −10 |
| The Lullaby | general | Who sleeps? (lowest Acuity, no choice) | Sleep ailment; a dream grants a Tarot redraw |
| Ash Rain | general | Cover faces (lose a turn of Camp) or endure | Head Durability −50% all; or nothing |
| The Chained Angel | late, pilgrimage | Free it (most Holy) / leave / kill it | Unique Scion: fallen angel; Doom +5; Relic |
| The Prisoner Who Knows Your Name | general | Listen (scion with a hidden Ward loyalty, else random) | Reveals a leak; or a lie |
| The Burning Man | general | Help (Water affinity Scion) / pass | A grateful Form-reversal later; Fire damage |
| The Door With Your Emblem | general, house | The House whose emblem it is (house:random) decides | A House improvement; a House event queued |
| Bread on the Water | hope | Nothing to decide | Every Scion heals 25% HP and 10% Sanity. "Someone wanted you to live." |
| The Grinning Surgeon | general | Let him work (scion:injured:any) | Injury downgraded; or a new Moderate injury elsewhere |
| The Count of the Dead | undead | Name your fallen (house with most Chronicle entries) | Valor +; a dead Scion walks again (Grave-Touched, returns to the House) |
| Hollow Ivory | late | Harvest (highest Guile) | Rare material; Sanity loss |
| The Tithe-Men | general | Pay in Essence (house:lowest_standing) / refuse | Pass; or an encounter with human bandits (Sanity for cruel option) |
| The Last Stair | mandatory | Who goes first (vote) | The first Scion takes the boss's opening telegraph alone: a shield for the rest |
| The Gate's Reflection | mandatory, Year 20 | Each Scion sees their House's future (each_scion) | Ambition revealed to the player as a number; a blessing for the final fight |

### 9.8 Encounters

- Each card has an **enemy pool** (themed by its sprites, §14). An Encounter node draws a **group template** for the level: 2–6 enemies for a 4-party, 4–10 for an 8-party, with roles (fodder, bruiser, caster, support, elite). Ambush/surprise modifiers come from events and traits (Light Sleepers, Watchtower).
- Victory: XP and JP for all present, TP reset, some Durability and Sanity loss persists. Loot: a small roll from the pool's drop table.
- **Retreat from an encounter:** the Leader's player may call it after the first full round; each Scion must pass a Legs-Durability-based escape check or take a free hit; the node is marked failed and the party arrives at the next node with −10% Sanity.

### 9.9 The Boss and the result [DECIDED]

- The boss node is a scripted battle (§14) with telegraphs and phases. Victory ends the expedition; the result screen shows XP/JP, loot, House score deltas, and the Chronicle of the dead.
- **Retreat before the boss** (any non-boss node, Leader's call; vote if the Leader is incapacitated): the party returns with everything carried so far; the card's completion rewards are forfeit; mandatory → failed (Devastation, §3.3); Valor −.
- **Party wipe** (all incapacitated): every Scion rolls on the table of their final blow at −2 steps; each then has a 50% chance to be **Lost** (left behind; a Rescue card appears next Year to recover them, else they are dead after 2 Years) and otherwise crawls home. Loot is lost. Mandatory → failed.

### 9.10 Loot and ownership [DECIDED]

- An event's finds go to the **subject Scion's House** (or the deciding House when there is no subject; to the Commons when the rule was `vote`).
- [DECIDED 2026-11-02, Josh] **Treasure goes to one pool, and the Houses claim shares of it.** Everything the party carries home (Encounter drops, Caches, the boss's loot) is laid out as shares: each item is one share, and each material or Essence is split into bundles, one per drafting House. Houses pick a share in turn (gear, a bundle of materials, an artifact), in a random House order and then snake order, until the pool is empty. A House with no Scion still on the expedition does not draft. Shop unlocks, recipes and settlement improvements always go to the Commons (everyone).
- House-score artifacts (Lore/Relics) are items: whoever holds them at campaign end scores them, so they can be traded.

## 10. Combat

[DECIDED, from the brief] Party on the right, enemies on the left; ~24 player slots (3×8); targeting shapes (everyone, sections, lines, bursts, checkerboards, singles, multiples) for enemies and players alike; enemies favor the front; melee and melee-range spells bonus in front; limited movement per turn; telegraphed heavy attacks; the FFT clock (Speed added to CT each tick, act at 100, 100 per action, leftover kept, Readiness damage, variable costs, Wait/Defend 60); charging with an evasion malus; bosses outnumbered, so multi-target and fast. Everything below is **[PROPOSED]** unless tagged.

### 10.1 The battlefield

```
 ENEMY SIDE (left)                PLAYER SIDE (right)
 col E3  E2  E1  ·· gap ··  F   M   B        row
  [ ] [ ] [ ]               [ ] [ ] [ ]       1
  [ ] [ ] [ ]               [ ] [ ] [ ]       2
  [ ] [ ] [ ]               [ ] [ ] [ ]       3
  [ ] [ ] [ ]               [ ] [ ] [ ]       4
  [ ] [ ] [ ]               [ ] [ ] [ ]       5
  [ ] [ ] [ ]               [ ] [ ] [ ]       6
  [ ] [ ] [ ]               [ ] [ ] [ ]       7
  [ ] [ ] [ ]               [ ] [ ] [ ]       8
```

- Player grid: **3 columns deep × 8 rows tall**. Columns are **Front (F)**, **Middle (M)**, **Back (B)**; Front is nearest the enemy. Rows run top to bottom. [DECIDED] **Every party uses the full 3×8 grid**, 4-Scion parties included: the spare cells are for Conjurer summons, Tinkerer constructs and movement, and enemy shapes (`column`, `band`, `checker`) keep empty space from being safe.
- Enemy grid: the mirror image (E1 nearest the players). [DECIDED] **Large enemies occupy several cells**: 2×2, 3×2, 2×4; bosses 3×3 to 3×4, and a few colossi the whole 3×8. An enemy's "row" for reach purposes is every row it occupies.
- Drawn as two slightly tilted planes facing each other (a shallow perspective so depth reads), sprites standing on their cells, House-colored rings under Scions.
- Cells can hold one entity plus one ground effect (fire, ice, a Tinkerer turret counts as an entity).

### 10.2 Targeting shapes

Every ability (player or enemy) names a shape and a side. Shapes, in grid coordinates:

| Shape | Covers |
|---|---|
| `single` | one cell |
| `row` | one row across the target side (all 3 columns) |
| `column` | one column (all 8 rows), e.g. `column:B` sweeps the Back line |
| `band:<n>` | a block of n rows across all 3 columns (a third of the grid is `band:3`; a half is `band:4`) |
| `lob` | single target weighted Back 50 / Middle 30 / Front 20 (arrows, bolts, spit) |
| `line:<len>` | from the attacker's row, straight across, first `len` occupied cells |
| `cross` | a cell and its 4 neighbors |
| `burst:3x3` / `burst:5x5` | a square centered on a cell |
| `checker:a` / `checker:b` | every other cell, one parity |
| `front_each_row` | the front-most occupied cell of every row |
| `nearest:<n>` | the n nearest entities |
| `random:<n>` | n random entities (can repeat if the ability says so) |
| `all` | every entity on the side |
| `self` / `adjacent` / `ring` | self; self plus 4 neighbors; the 8 around |
| `allies_all_hearing` | Minstrel: every ally not Deaf, anywhere |

Shapes aimed at the player side use player coordinates; `burst` and `checker` can be centered off-grid to catch edges. Telegraphed attacks (§10.7) display their shape before landing.

### 10.3 Front, back and reach [DECIDED]

- [DECIDED] **Unaimed single-target** enemy abilities pick a column first: **Front 45% / Middle 35% / Back 20%** (only among occupied columns; if Front is empty, Middle takes its weight), then a random occupied row. Challenger-type effects add flat weight to a Scion. The Back is less exposed, never safe.
- [DECIDED] **The back line is threatened by more than melee singles.** Every enemy pool includes some of: ranged attackers with `lob` targeting; `column:B` sweeps and `band` slams; `checker` patterns; **leapers and assassins** that jump onto an empty player cell and melee the Back from inside the formation (they can be surrounded and killed there); **reach** monsters (tentacles, lances) whose melee reaches two columns; **flyers** that ignore the reach rule; fear and sanity attacks that seek the lowest Sanity (often a caster); and ground effects (fire, webs, summoned hands) spawned on Back cells. The implementer should make at least a third of every enemy pool a back-line threat of some kind.
- **Enemy melee** can only reach the **front-most occupied Scion in that row** (its row range for large enemies). An empty Front row exposes Middle, and so on. Ranged and magic reach any column.
- **Scion melee row leniency** (Josh, 2026-11-02: "most front rank units should be able to target front rank enemies, and maybe middle or back rank enemies if not blocked; we don't want melee to be too weak"): a Scion's melee reaches **the front-most foe of every row**, whichever row the Scion stands in, so any foe with nothing standing in front of it. A reach weapon also reaches the one behind. The column limits below still apply. Enemy melee keeps the strict own-row rule. Knobs: `tuning.combat.scionMelee`.
- **Scion melee and melee-range spells:** from Front, damage **+10%**; from Middle **−10%** and only against the enemy's E1/E2 columns; from Back, melee is impossible without a reach weapon (spear, whip: Middle reach, no bonus). Ranged weapons and ranged spells: no column modifier, but bows have **−10% from Front** (too close).
- Row effects: some abilities hit "your row across both sides" (a sweeping line).

### 10.4 The clock [DECIDED]

- The battle runs in **ticks**. Each tick, every living entity gains **CT += Speed**. When any entity reaches CT ≥ 100 it takes a turn; several at once resolve in order of highest CT, then highest Speed, then seeded random. Nothing else happens during a turn (no simultaneous turns).
- A turn: **optional Move** (before or after the action) and **one Action**. The action costs its CT price (normal 100; Wait or Defend 60; Minstrel songs 35; some heavy techniques 120–150). Move costs its own CT (§7.3: 20 per cell, less with Guile, up to 2 cells; swapping with an adjacent ally moves both for one cost). Leftover CT above the costs is kept, so a 110-CT Scion who Waits sits at 50 afterward.
- **Readiness damage:** abilities can subtract CT from a target (delay) or add it to an ally (quicken). CT cannot go below 0. Bosses take Readiness damage at half value.
- **Haste** +2 Speed, **Slow** −2 Speed, **Stop** freezes CT, each for a tick duration.
- **Defend:** physical damage −50% and injury-roll +1 step until the next turn; costs 60. **Wait:** costs 60, nothing else; a Scion may also wait "until <ally> acts" (UI nicety, same cost).
- The UI shows a **turn forecast**: the next 10 turns simulated from current CT and Speed (charging spells appear as their own entries), like FFT's AT list. Forecasts change when Speed changes.

### 10.5 Charging [DECIDED]

- A charged ability has a **charge time** in ticks (§7.3: base × 100 / (100 + Acuity)). Choosing it ends the turn (its CT cost is paid), and the caster enters **Charging**: their CT keeps accumulating but they **hold** at 100 until the ability resolves, then act normally on their next tick.
- While Charging: **Evasion −20%**, physical damage taken +10%, cannot Move or counter. Stun, Sleep, Silence (for spells) or Knockdown **cancel** the charge (MP is still spent). Some abilities ("Disrupt", Readiness damage over a threshold) cancel it too. Abjurer wards and Knight abilities can protect a charger.
- The target cell is chosen at charge start; if the target moves, the ability lands on the cell unless it is `homing` (most single-target spells are homing, big AoEs are not, which is what makes telegraphs dodgeable).

### 10.6 The damage pipeline

1. **Hit roll:** Accuracy − Evasion (clamped 5–95), modified by column and status (Blind −30, Charging target +20). A miss ends here; Gambler rerolls apply.
2. **Location:** aimed, or rolled Body 40 / Arms 25 / Legs 20 / Head 15 (§7.4).
3. **Crit:** base 5% + weapon + traits; crit ×1.5, and Head hits crit at +10%.
4. **Base damage:** physical = weapon power × (1 + Might/25); magic = spell power × (1 + Acuity/25) (§7.3).
5. **Multipliers, in order:** column modifier; element × target affinity (−100…+100%); Protect/Shell (−30% physical / magical); Defend (−50% physical); armor (flat reduction, then %); boss phase modifiers.
6. **Apply:** HP −dmg; the location's Durability −dmg; Guard check for shields (block: halves the damage before step 5).
7. **On-hit:** attacker TP +gain, defender TP +gain; counter checks; statuses with their resist checks (physical: 1.5×Resilience; mental: 1.5×Acuity); on-hit traits (Sanguine drain, Bleeder).
8. **Injury check:** Durability ≤ 0 → injury roll (§11), Resilience check (§7.4); HP ≤ 0 → Down and the final-blow roll.

Healing uses the same shape and pipeline with no hit roll (Sagacity-scaled), and can restore **Durability** as a separate effect kind (Soothsayer, Grit).

### 10.7 Telegraphs

- Heavy enemy abilities and all boss ultimates are **telegraphed**: the shape is drawn on the grid with a countdown in ticks (typically 150–300). Players can move out, shield, Defend, delay the enemy with Readiness damage (which pushes the countdown), or kill or cancel the caster.
- Telegraphed damage is **"insanely hard"**: 200–400% of a normal hit, often a forced injury roll on the location named, so eating one is a decision, not an accident.

### 10.8 Statuses [DECIDED list; durations to tune]

Durations are in ticks; "battle" means until the fight ends. Statuses persist across an expedition only where noted.

| Status | Kind | Effect |
|---|---|---|
| Poison | physical | 3% max HP per 50 ticks; 300 ticks; persists to the next battle unless cured |
| Bleed | physical | 2% max HP and 2 Durability on the bleeding location per 50 ticks; stops when healed |
| Stun | physical | CT set to 0 and cannot act until the next tick after 100 ticks; cancels charge |
| Knockdown | physical | Skip the next turn; Evasion −30% until then; cancels charge |
| Slow / Haste | physical | Speed −2 / +2, 300 ticks |
| Stop | physical | CT frozen, 150 ticks; bosses immune |
| Blind | physical | Accuracy −30%, 300 ticks |
| Burn | physical | Fire damage per 50 ticks; Water affinity shortens |
| Frozen | physical | Cannot move; Evasion −20%; shatters for bonus damage on crit |
| Disease | physical | Persists across the expedition: healing −50% until an Infirmary or cure |
| Berserk | mental | Auto-attacks nearest; physical +30%; cannot use abilities |
| Confusion | mental | Random target choice, 200 ticks |
| Sleep | mental | Cannot act until hit or 300 ticks; cancels charge |
| Charm | mental | Fights for the enemy for 200 ticks; bosses immune |
| Fear | mental | Must Move away or Wait on next turn; Sanity −5 per turn |
| Silence | mental | No spells; cancels spell charges |
| Deaf | mental | Minstrel songs don't reach; cannot hear telegraph warnings (UI hides them) |
| Madness | mental | From the Sanity table: random ability each turn, like a lost-control form |
| Protect / Shell | buff | Physical / magical damage −30%, 300 ticks |
| Regen / MP Regen / TP Regen | buff | +3% HP / +2 MP / +5 TP per 50 ticks |
| Reflect | buff | Next spell bounces to the caster's side |
| Enchant:<element> | buff | Weapon deals that element |
| Guard Up | buff | Shield block chance +25% |
| Provoke | buff on self | Single-target weight +200% |
| Hidden | buff | Cannot be single-targeted until acting |
| Shield (value) | buff | Absorbs damage before HP (Abjurer, Tinkerer drone) |
| Marked | debuff | Takes +20% damage; Tinkerer turrets follow up on Marked targets |
| Dispellable enemy buffs | enemy | Enemies commonly cast Protect, Haste, Enrage (+damage), Regen, Stoneskin; Abjurer dispels |

### 10.9 TP, Down and revival [DECIDED]

- TP starts at 0 (Pugilists at 20) and caps at 100; gains per §7.3. TP is lost at battle end.
- A Scion at 0 HP is **Down**: lying on their cell, not single-targetable by enemies except `finish` abilities, but still hit by every AoE that covers the cell (each hit is a new injury roll on a random location, which is the real danger). Revival (Soothsayer, items, Judgement Tarot events) returns them at 20% HP with no further roll. A battle won with Down Scions: they get up at 10% HP.
- Enemy "Down" is death; some enemies (undead) get up again unless Holy-killed.

### 10.10 Bosses [DECIDED]

- Speed **14–18** (vs ~10), immune to Stop, Charm, Sleep and instant death; Readiness damage at half; two to three **phases** at HP thresholds (new abilities, a telegraphed ultimate, adds spawned onto E2/E3).
- [DECIDED] **Minions are not immune.** A boss's adds can be Stopped, Charmed, Slept and delayed in full, and some bosses depend on them: a shield fed by adds, an ultimate that needs a living acolyte, a Charmed add that turns the boss's own buff against it. Killing or turning the minions is a legitimate route through a boss.
- A boss turn usually uses one multi-target shape; one in three turns is a telegraph. Bosses **dispel** or **punish** stacked buffs occasionally (an enemy Abjurer pattern), so buff timing matters.
- Every boss has a readable **pattern** (shown in the bestiary after the first encounter; Hermit/Observatory events can reveal it sooner) and at least one **weakness** (element, location, a specific debuff) that smart play exploits.

### 10.11 Enemy behaviour

Enemies have a role and a small priority list, the same gambit format Sorties use (§6.11): fodder attacks the front; bruisers go for the Marked or the lowest Durability location they can reach; casters charge AoEs on the densest cluster; supports buff and heal; elites interrupt chargers. Weights use the Front/Middle/Back column rule. Bosses override with scripted phase lists.

### 10.12 Battle flow and UI

1. Deploy: Scions are placed on the grid from a saved formation (editable in town; per party). Ambushed parties deploy randomly and start at CT 0; surprising parties start at CT 50.
2. Tick loop; turns; telegraphs; log.
3. End: victory (all enemies dead or fled), defeat (all Scions Down), retreat.
4. HUD: turn forecast (top), party panel (right: HP, MP, TP, four Durability pips, Sanity, statuses), enemy panel (left: visible HP bar, buffs), grid (center), action menu on the active Scion (Attack / <Primary set> / <Secondary set> / Item / Defend / Wait / Move), targeting preview with hit%, expected damage range, and location odds.

## 11. Hit locations, injury and sanity

[DECIDED, from the brief] Four hit locations (Head, Body, Arms, Legs) with Durability pools plus Sanity; depletion forces a "death's door" roll on that location's table; severity bands mild (battle-only), moderate (multi-Year), devastating (permadeath, severed limb, permanent blindness or incurable ailment); House traits modify rolls; heavy sanity damage queues sinister settlement events; some traumas are prerequisites for events. Everything below is **[PROPOSED]** unless tagged.

### 11.1 The roll [DECIDED]

- **d20 + modifiers**, read on the location's table. Higher is better.
- A **step** is **2 points** on the d20. All earlier references ("+1 step") mean this.
- Modifiers: Resilience (+1 step per 15, §7.3); House traits (Unbroken +1, Brittle Bones −1 on Arms/Legs, Grim Physicians +1 on Body…); Job passives (Grizzled: + by Might; Valor; Ravager's bloody-minded passives); Defend (+1); Tarot (The Hanged Man +1 at HP 0); the trigger: **HP 0 → −1 step**, **party wipe → −2 steps**, **a Broken location hit again → −1 step** (§7.4); telegraphed hits that name a location → −1 step.
- Bands by final result: **≤2 Devastating**, **3–8 Moderate**, **9–15 Mild**, **16+ Shrug** (a scar, nothing, or a lucky surge). The raw odds without modifiers are 10 / 30 / 35 / 25%; Resilience and traits push them toward Shrug, triggers push toward Devastating.
- The roll is shown as a card: location icon, the d20 tumbling, modifiers listed in Crunch Mode (or as words in Flavor Mode), the result text, and the sprite reacting (§15).
- **Lucky** (trait) rerolls one failed roll per battle; **Death** (Tarot) converts one fatal result per campaign into the next row down.

### 11.2 Durations and recovery

- **Battle** results end with the battle. **Expedition** results end at Reckoning.
- **Moderate** results last the Years shown and count down at Reckoning; an Infirmary slot (§8.3) heals one Year faster; some Soothsayer abilities and event cures end them early.
- **Devastating** results are **permanent** unless: a Workshop L2 prosthetic (restores partial function, see each entry), the Infirmary L3 once-per-campaign downgrade, a rare event (the Altar of Hands, the Grinning Surgeon, An Offer of Wings), or a Form that replaces the body. [DECIDED]
- [DECIDED] Some events and bosses instead reward a **cure item** (a Relic class, §13): the Saint's Hand (regrows an arm), a Clockwork Leg (a prosthetic with no penalty), the Seer's Eye (cures blindness, adds the Hollow-Eyed look), Lethe Water (cures a Devastating sanity result), the Surgeon's Kit (one Moderate injury removed). Cure items are **drafted like any loot** (§9.10), so Houses squabble over them, or carry them home for a favorite injured Scion. They also count for Relics score if unused.
- A Devastating result prompts the owner: **Retire** (Mentor) or **keep fielding** (penalties apply). Either is allowed (§6.12).
- **Vain** (flaw): disfiguring results (anything marked *scar* or worse on Head) also cost 10 Sanity.

### 11.3 Head table

| d20 | Result | Band |
|---|---|---|
| ≤1 | **Skull crushed.** Death. | Devastating |
| 2 | **Blinded.** Permanent Blind (Accuracy −30%, cannot target beyond adjacent cells without a passive). Prosthetic: none; cure only by event. | Devastating |
| 3 | **Concussion.** Acuity −25%, charge times +50%, mental resist −20%. 3 Years. | Moderate |
| 4 | **Shattered jaw.** Mute: no Minstrel songs, no Soothing Voice, no spoken event options. 2 Years. | Moderate |
| 5 | **Lost eye.** Accuracy −10% and Head Durability −10%, permanent, but not Retire-worthy. *scar* | Moderate (permanent) |
| 6–7 | **Cracked skull.** Head Durability −50%, mental resist −20%. 2 Years. | Moderate |
| 8–9 | **Dazed.** Stun now; Confusion 100 ticks. | Mild |
| 10–11 | **Scalp torn.** Bleed (Head) and Blind 100 ticks. | Mild |
| 12–13 | **Ears ringing.** Deaf this battle. | Mild |
| 14–15 | **Knocked senseless.** Knockdown. | Mild |
| 16–17 | **A scar to remember.** Sanity −5. *scar* | Shrug |
| 18–19 | Nothing. | Shrug |
| 20+ | **Clarity.** Head Durability refills to 50%; next spell charges instantly. | Shrug (boon) |

### 11.4 Body table

| d20 | Result | Band |
|---|---|---|
| ≤1 | **Run through.** Death. | Devastating |
| 2 | **Mortal wound.** [DECIDED] The Scion **dies when the battle ends**, no cure. Until then, **Last Stand**: the sprite is tinted pale, they are immune to Fear and to further injury rolls, deal +25% damage and gain +20 TP each turn; the party sees it ("They know. They fight anyway."). Death Tarot still applies if unspent. | Devastating |
| 3 | **Punctured lung.** Max HP −25%; cannot Sortie. 3 Years. | Moderate |
| 4 | **Broken ribs.** Body Durability −50%, Might −20%. 2 Years. | Moderate |
| 5 | **Internal bleeding.** Bleed persists across the expedition; healing received −50% until an Infirmary or Soothsayer cure. | Moderate (expedition) |
| 6–7 | **Cracked ribs.** Body Durability −30%. 1 Year. | Moderate |
| 8–9 | **Winded.** TP set to 0; Stun. | Mild |
| 10–11 | **Gashed.** Bleed this battle. | Mild |
| 12–13 | **Bruised deep.** Damage taken +10% and Defend costs 100 this battle. | Mild |
| 14–15 | **Staggered.** Knockdown. | Mild |
| 16–17 | **Armor dented.** Body armor −1 quality until repaired. | Shrug |
| 18–19 | Nothing. | Shrug |
| 20+ | **Second wind.** HP +20%; TP +20. | Shrug (boon) |

### 11.5 Arms table ("hands" is the same location)

| d20 | Result | Band |
|---|---|---|
| ≤1 | **Arm severed.** That hand's slot is gone: no two-handed weapons, no dual wield, no shield in that hand. Prosthetic (Workshop L2): a hook or iron hand allows a shield or a light one-hander at −15% accuracy. *disfiguring* | Devastating |
| 2 | **Hand mangled.** Accuracy −15% permanent; cannot dual wield or play instruments. Prosthetic: removes the dual-wield ban. | Devastating |
| 3 | **Broken arm.** That hand's slot unusable; spell charge +50%. 3 Years. | Moderate |
| 4 | **Torn shoulder.** Might −25%; two-handed weapons −20% damage. 2 Years. | Moderate |
| 5 | **Crushed fingers.** No knives, bows, instruments or lockpick options. 2 Years. | Moderate |
| 6–7 | **Sprained.** Arms Durability −50% for 1 Year; Accuracy −10% this expedition. | Moderate |
| 8–9 | **Disarmed.** Weapon dropped on the cell: a turn to pick up (or fight unarmed); Stun. | Mild |
| 10–11 | **Numb arm.** Physical damage −30% this battle. | Mild |
| 12–13 | **Bleeding arm.** Bleed this battle. | Mild |
| 14–15 | **Jarred.** TP −30. | Mild |
| 16–17 | **Gauntlet dented.** Arm armor −1 quality until repaired. | Shrug |
| 18–19 | Nothing. | Shrug |
| 20+ | **Adrenaline.** TP +30; next physical ability is a guaranteed crit. | Shrug (boon) |

### 11.6 Legs table

| d20 | Result | Band |
|---|---|---|
| ≤1 | **Leg severed.** Speed −3; cannot Move; Evasion −30%. Prosthetic (Workshop L2): Speed −1, Move 1 cell. *disfiguring* | Devastating |
| 2 | **Pelvis shattered.** Speed −2 permanent; movement CT ×2. Prosthetic: none; Infirmary L3 downgrade only. | Devastating |
| 3 | **Broken leg.** Speed −2; cannot Move. 3 Years. | Moderate |
| 4 | **Torn knee.** Evasion −20%; Speed −1. 2 Years. | Moderate |
| 5 | **Lamed.** Movement CT ×2; cannot Sortie. 2 Years. | Moderate |
| 6–7 | **Sprained ankle.** Legs Durability −50% for 1 Year; Speed −1 this expedition. | Moderate |
| 8–9 | **Swept.** Knockdown; Slow 200 ticks. | Mild |
| 10–11 | **Hamstrung.** Cannot Move this battle; Evasion −20%. | Mild |
| 12–13 | **Bleeding leg.** Bleed this battle. | Mild |
| 14–15 | **Tripped.** Knockdown. | Mild |
| 16–17 | **Boots ruined.** Legs Durability −5 this expedition. | Shrug |
| 18–19 | Nothing. | Shrug |
| 20+ | **Surge.** Haste 200 ticks; Legs Durability refills to 50%. | Shrug (boon) |

### 11.7 Sanity table (the check uses Sagacity; Resilience adds half)

| d20 | Result | Band |
|---|---|---|
| ≤1 | **Mind shattered.** Permanent Madness: the Scion acts randomly in battle and becomes a source of House events in town (they wander, they prophesy, they hurt someone). Retire or not; no cure but a Form or a miracle event. | Devastating |
| 2 | **Thrall of the Rift.** Permanent trait: at the start of every battle, 25% chance to be Charmed by the enemy for 200 ticks; whispers leak one House secret per Year to the rift (random settlement event seeded against the House). Cure: Chapel L3 ritual with Essence, once. | Devastating |
| 3 | **Catatonic.** Down for the rest of the battle (not revivable); Sanity recovery −50% for 3 Years; a **trauma incident** is queued (§11.8). | Moderate |
| 4 | **Obsession.** Gains a Curse tied to the enemy type that broke them (must attack that type first; Berserk vs it; Sanity −10 when it appears). 2 Years. Trauma incident queued. | Moderate |
| 5 | **Night terrors.** Nightmares trait until a Chapel L2 slot treats it; trauma incident queued. | Moderate |
| 6–7 | **Panic.** Fear 300 ticks; max Sanity −20% this expedition. | Moderate (expedition) |
| 8–9 | **Hysteria.** Confusion 200 ticks. | Mild |
| 10–11 | **Frozen.** Stun 100 ticks; next action +25 CT. | Mild |
| 12–13 | **Shaken.** Accuracy and spell accuracy −15% this battle. | Mild |
| 14–15 | **Weeping.** Skip the next turn. | Mild |
| 16–17 | **A new fear.** Gains a fear `eventTag` (spiders, the dark, the sea…) used by events. | Shrug |
| 18–19 | Nothing. | Shrug |
| 20+ | **Clarity.** Sanity refills to 50%; Acuity +1 permanent. | Shrug (boon) |

### 11.8 Trauma incidents (town consequences) [DECIDED]

- Sanity results 3–5, a Madness Scion in town, or a Scion whose Sanity ends an expedition below 25% queue a hidden **trauma incident** on the timeline 1–2 Years out, shown as "?" (Watchtower reveals it). It fires only if the Scion is in town that Year (on an expedition: deferred).
- Incident pool (each is a House event with a decision for the owner, sometimes the victim's House): **The Knife in the Night** (a servant or a recruit is murdered: recruit pool −1 or another House's Ward is the victim → Loyalty and Accord); **Sabotage** (a building of the House, or of the House the Scion resents, loses a level); **The Confession** (the Scion tells someone what they saw: Sanity restored, a Lore clue, or a Crisis leak); **Desertion** (the Scion walks into the rift; becomes Lost; a Rescue card appears); **The Sermon** (the Scion preaches: Unrest/Accord −5, or a recruit converts to a Bloodline tag); **Self-harm** (an injury roll on a random location at +2 steps).
- Chapel L1+ halves the chance an incident fires; a Guard assignment (§8.3) downgrades Knife and Sabotage to The Confession.

### 11.9 Cross-system hooks (so the implementer wires them)

- **House traits and passives** feed `injuryTable` modifiers by location (Unbroken, Brittle Bones, Grim Physicians, Grizzled, Valor, Ravager's `ironhide`), and `sanityTable` (Faithful of the Pale Saint, Haunted Halls, Hollow Hearts).
- **Events test injuries**: `scion:injured:<location>` and `scion:injured:any` rules; `requires` predicates like `injury:severed_arm`. First hooks: the Altar of Hands (regrowth → Grafted), the Grinning Surgeon (downgrade or relocate), An Offer of Wings, the Bone Market (buy with a limb).
- **Grit-Marked** [DECIDED]: a Scion who survives 3 Devastating results gains the trait **Grit-Marked** (injury rolls +1 step; `eventTag: grit`) and unlocks the event **Something Is Impressed**: a force offers a bargain (a Form, a Relic, a Bloodline tag) to the one who would not die.
- **Scars**: results marked *scar* / *disfiguring* add a visible sprite layer (bandage, eyepatch, hook) and Intimidation event options.
- **Retire prompt** on Devastating; **Chronicle** entry on death with the location and the killer (bestiary links).
- **Bosses and elites** aim at Broken locations when they can see one (enemy gambit `target:broken_location`).

## 12. Jobs and abilities

[DECIDED, from the brief] One Job per expedition, changed only in town; a primary ability set bought with progression, purchasable passives, one secondary ability set from another Job, a passive budget spent across every passive learned (modified by traits, consumables, Tarot, events), stat bonuses and sometimes free innate passives from the primary Job; the 14 Jobs and their briefs. Everything below is **[PROPOSED]** unless tagged. Numbers are first-pass.

### 12.1 Rules

- [DECIDED] **Base Jobs** (available at promotion): Soldier, Knight, Magus, Soothsayer, Vagabond, Pugilist, Minstrel, Gambler.
- **Advanced Jobs** unlock per Scion by JP in prerequisites: **Ravager** (Soldier 400), **Sword Saint** (Soldier 400 + Knight 400), **Abjurer** (Soothsayer 400 + Magus 200), **Conjurer** (Magus 400 + Soothsayer 200), **Tinkerer** (Vagabond 400 + Gambler 200), **Alterer** (Soothsayer 400 + Vagabond 400, *or* any Bloodline, *or* an event). Mentors can teach an advanced Job's JP directly, so **trained Scions reach advanced Jobs much sooner** [DECIDED]: a recruit who studies under a Sword Saint Mentor can be promoted already holding the prerequisite JP.
- **JP** [DECIDED]: earned in the current primary Job: ~100 per battle won, ~300 per expedition, 25 per Sortie, Study/Train per §8.3. Actives cost 50–400 JP, passives 100–300. A Job is **mastered** at all abilities bought (about 2,500 JP). Mastery grants the Job's **mastery passive** permanently (free, no budget).
- **Passive budget** [DECIDED]: **5 points at level 1, +1 every 6 levels** (6 at level 6, 7 at 12, 8 at 18, 9 at 24, **10 at level 30**), +1 from The World, +1 from certain consumables and events, −1 from some Curses. Passives cost **1–3 points**: most are 1–2 (a plain bonus is 1, a strong conditional bonus is 2), and 3 is reserved for build-defining ones (Quickcast, Bodyguard, Lifeline, One Cut, Counterspell, Quick Rites, Hybrid, Finale, Fortune Favors). The primary Job's **innate passives** are free while in that Job. Tune by playtest; the implementer should expose the base and per-level values in the tuning table.
- **Secondary set:** any Job with at least one active bought. Its actives use the Scion's current stats and the primary Job's multipliers (so a Magus using Warfare hits weakly).
- **Costs:** MP (persists across the expedition), TP (per battle), sometimes HP; **CT** is 100 unless stated. **Charge** is in ticks before Acuity (§7.3).
- **Equipment permissions** and **stat multipliers** per Job are in §12.3; armor weight ties to evasion and Legs Durability (§13).

### 12.2 Shared sub-systems [DECIDED]

- **Combos (Pugilist):** a Pugilist's turn is a **sequence**: pick moves one after another, each costing TP, until TP runs out or a **finisher** is used. Every move has a `tag` (jab, kick, grapple, breath); finishers require a pattern in this turn's sequence (e.g. `jab, jab, jab` → Flurry). Repeating a move in one sequence costs +5 TP each time, which rewards variety. The whole sequence costs 100 CT plus 10 per move beyond the third.
- **Components (Tinkerer):** at the start of each of their turns the Tinkerer is offered **3 random Components** (Spring, Gear, Powder, Lens, Wire, Vial, Plate, Core) and keeps one (two with the Scavenger passive; Workshop L1 gives +1 at battle start). Abilities list which Components they consume and what each adds (Powder: +AoE; Lens: +range/accuracy; Plate: +shield; Core: +power; Vial: +status). Unused Components are lost at battle end.
- **Dice (Gambler):** innate **Cast Lots**: at the start of every Gambler turn, 2d6 are rolled and a per-total effect applies (§12.7). Several abilities roll 2d6 for their own value and offer **Double Down**: roll again; the new total replaces the old unless it is lower by 4+, in which case the ability fizzles. Double Down can be taken up to three times.
- **Songs (Minstrel):** three layers, **Melody** (ally buff), **Harmony** (enemy debuff), **Chorus** (regen/cure/affliction over time). One of each active at a time; starting or replacing a layer costs **35 CT** and some MP; layers last until replaced or the Minstrel is Silenced, Down or Deaf. Songs reach every ally (or enemy) that is not **Deaf**, anywhere on the grid.
- **Forms (Alterer):** each Form is a Shift ability that replaces the Alterer's stats, abilities and sprite for a duration or until Revert. Forms are **controlled** unless marked *feral* (random abilities from the Form's set; rare, high payoff). Some Forms have a **Revert debuff**. Forms sit on the Scion's cell; large Forms occupy 2 cells.
- **Summons (Conjurer):** summons are entities on player cells with their own CT, HP and a short gambit list; they vanish at battle end. The Conjurer has a **binding cap** (2, +1 with Hive-Touched or the Kennels L2) and summons share one MP pool: the Conjurer's.

### 12.3 Job table (multipliers while in the Job; permissions; innate) [DECIDED as a start]

| Job | Multipliers | Weapons / armor | Innate passives (free in Job) | Mastery passive |
|---|---|---|---|---|
| Soldier | Might ×1.15, HP ×1.1 | any melee, bows; heavy armor, shields | Stalwart: Body Durability +10% | Warfare Veteran: TP start +10 |
| Knight | Resilience ×1.15, HP ×1.1, Speed −0 | swords, maces, spears; heavy armor, shields | Bulwark: Guard chance +10% | Oath: Protect on self at battle start |
| Magus | Acuity ×1.2, MP ×1.2, HP ×0.9 | staves, knives; light armor | Attunement: spell MP −10% | Overflow: 10% of spell damage returns as MP |
| Soothsayer | Sagacity ×1.2, MP ×1.15 | staves, maces; light/medium armor | Meditation: MP +3 per 100 ticks | Second Sight: injury rolls of adjacent allies +1 step |
| Vagabond | Guile ×1.2, Speed +1 | knives, bows, swords (one-hand); light armor | Quick Hands: items cost 60 CT | Shadowstep: first Move each battle is free |
| Pugilist | Might ×1.1, Guile ×1.1, Speed +1 | unarmed, knuckles, staves; light armor | Flow: TP +10 per hit instead of +10 shared | Iron Body: Arms and Legs Durability +15% |
| Minstrel | Sagacity ×1.1, Guile ×1.1 | instruments (two-hand), knives; light armor | Perfect Pitch: songs cost 25 CT | Encore: a fourth layer slot |
| Gambler | Guile ×1.15, Acuity ×1.05 | knives, thrown, pistols-as-crossbows; light/medium armor | Cast Lots (§12.2) | House Edge: Double Down fizzles only at −5 or lower |
| Ravager | Might ×1.3, HP ×1.15, Resilience ×0.9 | two-handed only (greatsword, greataxe, maul); medium armor, no shield | Ironhide: Body and Arms injury rolls +1 step | Deathless: once per battle survive a Death result as Mortal wound |
| Sword Saint | Might ×1.2, Guile ×1.1 | swords only (one or two-hand); medium armor | Focus: TP +5 per 100 ticks | Iaijutsu: the first sword technique each battle costs no TP |
| Abjurer | Sagacity ×1.15, Acuity ×1.1 | staves, maces; medium armor, shields | Warded: Shell on self at battle start | Aegis: shields you cast absorb +25% |
| Conjurer | Acuity ×1.15, Sagacity ×1.15, HP ×0.9 | staves; light armor | Binding (cap 2) | Legion: cap +1 |
| Tinkerer | Guile ×1.1, Acuity ×1.1 | crossbows, hammers; medium armor | Scavenge (§12.2) | Tinker's Eye: 4 Components offered |
| Alterer | Resilience ×1.1, Might ×1.1 | knives, claws; light armor | Shapeshift (Forms) | Chimera: keep one Form passive while human |

### 12.4 Soldier — Warfare (20 actives, 5 passives)

| Ability | Cost | Shape | Effect |
|---|---|---|---|
| Heavy Blow | 20 TP | single | +25% damage, crit +15% |
| Savage Strikes | 30 TP | single | 2–4 hits, accuracy −20% each |
| Grit | 25 TP | self | Restore 20% of a random location's Durability and 10% HP |
| Cleave | 25 TP | line:2 | Hits the target and the one behind it |
| Sweep | 30 TP | row (enemy, adjacent E1 cells) | 80% damage to up to 3 adjacent enemies in your row's reach |
| Shield Bash | 15 TP | single | Needs a shield: 60% damage, Stun chance by Might |
| Pin | 20 TP | single | Spear/bow: target cannot Move for 200 ticks |
| Hamstring | 20 TP | single | Legs-aimed: 70% damage, Slow |
| Skull Crack | 25 TP | single | Head-aimed: 70% damage, Confusion chance |
| Brace | 10 TP, 60 CT | self | Defend plus Knockdown immunity until next turn |
| Rally | 15 MP | burst:3x3 (allies) | TP +15 to allies in the burst |
| Hold the Line | 20 MP | row (allies) | Allies in your row: physical damage taken −20% for 300 ticks |
| Charge! | 20 TP | single | Move up to 3 cells toward Front then attack at +10% |
| Volley | 25 TP | burst:3x3 (enemy) | Bow: 60% damage to the burst |
| Throw Weapon | 15 TP | lob | Throw your weapon (lands on the target cell; retrieve later) for 120% damage |
| Finisher | 40 TP | single | +50% damage vs targets below 30% HP; refunds 20 TP on kill |
| Guard Break | 25 TP | single | Removes Protect and Guard Up; target Marked 200 ticks |
| War Cry | 20 MP | all (enemy) | Fear chance by Might; TP +10 to self |
| Second Wind | 30 TP, 60 CT | self | Cure Bleed and Slow; HP +15% |
| Last Stand | 50 TP | self | 300 ticks: damage +30%, Defend free each turn, but HP cannot be healed |

| Passive | Points | Effect |
|---|---|---|
| Skullsplitter | 2 | Might's influence on physical damage +50% when using an axe |
| Grizzled | 2 | Injury rolls for physical locations +1 step per 20 Might |
| Veteran | 2 | Chance (Guile %) to shrug off a negative event outcome once per expedition |
| Weapon Drill | 1 | Accuracy +5% with melee weapons |
| Battle Hardened | 2 | TP gain +25% when hit |

### 12.5 Knight — Chivalry (target 16/5; 12/5 drafted)

| Ability | Cost | Shape | Effect |
|---|---|---|---|
| En Garde | 20 TP | single | Attack; counter chance +40% for 500 ticks |
| Challenger | 15 TP, 60 CT | self | Provoke: single-target weight +200% for 300 ticks |
| Guardian Shout | 25 MP | burst:3x3 (allies) | Protect 300 ticks |
| Soothing Voice | 15 MP | adjacent | Sanity +10% to adjacent allies |
| Interpose | 20 TP | single ally | Until your next turn, hits on that ally strike you instead (if within 2 cells) |
| Shield Wall | 30 MP | column (allies) | Needs a shield: the column gains Guard Up 300 ticks |
| Lance | 25 TP | line:3 | Spear: hits three in a line, first at +20% |
| Riposte | 0 TP | — | Counter-attacks Stun on crit (stance toggle, 60 CT) |
| Oathbound Strike | 30 TP | single | Damage +20%; if an ally is Down, +60% |
| Rescue | 25 TP | single ally | Swap places with an ally anywhere in your row |
| Stand Fast | 20 MP | self | Immune to Knockdown, Fear and Readiness damage 300 ticks |
| Judgement | 40 TP | single | Holy-element strike at Head; Marked 300 ticks; ×1.5 vs undead and demons |

| Passive | Points | Effect |
|---|---|---|
| Valor | 2 | Chance (Resilience %) to end physical ailments early each turn |
| Commanding Presence | 2 | Allies in your column: physical accuracy +Sagacity/5 % |
| Shieldbearer | 1 | Guard chance +Resilience/4 % with a shield in the off-hand |
| Heavy Step | 1 | No evasion penalty from heavy armor |
| Bodyguard | 3 | Adjacent allies' single-target weight −30%, yours +30% |

### 12.6 Magus — Sorcery (target 20/5; 14/4 drafted)

| Ability | Cost | Shape / charge | Effect |
|---|---|---|---|
| Ember | 8 MP | single, charge 0 | Fire 1.0× |
| Firestorm | 30 MP | burst:3x3, charge 150 | Fire 1.6×, Burn |
| Rain of Cinders | 60 MP | band:3, charge 300 | Fire 2.0× over a third of the grid (telegraphed to enemies' benefit too) |
| Frost Lance | 10 MP | line:2, charge 50 | Water 1.2×, Slow |
| Glacier | 45 MP | column, charge 250 | Water 1.6×, Frozen chance |
| Gale | 10 MP | row, charge 50 | Wind 0.9×, Readiness damage 20 |
| Tempest | 50 MP | all, charge 300 | Wind 1.3×, Knockdown chance |
| Stoneburst | 12 MP | cross, charge 80 | Earth 1.2× |
| Earthen Maw | 40 MP | burst:3x3, charge 200 | Earth 1.5×; targets cannot Move 200 ticks |
| Dusk Needle | 10 MP | single, charge 0 | Dark 1.1×, Blind chance |
| Radiant Lance | 12 MP | single, charge 50 | Holy 1.3×; ×2 vs undead |
| Siphon | 0 MP, 20% HP | self | Convert 20% max HP into MP (1 HP : 1.5 MP) |
| Mind Blight | 20 MP | single, charge 100 | Sanity damage; Confusion chance |
| Nova | 80 MP, 50 TP | burst:5x5, charge 400 | Element of choice 2.5×; caster Stunned after |

| Passive | Points | Effect |
|---|---|---|
| Elemental Mastery | 2 | Pick an element: its spells +15%, cost −10% |
| Quickcast | 3 | Charge times −25% |
| Glass Cannon | 1 | Spell damage +15%; Head Durability −20% |
| Mana Font | 2 | MP regen +2 per 100 ticks |

### 12.7 Gambler — Cast Lots (target 14/4; 10/4 drafted)

Innate Cast Lots table (2d6 at the start of each Gambler turn): **2** next action +25 CT; **3–4** TP −10; **5** nothing; **6** Evasion +10% until next turn; **7** HP +5%; **8** MP +5%; **9** TP +10; **10** Accuracy +10% until next turn; **11** next hit cannot miss; **12** next action is a guaranteed crit.

| Ability | Cost | Shape | Effect |
|---|---|---|---|
| Loaded Dice | 15 MP | single ally | Ally's next attack: +crit 25% |
| Mulligan | 10 MP | single ally | Grants 1 "reroll a miss" charge |
| Knife Toss | 15 TP | lob | 2d6 × 10% of weapon damage; Double Down |
| Snake Eyes | 25 TP | single | If the 2d6 total ≤ 4: instant 300% damage; else 50% |
| Fortune's Cure | 20 MP | single ally | Heal 2d6 × 5% max HP; Double Down |
| All In | 50 TP | burst:3x3 | 2d6: ≥10 triple damage to the burst; ≤4 damage self |
| Marked Card | 20 MP | single enemy | Marked; the next 2d6 rolled against it count as 11 |
| House Rules | 30 MP | all allies | Everyone's next Cast Lots roll is 7+ (minimum) |
| Cheat Death | 40 MP | single ally | For 300 ticks, that ally's injury rolls get a Lucky reroll |
| Last Chip | 60 TP | single | Damage = (100 − your HP%) × 3% of max; crit if Cast Lots was 12 this turn |

| Passive | Points | Effect |
|---|---|---|
| Lucky Streak | 2 | Each 7+ Cast Lots roll in a row adds +2% crit (resets on ≤6) |
| Weighted | 2 | Cast Lots rolls of 2 become 3 |
| Risk Taker | 1 | Double Down fizzle threshold −1 |
| Fortune Favors | 3 | Event outcome weights shift +10% toward the best outcome for this Scion |

### 12.8 Vagabond — Larceny (target 16/5; 12/5 drafted)

| Ability | Cost | Shape | Effect |
|---|---|---|---|
| Backstab | 25 TP | single | +100% damage vs a target that has not acted since your last turn or is Marked |
| Envenom | 15 TP | self | Weapons inflict Poison 300 ticks |
| Hamstring Cut | 20 TP | single | Legs-aimed, Bleed |
| Eye Gouge | 20 TP | single | Head-aimed, Blind |
| Steal | 10 TP | single | Take an item or a buff from the target (Guile vs their level) |
| Smoke Bomb | 20 MP | burst:3x3 (allies) | Hidden 100 ticks |
| Fan of Knives | 30 TP | checker (enemy) | 60% damage to one parity of the enemy grid |
| Shadow Lunge | 25 TP | single | Move to any empty cell in the enemy's reach and strike at +20% (then you are exposed) |
| Dirty Trick | 15 TP | single | Random: Stun, Blind, Disarm or Readiness damage 30 |
| Vanish | 30 MP | self | Hidden until you act; next Backstab +50% |
| Pickpocket the Reaper | 40 TP | single | Steal 20 CT from the target and give it to an ally |
| Coup de Grâce | 35 TP | single | Execute a target below 20% HP; always crits |

| Passive | Points | Effect |
|---|---|---|
| Dual Wield Mastery | 2 | Off-hand hits at 80% instead of 50% |
| Knife Flurry | 2 | Guile/4 % chance of an extra hit with knives |
| Cutthroat | 2 | Crit damage ×1.75 instead of ×1.5 |
| Light Step | 1 | Movement CT −5 per cell |
| Sixth Sense | 2 | Cannot be surprised; traps in events revealed |

### 12.9 Soothsayer — Animism (target 16/5; 12/5 drafted)

| Ability | Cost | Shape / charge | Effect |
|---|---|---|---|
| Mend | 10 MP | single ally | Heal 1.0× |
| Mending Rain | 30 MP, charge 100 | burst:3x3 | Heal 0.8× |
| Knit Bone | 15 MP | single ally | Restore 40% Durability to one location |
| Whole Body | 40 MP, charge 150 | single ally | Restore 25% to all locations and cure Bleed |
| Purify | 12 MP | single ally | Cure physical ailments |
| Clear Mind | 12 MP | single ally | Cure mental ailments; Sanity +10% |
| Ward of Thorns | 20 MP | single ally | Attackers of the ally take 30% of their damage back for 200 ticks |
| Spirit Lamp | 25 MP | burst:3x3 (allies) | Sanity +15%; Fear immune 200 ticks |
| Breath of Life | 50 MP, charge 200 | single ally | Revive at 20% HP |
| Ancestor's Shield | 30 MP | single ally | Next injury roll +2 steps |
| Hex | 15 MP | single enemy | Damage taken +15% for 300 ticks; undead also take Holy damage over time |
| Commune | 20 MP, 60 CT | self | Reveal all enemies' HP, weaknesses and the boss's next telegraph |

| Passive | Points | Effect |
|---|---|---|
| Wellspring | 2 | MP +5 per 100 ticks |
| Gentle Hands | 2 | Healing dealt +15% |
| Lifeline | 3 | When an ally hits 0 HP within 2 cells, 25% chance they stay at 1 HP instead (once per battle) |
| Calming Presence | 1 | Allies adjacent: Sanity loss −20% |
| Herb Lore | 1 | Consumables you use heal +30% |

### 12.10 Pugilist — Martial Arts (target 16 moves / 4 passives; 12/4 drafted)

Moves (each costs TP; see Combos §12.2). Tags in brackets.

| Move | TP | Effect |
|---|---|---|
| Jab [jab] | 5 | 60% damage; generates 8 TP on hit (net +3) |
| Hook [jab] | 10 | 90% damage |
| Low Kick [kick] | 10 | Legs-aimed 70%; Slow |
| High Kick [kick] | 15 | Head-aimed 90% |
| Grapple [grapple] | 15 | Target cannot Move or counter until its next turn |
| Throw [grapple] | 20 | Move the target to any adjacent enemy cell (into AoE, out of reach); 80% damage |
| Breath [breath] | 10 MP | Cure Stun/Knockdown on self; TP +15 |
| Palm Strike [jab] | 15 | Body 100%; Readiness damage 15 |
| **Flurry** (finisher: jab ×3) | 20 | 5 hits at 50% |
| **Dragon Kick** (finisher: kick, kick, jab) | 25 | 200% at Legs; Knockdown |
| **Spine Breaker** (finisher: grapple, grapple) | 30 | 180% at Body; +50% vs large (multi-cell) enemies; Knockdown |
| **Hundred Fists** (finisher: 5+ distinct moves) | 35 | 300% split across a burst:3x3 |

| Passive | Points | Effect |
|---|---|---|
| Rising Spirit | 2 | TP +20 at battle start |
| Counterpunch | 2 | Counter chance +25% unarmed |
| Iron Fists | 1 | Unarmed damage scales with level (weapon power = level × 2) |
| Second Breath | 2 | Breath also cures Fear and Confusion |

### 12.11 Minstrel — Symphony (target 18 songs / 4 passives; 12/4 drafted)

| Song | Layer | MP | Effect |
|---|---|---|---|
| March | Melody | 15 | Allies Speed +1 |
| Hymn of Iron | Melody | 15 | Physical damage taken −15% |
| Ballad of Embers | Melody | 15 | Allies' attacks gain +10% Fire damage |
| Lullaby | Harmony | 20 | Enemies Speed −1; Sleep chance on cast |
| Dirge | Harmony | 20 | Enemies' healing −50%; undead Fear |
| Mockery | Harmony | 15 | Enemies' accuracy −10% |
| Requiem | Harmony | 25 | Enemy buffs expire twice as fast |
| Hearthsong | Chorus | 15 | Regen 3% per 50 ticks |
| Fountain | Chorus | 15 | MP Regen +2 per 50 ticks |
| Drumbeat | Chorus | 15 | TP +5 per 50 ticks |
| Cleansing Air | Chorus | 20 | Cure one physical ailment on each ally per 100 ticks |
| Plague Chant | Chorus | 20 | Enemies take Poison each 100 ticks |

| Passive | Points | Effect |
|---|---|---|
| Carrying Voice | 1 | Songs also reach Deaf allies at half effect |
| Crescendo | 2 | Each layer that has lasted 300+ ticks is +50% stronger |
| Heartstring | 2 | Replacing a layer heals Sanity 5% to all allies |
| Finale | 3 | Dropping all three layers at once deals 2.0× Sagacity-scaled damage to all enemies (60 CT) |

### 12.12 Ravager — Bloodlust (target 14/4; 10/4 drafted)

| Ability | Cost | Shape | Effect |
|---|---|---|---|
| Reckless Swing | 20 TP | single | +60% damage; your Evasion −20% until next turn |
| Blood Price | 15% HP | single | Attack at +40%; costs HP not TP |
| Drink Deep | 25 TP | single | Drain 50% of damage as HP |
| Whirl | 35 TP | ring (enemy reach) + row | Hit every enemy in reach at 80% |
| Rend | 20 TP | single | Bleed; +Marked |
| Steal Strength | 30 TP | single | Might +10% to you, −10% to the target, 300 ticks |
| Frenzy | 40 TP | self | 500 ticks: attacks cost 70 CT, −15% accuracy, cannot Defend |
| Unstoppable | 20 MP | self | Immune to Knockdown, Stun, Fear 300 ticks; injury rolls +1 step |
| Executioner | 45 TP | single | 150% at Head; crit vs Marked |
| Hold Together | 30 TP, 60 CT | self | Restore 30% Durability on your most damaged location; HP cannot be healed above 50% this battle |

| Passive | Points | Effect |
|---|---|---|
| Pain is Fuel | 2 | TP +10 extra when hit |
| Iron Will | 2 | At HP < 30%, injury rolls +2 steps |
| Two-Handed Mastery | 2 | Two-handed weapon power +20% |
| Thick Blood | 1 | Bleed immune |

### 12.13 Sword Saint — Swordplay (target 14/4; 10/4 drafted)

| Ability | Cost | Shape | Effect |
|---|---|---|---|
| Crescent Cut | 30 TP | cross | 120% to the cross |
| Thousand Cuts | 50 TP | burst:3x3 | 150% to the burst; Bleed |
| Still Water | 20 MP | self | TP +25; next technique +20% |
| Draw Cut | 25 TP | single | 140%; must be the first action of the battle for +crit |
| Blade Ward | 25 MP | single ally | Ally's TP +20 and counter chance +20% 300 ticks |
| Severing Wind | 60 TP | column | 130% to the whole column; Readiness damage 30 |
| Iron Resolve | 30 MP | row (allies) | Allies in your row gain TP Regen 300 ticks |
| Zenith Strike | 80 TP | single | 300%; Head-aimed; Stun; vs bosses: cancels a telegraph in progress |
| Mirror Stance | 0, 60 CT | self | Reflect physical hits as counters until next turn; costs 20 TP per counter |
| Sheathe | 10 TP, 60 CT | self | TP +15 and clear Bleed; next turn comes 20 CT sooner |

| Passive | Points | Effect |
|---|---|---|
| Sword Focus | 2 | TP gain +25% with swords |
| Breath of Steel | 2 | Sword techniques' MP buffs last +100 ticks |
| One Cut | 3 | Crit damage ×2 with two-handed swords |
| Serene | 1 | Sanity loss −25% |

### 12.14 Abjurer — Warding (target 14/4; 10/4 drafted)

| Ability | Cost | Shape / charge | Effect |
|---|---|---|---|
| Barrier | 20 MP | single ally | Shield = 30% of their max HP |
| Bulwark | 45 MP, charge 100 | burst:3x3 | Shield = 15% to each |
| Dispel | 15 MP | single enemy | Remove all dispellable buffs |
| Purge | 40 MP, charge 100 | all (enemy) | Remove one buff from every enemy |
| Reflect | 30 MP | single ally | Reflect 300 ticks |
| Flame Brand / Frost Brand / Storm Brand / Stone Brand / Dawn Brand / Dusk Brand | 15 MP | single ally | Enchant:<element> 300 ticks |
| Thorn Ward | 25 MP | single ally | Melee attackers take 30% back |
| Silence | 20 MP | single enemy | Silence 200 ticks (cancels charges) |
| Anchor | 20 MP | single ally | Immune to Readiness damage, Knockdown, Charm 300 ticks |
| Null Zone | 60 MP, charge 200 | band:3 (enemy) | Enemies in the band cannot cast for 200 ticks |

| Passive | Points | Effect |
|---|---|---|
| Lasting Wards | 2 | Buffs you cast +100 ticks |
| Counterspell | 3 | When an adjacent ally is targeted by a spell, 25% chance to Dispel it |
| Thick Skin | 1 | Shell on self at battle start |
| Ward-Sense | 1 | Enemy buffs are shown with their remaining ticks |

### 12.15 Conjurer — Summoning (target 12 summons + 6 spells / 4 passives; 8+4/4 drafted)

| Summon | MP / charge | Cell | Role |
|---|---|---|---|
| Carrion Crows ×2 | 20 / 100 | any player cell | Fodder: 40% damage pecks, draw single-target fire |
| Bone Hound | 35 / 150 | Front | Bruiser: Bleed bites; 300 ticks |
| Marsh Lantern | 30 / 100 | Back | Support: Sanity +5% to adjacent allies per 100 ticks |
| Ember Imp | 40 / 150 | any | Caster: Ember each turn; explodes on death (burst:3x3 Fire) |
| Stone Sentinel | 60 / 250 | Front | Tank: 2 cells; Provoke; Guard |
| Drowned Choir | 70 / 300 | Back | Harmony-like aura: enemies −10% accuracy; Sanity attacks |
| Wyrmling | 120 / 400 | 2 cells | Heavy: 180% Fire breath line:3 |
| The Hollow Host | 150 / 500 | 3 cells | Finisher: hits all enemies 1.5× each turn for 300 ticks, then leaves |

| Spell | MP / charge | Shape | Effect |
|---|---|---|---|
| Sacrifice | 0 | single summon | Dismiss a summon: allies in burst:3x3 heal 20% |
| Swarm | 50 / 200 | all (enemy) | Poison and Blind chance |
| Pact of Blood | 20% HP | self | Next summon costs no MP |
| Banish | 30 / 100 | single | Remove an enemy summon or add instantly |

| Passive | Points | Effect |
|---|---|---|
| Lingering | 2 | Summons last +200 ticks |
| Bloodbound | 2 | Summons heal the Conjurer 10% of damage they deal |
| Quick Rites | 3 | Summon charge times −30% |
| Familiar | 1 | Battle starts with Carrion Crows ×1 free |

### 12.16 Tinkerer — Innovation (target 16/4; 12/4 drafted)

| Ability | Component use | Shape | Effect |
|---|---|---|---|
| Bolt | — | single | Crossbow 100%; +Lens: never misses |
| Scatter Shot | Powder | burst:3x3 | 70% to the burst |
| Shrapnel Mine | Powder + Plate | enemy cell | Triggers on the next enemy to act in a burst:3x3 |
| Turret | Gear + Core | player cell | Entity: follows up every ally physical hit on a Marked target at 50%; 300 ticks |
| Shield Drone | Plate + Wire | player cell | Entity: gives the nearest ally a Shield 15% that recharges every 150 ticks |
| Smoke Canister | Vial | burst:3x3 (allies) | Hidden 100 ticks |
| Tonic Sprayer | Vial + Spring | cross (allies) | Heal 0.8× and cure Poison |
| Grapple Line | Wire | single | Pull an enemy one column closer (into melee reach) |
| Overclock | Core | single ally | +30 CT now; their next ability's charge is instant |
| Flashbang | Powder + Lens | band:3 (enemy) | Blind and Readiness damage 20 |
| Repair | Gear | single ally or construct | Restore 30% Durability (one location) or 40% construct HP |
| Jury-Rig | any 3 | self | Convert three Components into a random magic consumable |

| Passive | Points | Effect |
|---|---|---|
| Scavenger | 2 | Keep 2 of the 3 Components offered |
| Field Engineer | 2 | Constructs have +50% HP and act 10 CT sooner |
| Pack Rat | 1 | Start each battle with 1 Component from last battle |
| Precision | 1 | Lens effects also add +10% crit |

### 12.17 Alterer — Flesh Shaping (target 10 Forms + 4 tools / 4 passives; 6+3/4 drafted)

| Form | Cost / duration | Control | While shifted | Revert |
|---|---|---|---|---|
| Werewolf | 30 MP / 500 ticks | controlled, Frenzy | Attacks cost 70 CT, Bleed on hit, heal 25% of damage dealt; Might ×1.3 | Exhausted: Speed −2, 300 ticks |
| Ember Elemental | 25 MP / 400 | controlled | Aura: adjacent allies Fire +25% resist and +15% Fire damage; your attacks are Fire | none |
| Marsh Thing | 25 MP / 400 | controlled | Poison immune; attackers Poisoned; Regen; cannot Move more than 1 | Slow 200 |
| Stone Colossus | 40 MP / 400 | controlled, 2 cells | Provoke; Guard 50%; Readiness damage immune; cannot be healed | Body Durability −30% this battle |
| Shrike | 20 MP / 300 | controlled | Flying: ignores reach, Speed +3, lob attacks; HP ×0.7 | none |
| Rift Spawn | 50 MP / 300 | *feral* | Random abilities from a potent set (Nova, Swarm, Tempest…) each turn | Sanity −20% |

| Tool | Cost | Effect |
|---|---|---|
| Revert | 0, 60 CT | End the Form early |
| Graft | 20 MP | Give an ally one Form passive for 200 ticks (e.g. Marsh Thing's Poison immunity) |
| Molt | 30 MP | Cure all physical ailments; restore 20% Durability on all locations; Sanity −5% |

| Passive | Points | Effect |
|---|---|---|
| Stable Flesh | 2 | Revert debuffs halved |
| Long Shift | 2 | Forms +150 ticks |
| Hybrid | 3 | Keep one Form aura for 100 ticks after Revert |
| Wild Blood | 1 | Feral Forms: 50% chance each turn to choose the ability yourself |

### 12.18 Appearance and Jobs

Each Job has a sprite outfit (LPC layers) applied over the Scion's body; the player can restyle within the Job's palette. House color tints the tabard/cloak; the emblem stamps the chest where the layer allows (§5.4). Forms replace the sprite entirely.

## 13. Equipment and items

[DECIDED, from the brief] One-hand / two-hand / dual wield; shields in the off-hand; weapon types (sword, axe, knife…); gear weight and gear slots (both used by event rules); equipment raises or lowers ailment resistances and elemental affinities; powerful equipment exists and the difficulty assumes it is used well. [DECIDED, batch 10] **Items must be really interesting**: varied, flavorful, squabbled over by the Houses and worth real money; coveted shop items are auctioned (§13.4a). Everything below is **[PROPOSED]** unless tagged.

### 13.1 Slots [DECIDED]

| Slot | Holds |
|---|---|
| Main hand | A one-hand or two-hand weapon (two-hand also fills the off-hand) |
| Off hand | A shield, a second one-hand weapon (dual wield), a thrown weapon, a focus, or empty |
| Head | Helm / hood / circlet → Head Durability and Head injury modifiers |
| Body | Armor → Body Durability, physical defense |
| Arms | Gauntlets / gloves / bracers → Arms Durability, accuracy |
| Legs | Greaves / boots → Legs Durability, movement CT |
| Accessory ×2 | Rings, amulets, charms, trinkets, Tarot-linked tokens |

- **Gear weight** = sum of all slots' weight. Weight above the Scion's **carry** (10 + Might/2) costs **Evasion −1% per point** and movement CT +1 per point. "Heaviest gear" and "most open slots" event rules read these numbers.
- Jobs restrict weapon types and armor class (§12.3). A Scion wearing something their Job disallows cannot depart.
- Loadouts lock at departure; items in the party **satchel** (shared, 12 slots) can be used by anyone.

### 13.2 Weapons [DECIDED as the type guidelines; stats are per item, §13.4]

| Type | Hands | Power / Acc / Crit | Reach | Location bias (aimed shots available) | Notes |
|---|---|---|---|---|---|
| Sword | 1h / 2h | 100 / 90 / 5 | melee | even | Sword Saint techniques |
| Axe | 1h / 2h | 115 / 85 / 8 | melee | Arms, Body | Skullsplitter; Bleed on crit |
| Mace / Hammer | 1h / 2h | 105 / 85 / 5 | melee | Head | Ignores 25% of armor; Stun on crit |
| Spear | 2h | 95 / 90 / 5 | reach (hits from Middle at full; line:2) | Body | Pin |
| Knife | 1h (pairs) | 60 / 95 / 12 | melee | Arms, Head | Dual-wield friendly; Knife Flurry; +TP gain |
| Knuckles / claws | pair | 50 / 95 / 8 | melee | even | Pugilist moves scale with level (Iron Fists) |
| Bow | 2h | 85 / 85 / 8 | ranged (−10% from Front) | Legs, Head | Volley, Pin; ranged ignores formation |
| Crossbow | 2h | 110 / 80 / 10 | ranged | even | Slow reload: 120 CT basic attack; Tinkerer Bolt ignores this |
| Thrown (off-hand) | off | 70 / 90 / 5 | lob | even | Consumed unless retrieved; Gambler Knife Toss |
| Staff | 2h | 60 / 90 / 2 | melee | even | +MP, +spell power |
| Instrument | 2h | 40 / 90 / 0 | — | — | Enables songs; Minstrel damage is Sagacity-scaled |
| Shield (off) | off | — | — | — | Guard chance 15–35% by size; Shield Bash, Shield Wall; heavy |

- [DECIDED] **Dual wield any one-hand weapons:** a Scion whose Job allows dual wield may pair any two one-hand weapons (sword and axe, mace and knife, two swords), not only knives. The off-hand weapon hits at 50% (80% with Dual Wield Mastery); both weapons' on-hit effects and properties apply, which is the point of pairing a Bleeding knife with a Draining sword. Knives alone keep their +TP bonus when paired. Clumsy doubles the penalty, Ambidextrous removes it.
- **Two-handed:** power ×1.4 of the one-hand version; no shield.
- **Basic Attack** is free (0 TP, 100 CT) and generates TP; every Job has it.

### 13.3 Armor [DECIDED: classes as guidelines, stats per item]

| Class | Weight per slot | Defense | Durability bonus to the slot's location | Evasion |
|---|---|---|---|---|
| Light (cloth, leather) | 1 | low | +10% | none |
| Medium (mail, brigandine) | 2 | mid | +25% | −3% per slot |
| Heavy (plate) | 3 | high | +50% | −6% per slot (Heavy Step removes) |

- [DECIDED] **Stats are per item, not per class.** The class table is a guideline: a specific breastplate may trade defense for less weight, a specific hood may give no Durability and a Sanity ward instead. Every item carries its own numbers; the implementer authors items against the class table and may deviate ±25% from it, and more for named items.
- Armor gives **flat physical defense** (subtracted from physical damage after multipliers) plus its Durability bonus; magic defense comes from Shell, Sagacity and specific gear.
- Helms with visors: Head Durability +, accuracy −2%; open helms the reverse.
- Armor **quality** drops by 1 on "dented" injury results and is repaired at a Forge for Iron.

### 13.4 Quality tiers, properties and crafting [DECIDED: tiers; properties per item, many]

| Tier | Name | Source | Properties |
|---|---|---|---|
| 1 | Crude | starting gear, Fence | base stats −10% |
| 2 | Common | Forge L1, Armorer/Weaponsmith tier 1 | base |
| 3 | Fine | Forge L2, shops tier 2 | base +10%, 1 property |
| 4 | Masterwork | Forge L3 with a rare material, shops tier 3, boss loot | base +20%, 2 properties |
| 5 | Relic | unique: events, bosses, mandatory expeditions | base +30%, 2–3 properties, a name, a story, Relics score |

- [DECIDED] **Properties are what make items interesting.** There are many, they are unique in feel, and they roll or are crafted (Forge L2+ with Essence) per item. Fine items carry 1, Masterwork 2, Relics 2–3 plus a unique effect. The catalogue is the implementer's to grow; the first pass:

  **Weapon properties**

  | Property | Effect |
  |---|---|
  | Multi-hit | 10–25% chance a weapon attack strikes twice (the second hit at 60%) |
  | Keen | Crit chance +5–15% |
  | Massive crits | Crit damage ×2.5 instead of ×1.5 |
  | <Element> edge | Deals +20–40% of weapon damage as that element on top (a weapon can carry only one) |
  | Draining | Heals the wielder 10–20% of damage dealt |
  | Surging | TP gain +25–50% per hit |
  | Mana-thirst | MP +2–4 per hit |
  | Quickening | Speed +1 (rare; Masterwork+ only; one per Scion counting Accessories and Legs) |
  | Headsman's / Hamstringer / Mauler / Breaker | Location bias to Head / Legs / Arms / Body and ×1.25 against that weak point on monsters; Hamstringer also Slows |
  | Staggering | Readiness damage −10 on hit |
  | Bleeding / Venomed / Burning / Stunning / Dreadful | 15–30% chance to apply Bleed / Poison / Burn / Stun / Fear on hit |
  | Giantslayer | +30% against multi-cell enemies |
  | <Tag>-bane | +50% against undead / demons / beasts / constructs / aberrations / humans |
  | Executioner's | +50% against enemies below 25% HP |
  | Charged | The first attack each battle deals double damage |
  | Riposting | 20% chance to counter a melee hit |
  | Reaching | Melee from Middle at full value (a long sword, a flail) |
  | Returning | A thrown weapon is not consumed |
  | Spellbound | Weapon attacks use Acuity instead of Might when it is higher |
  | Siphoning | Dispels one buff on hit |
  | Oathbound | +10% damage while a Scion of the same House is on the field |
  | Hungry | +1% power per kill, up to +25%; loses it all when the wielder is Down |
  | Blessed / Hexed | Holy / Dark element and Sanity +5 / −5 to the wielder per battle |
  | Lucky | Rerolls one miss per battle |
  | Twinned | A paired weapon: no off-hand penalty when wielded with its twin |

  **Armor properties** (Head, Body, Arms, Legs)

  | Property | Effect |
  |---|---|
  | Fortified | Durability +15–30% to the slot's location |
  | Padded | Injury rolls on that location +1 step |
  | Thorned | Reflects 10–20% of melee damage taken |
  | Resistant: <ailment> | That ailment resist +25–50% |
  | Warded: <element> | That element −15–30% damage taken |
  | Guarding | Guard chance +10% (with any shield) |
  | Second Wind | Once per battle, survive a Down at 1 HP |
  | Stalwart | Immune to Knockback and forced movement (Kelpies, Grapplers) |
  | Lightfoot | Movement CT −5 per cell |
  | Bulwark | Adjacent allies take −10% physical |
  | Quiet | Ambush chance against the party −10% |
  | Visored | Head Durability +, accuracy −2% (open helms the reverse) |
  | Gravewalker | Immune to Fear from undead |
  | Mourning | Sanity damage taken −25% |
  | Dented (negative) | Quality −1 until repaired |

  **Accessory properties**

  | Property | Effect |
  |---|---|
  | Quickening | Speed +1 (rare; the strongest property in the game) |
  | <Stat> | A core stat +2–5 |
  | Ready | Start every battle at 20 TP |
  | Attuned | MP +3 per turn |
  | Resolute | Sanity +2 per turn in battle |
  | Tarot amplifier | The Scion's Tarot bonus doubled |
  | Sworn | A Ward wearing it gains +5 Loyalty per Year |
  | Essence sense | Essence drops +25% for the party |
  | Renowned | Kills by this Scion credit +1 Renown (per battle) |
  | Keen eye | Crit +5% |
  | eventTag | "Holy symbol", "Thieves' token", "Noble signet": events offer an extra option to the wearer |
  | Cursed properties (§13.5) | Sanity −15%; Holy −30%; cannot Defend; Marked at battle start; whispers |

- **Negative properties** can roll on found gear: an ailment resist −25%, Sanity −10%, an element −20%, Hungry's loss clause without its gain.
- **Named items.** The content should include many named Fine-and-better items with a line of flavor and a distinct combination, so that two Houses want the same thing. Seed examples: *Widow's Kiss* (knife: Massive crits, Bleeding), *The Tithe-Taker* (axe: Draining, Hungry), *Lantern Spear* (spear: Holy edge, lights its `row` against ambush), *Grandfather's Mail* (Body: Second Wind; the Lineage eventTag), *The Hollow Crown* (Head, cursed: Quickening, Marked, whispers), *Bell of the Drowned* (instrument: hearing allies resist Charm, Sanity −5 per song), *Ratcatcher's Gloves* (Arms: Surging, Thorned), *Pilgrim's Sandals* (Legs: Lightfoot, Quiet, Light class).
- **Reforge** (Forge L2): reroll one property for Essence. **Identify** (Scriptorium L2): found items are drafted blind (tier shown, properties hidden) unless identified first; the squabble is the point.
- **Recipes** come from resource expeditions and events; rare materials (Wyrmbone: Fire + Might; Moonsilver: Dark/Holy + Speed chance; Voidglass: spell power + Sanity −; Saint's Ash: Holy + injury steps; Hollow Ivory: Durability + Sanity −) gate Masterwork recipes.

### 13.4a Auctions [DECIDED]

- When a **shop stocks an item of Masterwork or Relic grade**, or any item with a rare property (Quickening, Multi-hit, Massive crits, a Relic effect), and **more than one House wants it** that Year, it is **auctioned**: a sealed bid in Gold from each interested House, highest bid wins and pays it, losers pay nothing. A tie costs Accord −3 and goes to the higher Renown (the all-votes rule). If only one House wants it, it pays the list price. Common and Fine stock sells at list price, first come.
- Houses may also **auction their own items** to each other (a Relic, a cure item): the seller sets a reserve, the others bid sealed, and the sale is an instant deal (§8.9). The Commons auctions items that fell to it by a `vote` rule, the Gold going to the Commons.
- Bids are private until the result; the winner and the price are public (a Standing clue). A Watchtower L3 also reveals the second-highest bidder's House.

### 13.5 Cursed gear [DECIDED]

- A cursed item is **Masterwork-grade with a drawback** (Sanity −15%; Holy −30%; cannot Defend; the wearer is Marked at battle start; whispers that queue a trauma incident) and **cannot be unequipped** except by a Chapel L2 rite or an event. [DECIDED] **The rite is expensive**: 10 Essence plus Gold equal to the item's full Masterwork price, and a Scion's Year (the wearer is assigned to the Chapel). Cursed items are always Fine-or-better in base stats and often worth the pain. Unidentified found gear has a 10% curse chance; Scriptorium L2 identifies before equipping.

### 13.6 Relics and cure items

- **Relics** score in the Relics category for whoever holds them at campaign end; most also do something (a sword that fears no undead; a mirror that reveals Loyalty; a crown that makes its House Regent once). They are drafted like any loot (§9.10) and tradeable in deals.
- **Cure items** (§11.2) are Relics with one use: Saint's Hand, Clockwork Leg, Seer's Eye, Lethe Water, Surgeon's Kit. Unused, they still score.

### 13.7 Consumables [DECIDED as a start; keep them varied and flavorful] (used from the satchel; 100 CT, 60 for Vagabonds; healing scaled by Herb Lore)

| Item | Effect | Source |
|---|---|---|
| Tonic / Strong Tonic / Vital Draught | HP 25% / 50% / 100% | Apothecary 1/2/3, Workshop |
| Bone Salve | Durability +30% to one location | Apothecary 1 |
| Whole Salve | Durability +20% to all locations | Apothecary 2 |
| Antidote / Clarity Draught | Cure physical / mental ailments | Apothecary 1 |
| Wine | Sanity +10%; Accuracy −5% for 100 ticks (Fond of Wine: no malus) | Farm, Market |
| Saint's Candle | Sanity +25% to a burst:3x3 | Chapel, Apothecary 2 |
| Smelling Salts | Revive at 10% HP | Apothecary 2 |
| Ether / Mana Crystal | MP +25% / +50% | Shrine, Curio |
| Oil of Haste | Haste 200 ticks | Apothecary 3 |
| Firebomb / Frost Flask / Shock Jar | Elemental burst:3x3 lob, 1.0× Acuity-scaled | Workshop |
| Caltrops / Net | Enemy cell: Slow / cannot Move on entry | Workshop |
| Scroll of <spell> | One cast of a Magus or Soothsayer spell at charge 0 | Scriptorium L2, Curio |
| Component Pouch | A Tinkerer picks 2 Components now | Workshop |
| Tarot Token | Draw a new Tarot for one Scion (once per Scion) | Curio, events |
| Passive Draught | Passive budget +1 for one expedition | Curio 3, events |
| Widow's Tea | Sanity +20%, then Sleep for 100 ticks (use at a Camp) | Apothecary 2, events |
| Grave Dust | Undead in a `burst:3x3` flee for 2 turns (bosses: Readiness −30) | Chapel, Barrows caches |
| Ember Oil / Brine / Stormwax | The weapon gains that element's edge for one battle | Workshop, Forge |
| Blackroot Chew | Durability +5% to all locations per turn for 3 turns; Sanity −5 | Hollow Wood caches, Fence |
| Pilgrim's Bread | At a Camp: the whole party to full HP; cannot be used in battle | Chapel, Farm |
| Hangman's Rope | An enemy cell: Rooted 3 turns, then the rope is lost | Fence, Apostate caches |
| Mirror Shard | Reflects the next spell aimed at the user, once | Curio, Faceless City caches |
| Saint's Tooth | Once: a Mortal wound result becomes Devastating (severed) instead; consumed | Chapel L3, Relic events |
| Lantern | The next node cannot Ambush the party; a Surprise instead if the node is an Encounter | Market, Workshop |
| Signal Flare | On a Rescue card: a Lost Scion joins the party at the next node | Workshop L2 |
| Mourning Veil | One Scion is Sanity-proof for one battle; Sanity −10% after | Chapel, Curio |
| Smuggler's Flask | A Scion at a Camp counts as Rested (full Durability for the next battle); Sanity −5 | Fence |
| Hollow Ivory Dust | Constructs and undead in a `cross`: Stun 1 turn | Forge L2, Forge Ruins caches |
| Dice of the Marches | Reroll one injury roll, before seeing the table; one use; whoever holds it when it is needed decides | Gambler events, Fence |
| Thief's Candle | Reveals every hazard on the enemy grid; a Lurker loses its free turn | Fence, Curio |
| Bottled Chorus | A Minstrel song plays for 2 turns without a Minstrel | Curio 2, Minstrel events |
| Oathwine | Every Scion of one House on the field +10% damage for a battle; Houses can gift it | Vineyard event, Market |

### 13.8 Ownership [DECIDED]

- [DECIDED] Gear belongs to a **House**, not a Scion. A House equips its own Scions, and **the host House outfits its Wards**. Gear a host puts on a Ward returns to the **host** if the Ward leaves (unequipped on departure), while gear the Ward arrived with stays with the Ward. **A cursed item goes with the Ward**: it cannot be unequipped, so the receiving House inherits it (and the rite's cost).
- The party satchel's unused consumables return to the Houses that contributed them.
- Loot ownership on expeditions: §9.10.

## 14. Enemies, bosses and expedition themes

[DECIDED, from the brief and batch 1] Enemy sprites come from the Pixel Material Studio 1000-Monster Mega Packs 1 and 2 (§17): sprites may be scaled, reshaded and recolored, and expedition themes are inspired by what sprites exist. Battle backgrounds and town art are built from Oryx Design Lab tiles in `oryx_megapack8` (16-bit Fantasy 1.1, Ultimate Fantasy 1.2, 32 Gothic; [DECIDED, batch 12] Josh confirms the packs are licensed for this use) or drawn by hand. Everything below was accepted in batch 11.

### 14.0 What the packs hold (survey of 2026-11-01) [DECIDED: exclusions and uses]

Both packs were listed file by file (about 2,000 sprites). Series, content and what the game uses them for:

| Series | Content | Use |
|---|---|---|
| **ST** (Standard) St-001…300 | Pack 1: 150 core fantasy monsters (Goblin → Satan). Pack 2: `st04` core fantasy II, 151–200 (Toy Soldier → Cursed King, the Divine Beast line); `st05` otherworld invasion, 201–250 (a Demon army, an "Unknown" army, the End Ruler); `st06` six divine beasts, 251–300 (townsfolk, Dark/Light/Earth/Water/Wind/Fire beasts and armors, Divine Beast Fusion) | The backbone of every pool and the whole mandatory arc |
| **FR** (Free) 001…220 | Monthly freebies: fantasy, horror, seasonal and retro joke sprites | Gap fillers; seasonal, food and retro ones excluded |
| **SP** (Special) 01…10 | Ten large one-off aberrations: Origin Slime, Void Egg, Devil Face, Watcher's Hand, Observer, Akuma Kura, Temporal Snail, Forest Eroder, Sealed Card, Willbound Star | Bosses, mostly Outer Dark and Hollow Wood |
| **CP A** yokai and urban legends (A01–210) | Japanese yokai, folk heroes, Meiji/Taisho figures, urban legends | Spirits and fey; bosses (Orochi, Nine-Tailed Fox, Gashadokuro, Umibozu, Tsuchigumo, Shuten-doji) |
| **CP B** animals and beasts (B01–180) | Real animals, prehistoric beasts, and B151–180 beast-folk soldiers (Dog Soldier → Mammoth Emperor) | Beast Lands fodder; the beast-folk warbands |
| **CP C** insects, plants, nature (C01–180) | Bugs, plants, fruit and food, elementals, season fairies, insect-folk | Hollow Wood; elementals; food and fruit excluded |
| **CP D** myth and machines / mythology (D01–240) | Appliances and vehicles (excluded), robots, then pantheons: Cthulhu Mythos (D76–90), Sumerian (D110–120), Greek (D131–150), Hindu, Persian and Mesopotamian (D151–180), Egyptian (D181–210), Chinese (D211–240), the Four Symbols (D57–60) | Outer Dark (the Mythos); the Idols (§14.9); a few constructs |
| **CP E** people, jobs, traps (E01–270) | Townsfolk, adventurers, royals, bandits, pirates, soldiers, mages, vampires, western and modern jobs (excluded), traps and cursed objects (E55–60, E85–90, E115–120, E144–150, E201–210) | Apostate Court; NPC portraits (§15); hazards (§14.8) |
| **CP F** horror and nightmares (F01–150) | Zombies, cannibals, cultists, faceless things, a haunted village, a haunted school (F091–120, modern, excluded), carnival horrors | The Faceless City; sanity attackers everywhere |
| **CP G** sci-fi entities (G01–60) | Xeno-fauna and robots | Excluded, except a handful reskinned as void things or Ooparts constructs |
| **CP H** "re:fantasy" (H01–90) | Classic monsters redrawn, ice beasts, hydras, kraken, hermit-crab fortresses | Alternates for ST sprites; Deep Cold; Drowned Marches |
| **CP I** monster focus (I01–60) | 30 slimes (every element and rank up to Queen, Omega, God, Giga) and 30 demons (elemental demons, the Overlord's three forms) | Slimes as cross-pool fodder; the Pit |
| **CP J** villains (J01–60) | Knight Commander, elemental knights and colossi, assassins, Demon Prince and Princess, Storm Commander, Elemental Fusion Dragon | Apostate Court elites and bosses; Hunts |

Everything modern (phones, cars, offices, schools, food, mascots, the western set, the sci-fi set) is **excluded**: it breaks the setting. Exceptions are named where used. Well over a thousand sprites remain, far more than the game needs; the implementer starts from the rosters in §14.5 and adds only when a pool feels thin.

### 14.1 Enemy data model [DECIDED]

Enemies are content, not code: one JSON file per enemy in `content/enemies/<pool>/<id>.json`, schema-validated in CI, loaded into the catalog at build time.

```json
{
  "id": "barrow_hollow_soldier",
  "name": "Hollow Soldier",
  "sprite": { "pack": 2, "series": "ST", "file": "St-160_Hollow_Soldier", "scale": 2, "tint": null, "flip": false },
  "pool": "barrows",
  "tags": ["undead", "armored", "humanoid"],
  "role": "bruiser",
  "size": [1, 1],
  "levels": [2, 6],
  "stats": { "hp": 1.6, "atk": 1.1, "def": 1.3, "acc": 1.0, "eva": 0.6, "speed": 9, "sanityTouch": 0 },
  "affinity": { "holy": -50, "dark": 25, "fire": -25 },
  "immune": ["sleep", "poison", "fear"],
  "weak": { "location": "head", "mult": 1.5 },
  "abilities": [
    { "id": "rusted_cleave", "shape": "single", "side": "player", "power": 1.2, "element": null, "locationBias": "body", "cost": 100 },
    { "id": "grave_shout", "shape": "row", "side": "player", "power": 0, "sanity": 8, "cost": 100, "charge": 60, "telegraph": true, "cooldown": 3 }
  ],
  "gambits": [
    { "if": "enemy.marked", "do": "rusted_cleave", "target": "marked" },
    { "if": "turn % 3 == 0", "do": "grave_shout", "target": "densest_row" },
    { "do": "rusted_cleave", "target": "column_weighted" }
  ],
  "drops": { "materials": [["bone", 0.6], ["iron", 0.3]], "essence": 0.05, "gear": { "chance": 0.08, "tierMax": "fine" } },
  "bestiary": { "lore": "What is left when a man-at-arms is told to hold the line forever.", "weakness": "Holy and fire. Falls apart when no other undead shares its row." }
}
```

- **No hit locations for enemies.** An enemy has one HP pool, no Durability and no injury rolls; the location system (§7.4, §11) is for Scions. A Scion ability's location bias still matters against monsters through **weak points**: an optional `weak` entry names a location and a multiplier, and abilities biased to that location (or Guile-aimed shots, §12) deal that much more.
- `stats` are **multipliers** on the level's base block (§14.2), except `speed`, which is absolute. `sanityTouch` is Sanity damage every one of its hits adds (horrors carry 2–6).
- `size` is columns × rows on the enemy grid (§10.1). A multi-cell enemy's melee reaches every row it covers; a shape that covers several of its cells hits it once per ability, not once per cell, unless the ability says `perCell`.
- **Parts** (bosses and colossi): an optional list of sub-entities (`{"id": "left_claw", "cells": [[2,3],[2,4]], "hp": 0.25, "disables": "sweep"}`), each with its own HP as a fraction of the owner's, sitting on some of its cells and targetable on its own. Destroying a Part removes the ability it powers for the rest of the fight and staggers the owner (Readiness −50). Parts regrow only if a later phase says so.
- **Gambits** reuse the Sortie format (§6.11, §10.11): an ordered list of `if` / `do` / `target` rules; the first that applies fires. Targets: `marked`, `nearest`, `lowest_hp`, `lowest_sanity`, `densest_row`, `densest_cluster`, `column_weighted` (the 45/35/20 rule, §10.3), `charging` (interrupt), `back_random`, `empty_cell` (leapers), `self`.
- **Bestiary:** after the first encounter the enemy's entry (sprite, lore, tags) opens in the Scriptorium for every House; after 3 kills, or a Hermit or Rift Observatory reveal, its weakness and pattern show. A party with an Insight-3 Scion sees patterns in battle.

### 14.2 Stat scaling [DECIDED as a first pass; tune]

Expedition level L (1–10) maps to a **reference Scion level** R = 3L: a level-10 expedition expects Scions around level 30. The base block at level L, before role multipliers:

| L | HP | Power (the "weapon" term of §7.3) | Accuracy | Evasion | Defense | Speed |
|---|---|---|---|---|---|---|
| 1 | 50 | 9 | 70 | 10 | 1 | 9 |
| 3 | 100 | 16 | 80 | 14 | 4 | 10 |
| 5 | 150 | 23 | 90 | 18 | 7 | 10 |
| 7 | 210 | 31 | 100 | 22 | 11 | 11 |
| 10 | 300 | 43 | 115 | 28 | 18 | 12 |

Formulas (interpolate between rows): HP = 30 + 22L + 0.5L²; Power = 6 + 3L + 0.1L²; Accuracy = 65 + 5L; Evasion = 8 + 2L; Defense = L + 0.08L²; Speed = 9 + L/3. Enemy damage = Power × its `atk` × (1 + 2L/25), through the same pipeline as Scions (§10.6). Role multipliers:

| Role | HP | atk | def | eva | Typical Speed | In a group |
|---|---|---|---|---|---|---|
| fodder | 0.7 | 0.8 | 0.8 | 1.0 | 9–10 | many |
| swarm | 0.35 | 0.6 | 0.5 | 1.3 | 12 | 3–10, one per cell |
| bruiser | 1.6 | 1.2 | 1.3 | 0.6 | 8–9 | 1–2 |
| caster | 0.8 | 1.3 | 0.7 | 1.0 | 10 | 1–2 |
| support | 0.9 | 0.6 | 1.0 | 1.0 | 11 | 1 |
| lurker | 0.8 | 1.3 | 0.7 | 1.5 | 13 | 1–3 |
| artillery | 1.0 | 1.1 | 0.9 | 0.8 | 8 | 1–2 |
| horror | 1.0 | 0.8 | 1.0 | 1.1 | 10 | 1 |
| elite | 2.5 | 1.4 | 1.4 | 1.0 | 11–12 | 0–1; never at L1 |
| colossus | 5–8 | 1.5 | 1.5 | 0.3 | 7–8 | alone or with swarm |
| boss | 12–20, plus phases | 1.6 | 1.5 | 0.8 | 14–18 (§10.10) | 1 |

First-pass numbers. The balance target: a well-built party at level 3L wins a normal encounter at level L in 6–10 player turns and loses 10–20% of its HP; an elite encounter takes 10–15 turns with a real chance of one injury roll. Tune the multipliers, not the formulas.

### 14.3 Roles and the back-line rule [DECIDED]

Roles are what the group templates (§14.4) count. Each has a job in the fiction and a job against the formation:

- **fodder** attacks the Front and dies in 2–3 hits; it teaches the clock.
- **swarm**: cheap singles that fill cells (rats, bats, hornets, paper spirits); AoE food. Five or more living swarm entities trigger their *overrun*, a `band:3` nibble, every other turn.
- **bruiser**: heavy singles with a location bias; goes for the Marked Scion or the lowest-Durability location it can reach.
- **caster**: charged AoEs (`burst`, `row`, `band`) on the densest cluster; interruptible; a smart party's first target.
- **support**: heals, buffs, shields, raises fodder; stands in E3.
- **lurker** [back-line threat]: leapers and assassins. Jumps onto an empty player cell next to the Back (`empty_cell`) and melees the Back from inside the formation; can be surrounded there; low HP, high Evasion. An Ambush gives every lurker a free first turn.
- **artillery** [back-line threat]: `lob`, `column:B`, `band` and `checker` attacks from E3; slow and telegraphed; hurts.
- **horror** [back-line threat]: fear, Sanity and Charm; seeks `lowest_sanity` (usually a caster at the Back). The reason Sanity matters in combat.
- **reach** and **flyer** are tags, not roles: `reach` melee covers two columns; a `flyer` ignores the front-most rule (§10.3) and is only hit by melee from Front.
- **elite**: a named-feeling mid-boss with two abilities, an interrupt gambit and immunity to one status; drops one tier better.
- **colossus**: 2×2 to 3×8, slow and huge; attacks with bands and columns; often has Parts.
- **boss**: scripted (§10.10, §14.6).

[DECIDED] At least a third of every pool's roster is a back-line threat (lurker, artillery, horror, reach or flyer), and the group templates put at least one into most fights.

### 14.4 Group templates [DECIDED as a start]

An Encounter node draws a template for the card's level and party size, fills each role from the pool's roster (entries whose `levels` span L), then places the group: fodder and bruisers on E1, lurkers E1–E2, casters, supports and artillery on E3, colossi centered. All seeded.

| Template | 4-party | 8-party | Weight | Note |
|---|---|---|---|---|
| Patrol | 3 fodder | 5 fodder, 1 bruiser | 20 | L1–4 only |
| Warband | 2 fodder, 1 bruiser, 1 lurker | 4 fodder, 2 bruiser, 1 lurker, 1 support | 25 | the default fight |
| Battery | 2 fodder, 1 artillery | 3 fodder, 1 bruiser, 2 artillery | 15 | |
| Coven | 1 fodder, 1 caster, 1 horror | 2 fodder, 1 bruiser, 2 caster, 1 horror, 1 support | 15 | |
| Swarm | 4–6 swarm, 1 bruiser | 8–10 swarm, 1 bruiser, 1 support | 10 | the AoE check |
| Stalkers | 2 lurker, 1 horror | 3 lurker, 1 horror, 2 fodder | 5 | L3+; Ambush odds doubled |
| Behemoth | 1 colossus, 2 swarm | 1 colossus, 1 elite, 4 swarm | 5 | L3+ |
| Elite patrol | 1 elite, 2 fodder, 1 artillery | 1 elite, 1 bruiser, 3 fodder, 1 artillery, 1 lurker | 5 | L2+; better drops |

Counts stay within §9.8 (2–6 for a 4-party, 4–10 for an 8-party; a swarm entity counts as half). Modifiers: **Ambush** (party at CT 0, enemies at 50, lurkers act first), **Surprise** (the reverse), **Reinforcements** (a second wave at E3 when the first falls below half; Mandatory and Hunt cards only), **Alarm** (a hazard calls a wave when triggered, §14.8). A Hunt card replaces one Encounter with the quarry's **Lair**: the quarry plus its kin (§14.9).

### 14.5 Enemy pools: the regions of the otherworld [DECIDED]

The city was torn into a place with its own geography. Each **pool** is a region and a theme; an expedition card names its pool, and the Rift Observatory previews it. Sprites below are cited by series and number as the packs name them so the implementer can find them; the game renames freely. The level range is where the pool appears; the card types are the ones that draw it; the elements are the pool's leanings (resists first, weakness after the semicolon). Bosses marked § are scripted in §14.6.

1. **The Beast Lands** (L1–6; Resource, Hunt). The near wilds: warrens, hunting grounds, warbands. Elements: none; weak Fire.
   Fodder: Goblin (St-002, H02), Kobold (St-005), Giant Rat (St-016, H31), Wild Boar (B08), Stray Dog (B03), Bugbear (St-169). Swarm: Bat (St-017), Killer Bee (St-014). Bruiser: Orc (St-026, H22), Ogre (St-188), Troll (St-186, H42), Minotaur (St-041), Killer Ape (St-038), Great Boar (FR213). Caster: Evil Shaman (St-177), Crow Shaman (B159). Support: Fox White Mage (B161), a goblin shaman (St-002 recolor). Lurker: Werewolf (St-078, FR91), Wolfman (H40), Weasel and Ermine Ninja (B163–164), Redcap (St-055). Artillery: Rhino (St-033, a `line` charge), Beehive (C07, spawns Killer Bees with `lob`). Horror: Nightmare (St-088). Elite: Goblin Lord (FR28), Orc King (FR30), Ogre Chief (FR92), Tiger Swordsman (B170), Bear Berserker (B178), Lion Hero (B177). Colossus: Behemoth (H56, 3×3), Mammoth (B120, 2×2), Tyrannosaur (B150, 2×3). Bosses: **The Goblin Lord** §, **The Mammoth Emperor** (B179), **Fenrir** (St-099), **The Chimera** (St-043), **The Manticore** (St-190), **The Giant Bat Emperor** (B180).
   The beast-folk (B151–180) are the Beast Lands' people: Dog Soldier warbands, a Wolf Martial Artist, a Horse Paladin, a Rabbit Prince. Some are event NPCs (a truce, a trade, a mercenary offer) before they are enemies.

2. **The Hollow Wood** (L1–7; Resource, Delve). A forest that digests. Elements: Earth, Water; weak Fire.
   Fodder: Mushroom Monster (St-007), Mandrake (St-156, FR17), Sprout Sprite (C70), Mushroom Baby (C71). Swarm: Moth (St-031), Dragonfly (St-015), Insect Swarm (C57), Paper Swarm (A177). Bruiser: Treant (St-023, H13), Centipede Warrior (C79), Stag Knight (C80), Vine Golem (C82), Giant Weta (C60). Caster: Dryad (St-064), Poison Flower Fairy (C77), Nymph (St-173). Support: Mushroom General (C85, spores heal fungi). Lurker: Spider (St-030, H10), Orchid Mantis (C74), Mantis-folk (C150), Kamaitachi (A160). Artillery: Man-Eater Plant (St-022, reach), Pitcher Plant (St-073), Reaper Flower (St-216, `column:B` pollen), Propeller Seed (St-286, `lob`), Bomber Cactus (St-287, `burst:3x3`). Horror: Devil Flower (St-024), Rafflesia (C56, a Sanity stench `band:3`). Elite: Devil Tree (St-036), Devil Pine (St-037), Termite Queen (C73), Giant Hornet (C78), Emperor Cicada (C87). Colossus: Ancient Tree King (C86, 3×4), Sunflower Giant (C84, 2×3), Tsuchigumo (A180, 3×3). Bosses: **The Ancient Tree King** §, **Tsuchigumo**, **The Forest Eroder** (SP08), **The Mushroom General's Court**.

3. **The Drowned Marches** (L2–7; Resource, Rescue, Delve). Flooded lowlands and the black lake. Elements: Water; weak Lightning, Wind.
   Fodder: Sahagin (St-039, H08), Frog (FR18), Tadpole (FR11), Piranha (St-018, as swarm). Bruiser: Water Lizard (St-280), Crocodile (B86), Frog Rikishi (St-223), Hippo (St-074), Earth Frog (St-275). Caster: Siren (St-004, H07; song = Charm `row`), Undine (St-060), Mermaid (St-084). Support: Jelly King (St-281, a slow `band` heal to water-kin). Lurker: Kelpie (St-166, drags a Back Scion to Front), Moray Eel (B142), Sea Scorpion (B146). Artillery: Manta Ray (St-071, `column` sweep), Sea Horse (St-282, `lob`). Horror: Clione (B140, Sanity), drowned villagers (St-251 Citizen, Hollow variant). Reach: Octopus (B24), Giant Squid (B29, 2×2, tentacles across two columns). Elite: Melusine (FR146), Bunyip (FR143), Aqua Cancer (St-283), Shark (St-032, H18). Colossus: Kraken (St-090, H83, 3×4), Abyss Kragen (H84, 3×8), Hydra (FR20, H79–81, 2×3 with head Parts). Bosses: **Scylla** §, **The Kraken**, **The Poison Hydra** (H80, heads as Parts), **Umibozu** (A90), **The Water Divine Beast** (St-285).

4. **The Barrows** (L2–8; Delve, Rescue, Pilgrimage-Dark). Necropolis hills: the old kingdom's dead. Elements: Dark; weak Holy, Fire.
   Fodder: Skeleton (St-010, H17), Zombie (St-011, F05, FR76), Hollow Soldier (St-160), Dead Soldier (St-175), Mini-Mummy (St-059). Swarm: Skull Bird (St-259), Soul (St-205), Parts Soul (St-262), Lingering Thought (St-261). Bruiser: Ghoul (St-087), Corpse Hound (St-159), Shadow Armor (St-263), Headless Armor (F142), Gravekeeper (St-167). Caster: Dark Wizard (St-029), Lich (H58), Dark Necromancer (J33, raises fodder from the dead). Support: Grave Robber (St-161, steals from the Satchel), Curse Priest (St-224). Lurker: Ghost (St-012, flyer, passes the Front), Banshee (St-083, `column:B` wail), Dullahan (St-178, the thrown head is a `lob`). Artillery: Cursed Archer (St-176, `lob`), Grudge Coffin (St-258, `band:3` slam). Horror: Hanged Shadow (F077), Bell Tower Ghost (F075), Weeping Madonna (FR129). Elite: Vampire (St-066), Carmilla (FR29), Dark Crow (St-153), Royal Tomb Guardian (St-194), Fallen Kingdom Knight (St-189). Colossus: Dragon Zombie (St-045, H29, 3×3), Gashadokuro (A119, 3×8). Bosses: **The Vampire Queen** §, **The Lich**, **The Royal Tomb Guardian**, **Gashadokuro**, **King Mummy** (FR95), and **The Cursed King** § (Year 10).

5. **The Deep Cold** (L3–8; Hunt, Resource). Peaks and ice caves beyond the Marches. Elements: Water and ice; weak Fire.
   Fodder: Frost Slime (I05), Ice Shell (St-279), Snowman (D39, darkened). Bruiser: Yeti (H43), Polar Bear (B56), Glacial Beast (H63, 2×2), Ice Armor (St-284). Caster: Yuki-onna (A18, `band` freeze), Ice Demon (I39), Winter Fairy (C145). Lurker: Ice Lizard (H61), Wendigo (H45, FR186; seeks `lowest_sanity`, then `lowest_hp`). Artillery: Ice Lizard spit (`lob`), the Avalanche hazard (§14.8). Horror: Wendigo, the wind-walkers of Ithaqua (D86 kin). Elite: Black Knight (FR145, as the Ice Queen's knight), Armor Narwhal (H74). Colossus: Ice Dragon (H62, 3×3), Mammoth (B120). Bosses: **The Ice Dragon**, **The Ice Queen** (FR218), **Ithaqua** (D86), **The Glacial Beast**.

6. **The Pit** (L4–10; Delve, Hunt; adds for Year 5). Where the demon army musters. Elements: Fire, Dark; weak Holy, Water.
   Fodder: Imp (St-019, H20, H49), Imp Child (St-021), Lower Demon (I31), Demon Recruit (St-207), Fire Slime (I04). Swarm: Bat (St-203), Demon Chips (FR125). Bruiser: Demon Soldier (St-209), Demon Veteran (St-208), Horned Demon (I32), Giant Red Demon (I37), Hellhound (St-053), Flame Gator (St-295), Melt Boar (St-294), Fat Evil (St-215). Caster: Dark Mage (St-211), Old Demon Mage (St-228), Flame Demon (I38), the elemental demons (I39–42, one per element). Support: Demon Hood (St-212), Curse Priest (St-224). Lurker: Winged Demon (I33, flyer), Succubus (St-035, Charm), Incubus (St-171), Death Clown (St-213). Artillery: Demon Gunner (St-217, `lob` and `column`), Trident Demon (I34, `line`), Walking Brazier (St-293, fire ground on a `band`), Hellfire Brazier (FR126). Horror: Horror Demon (I44), Eye-Hand Demon (I43), Zombie Demon (St-210). Elite: Elite Demon (St-220), Armored Cursed Demon (I45), Flame Beastman (St-297), Fist King (St-219), Demon Princess (St-226, J55), Demon Prince (J54). Colossus: Great Demon (St-049, 2×3), Dark Beast (St-222, 2×2), Dark Dragon (St-227, 3×3). Bosses: **The Dark General** §, **The Demon Queen** (St-233), **Ifrit** (St-094), **The Overlord** § (I58–60, three forms), **Satan** (St-100) or **Mephistopheles** (FR149), **The Fire Divine Beast** (St-299).

7. **The Forge Ruins** (L3–9; Resource for recipes, Delve). The otherworld's dead workshops, where Tinkerers learn. Elements: Earth, Lightning; weak Water (rust), Wind.
   Fodder: Toy Soldier (St-151), Puppet (H46, FR187), Living Stone (St-273), Gremlin (St-054, steals TP). Swarm: Clockwork Bat (FR122). Bruiser: Gargoyle (St-020, H21, flyer), Rock Golem (St-081), Clay Armor (St-277), Holy Armor (St-270), Auto Armor (D56). Caster: Arcane Core (St-181, `checker` lightning), Arcane Soldieress (St-182). Support: a repair construct (G41 reskinned; mends constructs). Lurker: Mad Hand (St-157, FR27, crawls into the formation), Gem Thief (St-191, steals an item and flees). Artillery: Arcane Cannon (St-174, `column:B`), Siege Machine (J23, `band:4`), Bomb (H36, FR183; walks to Front and bursts `3x3`). Horror: Warped Clock (FR32, Readiness damage to `all`), Ooparts (St-276). Elite: Guardian Head (D63), Machine Golem (St-183), Metal Hydra (H81). Colossus: Stone Colossus (St-192, 3×4), Gear Giant (D49, 3×3), Death Machine (St-184, 3×3), Guardian (G56, 2×3). Bosses: **The Stone Colossus** §, **The Gear Giant**, **The Death Machine**, **The Temporal Snail** (SP07), **The Earth Divine Beast** (St-278).

8. **The Faceless City** (L3–9; Delve, Rescue). The capital's own lost districts: streets that are almost home. Elements: Dark; Sanity damage everywhere.
   Fodder: Faceless Farmer, Woman and Young Man (F061–064), Fanatical Villager (F074), Cult Follower (F03, FR110), turned Citizens (St-251). Swarm: Face Swarm (F059). Bruiser: Sack-Head Butcher (F121), Axe-Mad Farmer (F083), Iron Stake Executioner (F147), Executioner (F18), Meat Golem (F30). Caster: Masked Priest (F073), Cult Priest (F04), Possessed Priest (F23), Straw Doll Shaman (F078). Support: Black Nun (F085), Plague Doctor (F084; poison clouds, heals cultists). Lurker: Limbstalker (F34), Backbend Crawler (F57), Spider-Leg Woman (F140), Crawling Mannequin (F130), Hair-Walking Woman (F139), the Handwalker (F126). Artillery: Multi-Armed Nun (F148, `checker`), Door Bearer (F144; opens a door and summons), Chained Escapee (F128, chain `line`). Horror: Faceless Man (F47), Shadow Man (F46), Mirror Woman (F33), Upside-Down Woman (F32), Split Smile (F48), Grudge Woman (F106), Cursed Bride (F081), Well Woman (F076), Crying Plush (F41), Cursed Doll (St-158, F20), Memento Mori (F067). Elite: Inquisitor (F069), Sister of Ruin (F070), Reaper of Ruin (F066), Antlered Hunter (F135), Masked Surgeon (F131). Colossus: Wheeled Flesh Mass (F149, 2×3), Flesh Mass (F065, 2×2), Faceless Hallway Giant (F150, 3×8). Bosses: **The Village Evil God** §, **The Goat-Head God** (F079), **The Sleeper** (F068), **The Underground Altar** (F089, cultists as Parts), **The Hallway Giant** (F150).

9. **The Apostate Court** (L2–9; Rescue, Hunt; adds for Year 10). The kingdom's own: nobles and soldiers who took the otherworld's bargain, bandits, sellswords and the old King's court. Elements: mixed. The only pool with human tactics: formations, flanking, a captain who retreats to E3.
   Fodder: Bandit Thug (E121), Bandit (St-252), Enemy Soldier (J26), Trooper (E127), Pirate Lackey (E124), Fanatic (St-170). Bruiser: Dark Knight (E73–74), Heavy Brute (J03), Axe Executioner (J11), Power Fighter (St-254), Fallen Kingdom Knight (St-189), Red Dread Guard (J28). Caster: Magician and Warlock (E131–132), Noble Sorcerer (J07), Elemental Sorcerer (J17), Fallen Noble Mage (J49), Jade Witch (St-231), Dark Necromancer (J33). Support: Corrupt Cleric (E79), Corrupt Priest (J50), Calamity Priest (St-195), Political Merchant (St-256; bribes: a Scion skips a turn). Lurker: Thief (E17, E47), Dagger Witch (J09), Claw Assassin (J13), Kunoichi (J39), Medusa Assassin (J10, Petrify), Head Hunter (St-225). Artillery: Cursed Archer (St-176), Crossbowman (FR23 Sniper reskinned), Whip Commander (J05, reach), Blue Elite Soldier (J27). Horror: Evil Queen (E69, Charm), Corrupted Princess (St-234), Temptress Witch (FR128). Elite: Knight Commander (J01), Crimson Demon Knight (J02), Fanatic Knight (J15), Judgement Soldier (St-193), Guard Captain (St-229), Lieutenant, Commander and General (E128–130), Vampire (E134), Bandit Boss (E123), Pirate Captain (E126), Crime Don (St-257). Colossus: Water Colossus (J35), Flame Armor Colossus (J36), Gun-Tank Fortress (J45, as a ballista wagon). Bosses: **The Knight Commander**, **The Evil King and Queen** (E68–69, a pair), **The Golden Archmage** (J24), **The Storm Commander** (J59), **The Fallen Hero** (E78; an event boss: someone's Scion, once), **The Wise King** (St-230; can be bargained with), and **The Cursed King** § (Year 10).

10. **The Shrine of Six** (L4–10; Pilgrimage, Hunt). Six temples to the elements, each kept by a Divine Beast and the elementals it commands. Elements: one per shrine.
    Fodder: Element (St-051, recolored per shrine), elemental slimes (I04–07), elementals (C173–176, FR61–70). Bruiser: Earth Serpent (St-272), Earth Slug (St-274), Flame Beastman (St-297), Duck Fighter (St-296). Caster: Undine, Salamander, Sylph and Gnome (St-060–063), the elemental men (C125–129). Support: Ergo Angel (St-268), Fairy (D38), Charm Nymph (H68). Lurker: Sylph (flyer), Double Eagle (St-289), Raiju (A178, a lightning leaper). Artillery: Thunderbird (H71), Thunderclap Beast (H72, `checker`), Balloon (St-288, `burst`), Giant Insect (St-290). Horror: the shades of the Dark Divine Beast (St-264 recolors), Fallen Angel (H54). Elite: the Armors (Holy St-270, Clay St-277, Ice St-284, Wind St-291, Flare St-298), Thunderbird, Qilin (D231). Colossus and bosses: **the six Divine Beasts** (Dark St-264, Light St-271, Earth St-278, Water St-285, Wind St-292, Fire St-299; 3×3, one per shrine), **the Four Symbols** (Seiryu D57, Suzaku D58, Genbu D59, Byakko D60; Hunts), **Divine Beast Fusion** § (St-300), **Yinglong** (D232), **Zhulong** (D233). A shrine Pilgrimage ends with a choice: fight the Beast for its Relic, or kneel for its blessing (§9.7).

11. **The Dragon Reaches** (L5–10; Hunt). The high crags; a Hunt card's quarry here is a named dragon. Elements: by dragon.
    Fodder: Mini Dragon (H41, D15), Drake (St-168), Lizardman A and B (St-006, St-027, H04–05), Kobold (St-005). Swarm: Dragon Slime (I22). Bruiser: Drake, Dragon Warrior (FR217), Dragon Spear Soldier (FR196), Wyvern (FR214, flyer). Caster: Dark Elf (St-098, H37, FR184; a dragon cultist). Lurker: Wyvern, Cockatrice (St-079, H48, FR188; Petrify `lob`), Basilisk (St-080, St-204; gaze `row`). Artillery: dragon breath (`band:3` or `column`), Catoblepas (H55, FR189; death gaze `line`). Elite: Dragon Warrior, Cyclops (St-093, H53). Colossus and bosses: **Dragon** (St-044, H28, 3×3), **Dark Dragon** (St-227), **Ice Dragon** (H62), **Dark Wyrm** (J29), **Yamata no Orochi** § (A149, 3×8, eight head Parts), **Tiamat** (D117), **Apep** (D205, 3×8), **Elemental Fusion Dragon** (J60), **God Dragon** (FR220, the level-10 Hunt), **Zahhak** and **Azi Dahaka** (D178–179).

12. **The Outer Dark** (L6–10; deep Delves; Years 15 and 20). The source of the rift: the **Unknown**, and the things that worship them. Elements: Dark, Void (resists everything but Holy); Sanity damage everywhere; **Charm and Sleep never work on the Unknown**.
    Fodder: Unknown Army (St-235), Unknown Seed (St-243), Void Slime (I12), Godblight Parasite (St-180), Mi-go (D76). Swarm: Unknown Colony (St-246), Unknown Pile (St-242, spawns Seeds), Tentacle (FR39), Tentacle Nest (F15, a spawner). Bruiser: Unknown Fighter (St-237), Unknown Grappler (St-239, pulls a Scion onto E1), Unknown Beast (St-244). Caster: Unknown Mage (St-236), Unknown Valkyrie (St-241), Lloigor (D80). Support: Unknown Core (St-248, shields the Unknown; kill it first). Lurker: Unknown Agent (St-240), Watcher's Hand (SP04), Nightmare (St-088). Artillery: Unknown Titan (St-238, `band:4`), the Meteoros (G29, allowed as a falling void-stone, `burst:5x5`), Sphere-Neck Titan (G25, allowed as a void thing). Horror: Observer (SP05, `all` Sanity), Devil Face (SP03), Eldritch Eye (F17), Void Egg (SP02, hatches when hit), Shoggoth (D83, 2×2), Amorphous Horror (J06), Sludge Horror (J22). Elite: Unknown Satan (St-245), Unknown Princess (St-247), Void Demon (J30), Eldritch Demon (H60, FR190). Colossus: Shoggoth (3×3), Unknown Mother (St-249, 3×8), Void Rift Varga (G30, 3×4), Origin Slime (SP01, 3×8). Bosses: **The Unknown Mother** § (Year 15), **The End Ruler** § (St-250, Year 20), **The Observer**, **Nyarlathotep** (D89, the one that talks), **The Shoggoth**, **The Willbound Star** (SP10), **Akuma Kura** (SP06), **The Sealed Card** (SP09, a boss that is an item). **Azathoth** (D88) and **Yog-Sothoth** (D84) are never fought: they are a Year-20 phase backdrop, not monsters.

**Cross-pool:** slimes (I01–30) and Mimics (St-008, H15, E117–118) appear in every pool, recolored to its element; a Mimic is a Cache-node trap (§14.8). **The Wood Court:** yokai and fey (Tengu A17 and A157, Kappa A03, Nue A26, Rokurokubi A19, Nurarihyon A110, Nine-Tailed Fox A150, Shuten-doji A27, the Oni A125–127 and St-048, Cait Sith St-162, Fairy Goblin St-267) form a wandering sub-pool any card can draw at 10%: tricksters with Charm, theft and illusion, more often events than fights, and the Nine-Tailed Fox and Shuten-doji as Hunts.

### 14.6 Bosses [DECIDED]

A boss is an enemy JSON plus `phases`, each with its own ability set, gambit list, adds and a trigger (`hp<=0.6`, `part_destroyed`, `turn>=8`, `ally_dead`). Bosses follow §10.10: Speed 14–18, immune to Stop, Charm, Sleep and instant death, Readiness damage halved, two to three phases, a telegraph every third turn, a readable pattern and a weakness; [DECIDED] **their adds are not immune**. The boss node deploys the party from its saved formation at CT 30: never ambushed, never surprising.

```json
{ "at": "hp<=0.6", "name": "The Crown Cracks", "speed": 16,
  "abilities": ["sweep", "crown_fire", "summon_hollow"],
  "gambits": [ { "if": "turn%3==0", "do": "crown_fire", "target": "densest_cluster", "telegraph": 2 },
               { "if": "adds<2", "do": "summon_hollow" },
               { "do": "sweep", "target": "band_most" } ],
  "adds": { "spawn": ["barrow_hollow_soldier"], "count": 2, "at": "E3" },
  "say": "The crown does not come off. It never came off." }
```

Scripted bosses of the first pass:

| Boss | L | Pool | Size | Pattern | Weakness | Note |
|---|---|---|---|---|---|---|
| **The Goblin Lord** (FR28) | 1–2 | Beast Lands | 1×1 with 4 goblins | Hides behind fodder; flees at 30% unless Rooted; every third turn Pile On (`front_each_row`) | Fire; with 3 goblins dead he charges the Front | The tutorial boss: teaches adds |
| **The Ancient Tree King** (C86) | 2–3 | Hollow Wood | 3×4, Parts: two limbs | Roots (`column:F` Rooted), Canopy Fall (`band:3`, telegraph 2), spawns Sprouts; limbs regrow in phase 3 | Fire ×2; a destroyed limb halves its damage | The first Parts boss |
| **The Siege Beast** (St-244 at 3×4) | 3 | Pit / Outer Dark | 3×4 with Demon Recruit waves | §14.7, Year 5 | Holy; Head ×1.5 | |
| **Scylla** (St-185) | 4 | Drowned Marches | 2×3 with 2 Kelpies | Tentacles reach two columns; Tidal Pull drags Back to Front; phase 2 submerges (untargetable 2 turns) and strikes `column`s | Lightning; the Kelpies feed her shield | |
| **The Vampire Queen** (E135) | 4–5 | Barrows | 1×1 with 2 Brides (FR29) | Charms the highest-Might Scion; drains to heal; mist form while a Bride lives | Holy, fire; kill the Brides and she cannot mist | A Charmed Scion hits allies: a Loyalty beat |
| **The Stone Colossus** (St-192) | 5 | Forge Ruins | 3×4, Parts: two fists, a core | Fists slam alternate `band:4`s; the core charges Earthquake (`all`, telegraph 3) while both fists live | Water (rust); a destroyed fist drops it to one knee and exposes the Head | The interrupt boss |
| **The Cursed King** (St-198 → St-199) | 6 | Barrows / Apostate Court | 1×1, then 3×3 | §14.7, Year 10 | Holy; the crown Part | |
| **The Village Evil God** (F090) | 6–7 | Faceless City | 3×3 with 4 Villagers | Each living villager adds +1 Sanity to its hits; Eyes Open (`all` Sanity 10, telegraph 2); phase 3 turns a Charmed villager into a Flesh Mass | Holy; Sanity-proof Scions (Hermit, Grit-Marked) | The Sanity boss |
| **The Dark General** (St-232) | 7 | The Pit | 1×1 with an Elite Demon and a Gunner | A formation boss: the Gunner lobs, the Elite guards; the General Marks the Leader and duels; phase 2 Infernal Order (adds act twice) | Water; Charm the Elite to break the formation | Minion-dependent |
| **Yamata no Orochi** (A149) | 7–8 | Dragon Reaches | 3×8, eight head Parts | Each head breathes an element; when a head dies two others rage (+Speed); the body is targetable once 4 heads are down | Each head its opposite element; the body Holy | Hunt |
| **The Unknown Mother** (St-249) | 8 | Outer Dark | 3×8 with Seeds | §14.7, Year 15 | Fire on the Core; Holy | |
| **The Overlord** (I58 → I59 → I60) | 9–10 | The Pit | 1×1, 2×2, 3×3 | Three forms, one per phase; dispels every buff at each form change; form 3 Doom Pulse (`all`) every fourth turn | Holy; Readiness damage still half-works: delay the Pulse | The optional superboss |
| **Divine Beast Fusion** (St-300) | 10 | Shrine of Six | 3×3 | Cycles elements each phase; the matching shrine's Relic nullifies its current element | The opposite of its current element | Hunt |
| **The End Ruler** (St-250) | 10 | Outer Dark | 3×8 | §14.7, Year 20 | Holy; the pact | The final boss |

Hunt bosses and Idols (§14.9) use the same format with two phases and no mandatory trappings. Every boss has `say` lines (one per phase, one on death) and a bestiary paragraph.

### 14.7 The mandatory arc [DECIDED; names and fiction are Josh's to change]

The title is the pact the Houses must make with each other; the old King made a different one. [PROPOSED fiction, for Josh to keep or rename:] the capital was torn into the otherworld because its last King bargained with the thing beyond the rift, the Unknown, for a throne that would never fall. The Houses that survived the tearing are what is left of his court. Four times in twenty Years the otherworld comes for them.

| Year | L | Expedition | Boss | Stakes |
|---|---|---|---|---|
| 5 | 3 | **The Tide at the Walls.** The first warband of the Pit reaches the settlement with something of the Unknown driving it. Fought at the gate: the background is the Town Map's own wall. | **The Siege Beast** (Unknown Beast, 3×4) with Demon Recruits in two Reinforcement waves. Trample (`band:3`), Devour (eats a Recruit to heal 15%), Howl (`all` Sanity 6, telegraph 1). Weakness: Holy; Head ×1.5. | Fail: Devastation (§3.3). Win: the Bastion of the Gate (§8.4) unlocks for building; a Relic for the draft. |
| 10 | 6 | **The Hollow Court.** The old King still sits in the drowned palace in the Barrows. Take back the crown, or kneel. | **The Cursed King** (St-198, 1×1, a duelist with two Fallen Kingdom Knights) → **Second Form** (St-199, 3×3, the pact made flesh; the crown is a Part, weak to Holy). Form 1: Decree (Marks a Scion; every add targets them), Royal Parry (counters the next melee). Form 2: Crown Fire (`band:4` dark fire), Summon the Court (two Hollow Soldiers), and at 25% Abdication: he kneels and the fight ends; on the result screen the crown makes each House a Dark Bargain (§14.7a). | Fail: Devastation, and the Court's knights raid every Year after (+1 Encounter per expedition). Win: **the Crown**, a House-score artifact (+Lineage), draftable, and a Throne cosmetic for the Seat. |
| 15 | 8 | **The Nest.** The rift's near side, where the Unknown breed the Seeds that have crept into every pool since Year 10. | **The Unknown Mother** (St-249, 3×8) with the **Unknown Core** (St-248) as a Part that regrows once, and Seed and Colony swarms. Brood (3 Seeds at E1), Lullaby (`all` Sleep, telegraph 2; a Sanity check resists), Consume (eats Seeds, 10% heal each), Rupture (`checker:a` then `checker:b` on consecutive turns). Weakness: Fire ×1.5 on the Core; Holy. | Fail: Devastation and **Doom +40**; every pool gains Unknown fodder. Win: Doom −20; the Core yields one cure item of each kind (§11.2). |
| 20 | 10 | **The Sovereign Pact.** Through the rift to the source. The chain's last event, *The Gate's Reflection* (§9.7), precedes the boss. | **The End Ruler** (St-250, 3×8), three phases. *The Throne*: it sits and only Decrees while an Unknown Satan and Princess fight. *The Ruler*: it rises; `band`s, `column:B`, Readiness damage to `all`. *The Pact* (at 25%): the Aspects (D88, D84) loom as a backdrop and drop a `burst:5x5` every other turn, and the Dark Bargains struck at *The Gate's Reflection* (§14.7a) quietly resolve: a House that took one finds its Scions' boon or its rival's bane landing now, or nothing at all. Weakness: Holy; every Divine Beast or Idol Relic in the party removes one of its immunities. | Fail: the campaign is lost (§3.3). Win: the campaign is won; Ascendancy is scored; the Sovereign is named. |

**14.7a Dark Bargains [DECIDED, batch 11: out of combat; boons or banes; never guaranteed; shaped by House traits].** The otherworld makes offers. A **Dark Bargain** is a private event for one House, out of combat: at Omens (a whisper in the Seat, 1–2 per campaign per House), at the end of the Year 10 and Year 20 arcs (the crown; *The Gate's Reflection*), and from a few expedition events with a `house_private` rule (an Idol's second offer, the Sealed Card, a Mi-go's trade). Only the offered House sees it; others see nothing at all.

- **The offer** names a price (a Scion's Sanity, a Year of a Scion, Gold, a secret, a recruit, a Pact mark) and either a **boon** for the House (a Masterwork item, a Scion's stat +3, a hidden +Ascendancy, a Ward's Loyalty, a building level, a cure) or a **bane** on a rival House the bargainer names (a Scion falls ill for a Year, a building loses a level, a recruit leaves, a cursed item appears in their Stores, their next Crisis pledge is halved).
- **Never guaranteed.** Each bargain resolves on a hidden roll: about 60% as promised, 25% nothing happens, 15% it twists (the boon is smaller or the bane strikes the bargainer's own House). The victim of a bane sees only an ordinary misfortune, the kind the game already deals out on its own, so nobody can be sure a bargain was struck. The bargainer learns only what they can see.
- **House traits shape it.** Demon-Blooded, Cursed Line and Old Blood of Kings get better odds and darker offers; Pious and Ink-and-Seal Houses get fewer offers and lose Piety for accepting; Grudge-Holders' banes hit harder; a Watchtower L3 gives a 25% chance to learn that *some* House struck a bargain this Year, never which. Traits in §5.7 carry a `bargain` modifier for this.
- **The cost that lasts:** some offers carry a hidden **Pact mark** (−1 Standing tier at the final score, revealed only then). The game never tells a House how many marks it holds. [PROPOSED] The Year 20 bargain always carries one; Omens bargains carry one 50% of the time.
- **Bots** (a dropped seat) always refuse.

### 14.8 Hazards and traps [DECIDED: occasional and interesting, never common]

Hazards are entities without turns: they sit on an enemy or player cell and trigger on a condition. [DECIDED] They are **occasional**: at most one hazard in about one Encounter in five (more in Forge Ruins, Faceless City and Apostate Court, fewer in the wilds), a Mimic in about one Cache in six, and never two of the same kind in one expedition; when one appears it should matter. Sprites from the trap sets (E55–60, E85–90, E115–120, E144–150, E201–210; the 512×512 trap art illustrates Cache events).

| Hazard | Where | Trigger | Effect |
|---|---|---|---|
| Mimic (St-008, H15, E117–118) | Cache node | Opening the cache (a Guile check notices it) | Becomes an elite-tier enemy; Ambush |
| Bear Trap (E59), Snare Wire (E204) | A player cell, hidden | A Scion moves onto it | Rooted 2 turns; a Legs hit |
| Alarm Bell (E207) | Enemy E3 | A Scion attacks it, or 3 turns pass | A Reinforcements wave |
| Explosive Barrel (E202), Dynamite Crate (E201) | Enemy grid | Destroyed by any damage | `burst:3x3` fire; reaches the player Front if on E1 |
| Poison Gas Crate (E208), Poison Gas Machine (E147) | Enemy E2 | Every second turn while it lives | A poison cloud on the player `column:F` |
| Rockfall (E205), Avalanche | Player side, telegraphed | A 3-turn timer | `band:3` physical, Head bias |
| Rotating Saw (E206) | An enemy E1 lane | Any Scion at Front in that row | An Arms hit each turn |
| Iron Maiden (E58), Iron Cage (E203) | Events and Caches | A choice outcome | Imprisons a Scion (out of the fight until an ally spends an action) |
| Demon Wall (E146) | Boss arenas | A phase | Blocks `column:E3`; adds spawn behind it |
| Binding Chains (E210) | Player Back | A lurker's ability | Rooted and Silenced; a Might check breaks it |
| Hidden Trapdoor (E209) | Fork events | A choice | The party drops to a shorter, nastier chain |
| Cursed objects (E27–29, E56–57, E60, E85–86, E120, E148–150, A12) | Caches and events | Taken | Cursed gear (§13.5) or a Form event (§9.6) |

### 14.9 Hunts, Arcana and Idols [DECIDED]

- **Hunt quarries.** A Hunt card names one elite or boss of its pool with a title ("Old Scar, the Great Boar"; "the Pale Bride of the Marches") and a **trophy**: Valor, a cosmetic for the Seat, a rare material. A named quarry is +1 level, +50% HP, with one extra ability from a short list (Enrage, Flee and Ambush, Call the Pack). The bestiary tracks named kills per House.
- **Arcana nodes [DECIDED: mini-bosses inside an expedition].** The 22 Major Arcana (the Scions' Tarot, §6.8) each have a mini-boss. An Arcana appears as a special **node** in an expedition's chain (shown as a face-down card on the chain map), at most once per campaign per Arcana, far more likely when a Scion of that Tarot is in the party; that Scion is the subject of the node's event and gains a permanent trait on the kill. The fight is elite-tier (two phases, no adds beyond its own), fought in the pool's arena, and drops a Relic tied to the card. Three of them (The Tower, Death, The World) are big enough to carry a Hunt card of their own at level 8+. The mapping, from the packs:

| Arcana | Boss | Arcana | Boss |
|---|---|---|---|
| 0 The Fool | Death Clown (St-213) | XI Justice | Maat (D189) |
| I The Magician | Golden Archmage (J24) | XII The Hanged Man | Hanged Shadow (F077) |
| II The High Priestess | Isis (D192) | XIII Death | Thanatos (FR150) |
| III The Empress | Ishtar (D118) | XIV Temperance | Undine (St-060, at 2×2) |
| IV The Emperor | Gilgamesh (D120) | XV The Devil | Mephistopheles (FR149) |
| V The Hierophant | Calamity Priest (St-195) | XVI The Tower | Stone Colossus (St-192) |
| VI The Lovers | Incubus and Succubus (St-171, St-035) | XVII The Star | Willbound Star (SP10) |
| VII The Chariot | Siege Machine (J23) | XVIII The Moon | Smiling Moon (FR37) |
| VIII Strength | Hercules (D137) | XIX The Sun | Smiling Sun (FR36) |
| IX The Hermit | Floating Monk (F141) | XX Judgement | Judgement Soldier (St-193) |
| X Wheel of Fortune | Temporal Snail (SP07) | XXI The World | Gaia (D134) |

- **Idols.** The pantheon sprites (Greek, Sumerian, Egyptian, Hindu, Persian, Chinese) are **Idols**: the otherworld's old gods, met at the end of Pilgrimage cards. An Idol is an event first (an offer: a blessing for a price in Sanity, a Scion's Year, Gold or a secret) and a boss only if the Houses refuse or cheat it. Idol fights are level 6+, two phases; an Idol's Relic is a House-score Lore artifact. Idols never appear as random encounters. The Chapel's faith calls them false gods: a House that kneels to one loses Piety; a House that kills one gains Piety and Valor. This keeps the pantheon art in the game without making gods common.

### 14.10 Variants, sprites and scale [DECIDED]

- **Variants.** An enemy may declare `variants`: `{"prefix": "Ashen", "tint": "#c0392b", "affinity": {"fire": 50, "water": -50}, "tags": ["fire"]}`; the game composes name, tint and stats. Three standard families: **elemental** (Ashen, Drowned, Storm, Stone), **Hollow** (undead: Dark affinity, a Sanity touch, fodder and bruisers only) and **Unknown-touched** (Years 10+: +1 level, void resist, the Outer Dark's palette). Variants make 12 pools feel like 40 without new art.
- **Sprites.** The Capsule series ships `01_Original_Size` and `02_2x_Scaled`; use the originals and let the engine scale by integer factors to the cell size (§10.1, the `vp-play` container). A 1×1 enemy shows at 2×; 2×2 and larger ones at 3–4×, or use the packs' larger sprites. Never scale by a non-integer: it blurs the pixels. Tints multiply over the sprite; a flash to white on hit, red on a critical, one inverted frame on a Sanity attack (§15).
- **Facing.** The packs face left or right inconsistently; the pipeline flips enemies to face the party with a per-sprite `flip` flag in `content/sprites/manifest.json`, which also records each sprite's source file and license line for the credits screen (§17).
- **Animation.** The packs are single frames (a few have two). Enemies animate through the engine (idle bob, attack lunge, hit shake, death dissolve, §15), never hand-drawn frames.
- **Backgrounds.** One per pool (12), plus the gate wall, the drowned palace, the Nest and the rift's source for the mandatory fights: Oryx tiles arranged as a three-layer parallax strip (sky, far, ground) at 1920×600 design size, hand-assembled once each, with the Town Map's own tiles reused for the Year 5 wall.
- **People.** The townsfolk, royal and adventurer sprites (E01–50, E151–180, E211–240, A61–80, St-251–257) are not enemies: they illustrate settlement events, the Commons, the Chapel's priest, refugees and merchants (§15).

## 15. Presentation [DECIDED as a first pass, batch 12: build it and iterate on what it looks like]

[DECIDED, from the brief] Animate basically everything: a sword icon slashes for sword attacks, an axe for axes; a weak fire spell is one fireball, a strong one rains fire over an area. Lots of color within a dark tone: tints (red for fire), distortion, shimmer, outline color changes, brief color inversion. Scion sprites from the LPC Universal Spritesheet Character Generator, appearance customizable per Job within reason, non-human parts (wings, an orc head, a skeleton body) only when earned through events. Emblem overlays on Scions where possible. [DECIDED, batch 12] The drafts below are accepted to build and judge on screen ("let's see what it looks like"); the Town Map in particular (§15.6) is hard to picture and should be prototyped early.

### 15.1 Art direction [DECIDED, to iterate]

- **Pixel art throughout**, integer-scaled, no smoothing (`image-rendering: pixelated`). Three sprite scales live together: LPC Scions (64×64 frames), pack monsters (32–64 px originals at 2–4×), Oryx tiles (24 px for 16-bit Fantasy's world and creatures, 16 px for Ultimate Fantasy, 32 px for 32 Gothic). The battle cell at design size is 96×96 CSS px, scaled by the `vp-play` container (§4.1).
- **Palette:** a dark base (near-black blues and browns, desaturated stone) with saturated accents reserved for meaning: fire red-orange, water and ice blue-cyan, earth ochre, wind pale green, holy gold-white, dark violet, poison acid green, Sanity magenta, House colors wherever a House acts. Rule: *the darkest thing on screen is the background; the brightest is the current action.*
- **House colors** (primary, secondary, metal) set at creation (§5.4) drive: the ring under each Scion, cloth tints on LPC layers, the Seat's banners, UI chrome on that House's panels, and the damage-number color of its Scions' hits.
- **Fonts:** a pixel display font for headings, numbers and damage pops; a readable humanist sans (the Vibe Pulse site font) for body text, event prose and options. Body text is never pixel font: events are long.
- **Readability over spectacle:** every effect has a cap on duration (a non-boss ability finishes its animation in under 900 ms; telegraphs and ultimates up to 2 s) and the clock never advances during an animation that carries information.

### 15.2 Screens [DECIDED, to iterate]

| Screen | What it is | Key elements |
|---|---|---|
| Title | A slow pan over the rift from the walls | Continue (the campaign save, §4.1), New, Join, Options, Credits |
| House creation | §5, one page per step with a live preview of the Seat and a Scion in House colors | Flavor/Crunch toggle shown as a host table option |
| Town Map (Settlement) | §8: a tile map built from Oryx tiles, the Commons in the middle, Seats around it; buildings with three visible levels each | Scion assignment by dragging a Scion's chit onto a building or the Rift Gate; the timeline strip at the top; the vote and deal drawers at the side |
| Timeline | The 20-Year strip (§8.7) | Mandatory expeditions, queued consequences, "?" entries |
| Rift Gate | 2–3 expedition cards face up (§9.1) | Card art = the pool's background; the Observatory's preview; the vote |
| Chain map | The expedition's nodes as a path of unknown icons, revealed as walked | Forks, Gates, the Boss at the end |
| Event | A panel: illustration (the pool's background with the involved sprites), the prose, the resolution rule in a tag ("Leader decides: Lord Vane"), the options with tags, then the outcome | Dice are shown when a roll resolves; the subject Scion's portrait is highlighted |
| Battle | §10.12 | See 15.5 |
| Result | XP/JP, loot draft, score deltas, the Chronicle of the dead | The draft is a live table with each House's turn |
| Reckoning | End-of-Year summary per House, private: income, upkeep, Loyalty changes, Standing tiers of others | Public part: the settlement event's result, Accord, Doom |
| Bestiary, Chronicle, Codex | In the Scriptorium: enemies met; dead Scions; discovered Lore | |
| Credits | Every asset author (§17), scrollable, reachable from the title | |

### 15.3 Scion sprites: LPC compositing [DECIDED, to iterate]

- Scions are **composed at runtime** from LPC layers: body (skin), head, hair, eyes, facial hair, Job outfit, shoulders, arms, legs, feet, main-hand weapon, off-hand, headgear. The engine draws layers in the generator's z-order into one offscreen sheet per Scion (idle, walk, slash, thrust, cast, shoot, hurt, and the generator's others) and caches it until the loadout changes.
- **Job look:** each Job has an outfit layer set (a Vanguard's mail and tabard, a Magus's robe, a Vagabond's hood). Players customize body, hair, eyes and colors; the outfit is the Job's. **Equipment shows** where the generator has a matching layer (helms, weapons, shields); where it does not, the Job's default is drawn.
- **House tinting:** the outfit's cloth layer is recolored to the House's primary and secondary by palette swap on the LPC color ramps; metal keeps the House's metal choice. The **emblem** (§5.4) is drawn as a small overlay on the tabard or shield at 8×8 px where the layer has a flat area, and in full on the ring and the portrait frame.
- **Portraits:** an upscaled 3× crop of the head from the idle frame, in a frame of House colors with the emblem; injuries and Forms change the portrait (an eyepatch overlay, a prosthetic, the Form's own sprite).
- **Earned parts:** events and Forms (§9.6) unlock non-human layers (wings, an orc head, a skeleton body, a demon's horns) only for the Scion that earned them. [DECIDED: never as cosmetics.]
- **Runtime need:** the game ships the generator's layer PNGs it uses (not the generator itself), each layer's credits copied into the manifest (§17). [OPEN: the folder holds one exported male base; the full layer set must be exported from the generator with its `CREDITS.csv`, §18.]

### 15.4 Animation and effects language [DECIDED, to iterate]

Every action has a visible cause, a travel and a landing; what the player sees tells them the type, the strength and the result.

- **Weapon attacks:** the Scion's LPC attack animation plus an **icon strike**: a sword icon slashes across the target, an axe arcs, a mace drops, a spear thrusts along the line, an arrow flies the lob. The icon is the weapon's art from the item (so a Relic looks like itself). Dual wield plays two strikes; Multi-hit a third, smaller.
- **Spells scale with power:** the ability's `power` picks a tier of effect: a weak Fire spell is one fireball; a mid one is three; a strong one rains fire over the shape with ground-fire afterglow. Each element has a tiered family: fire (ball → burst → rain), water (splash → wave → deluge), earth (spike → fissure → quake), wind (gust → cutter → cyclone), holy (ray → pillar → judgement), dark (hand → pool → eclipse), lightning (spark → chain → storm), poison (drip → cloud → bloom). Buffs are rising rings in the buff's color, debuffs falling ones.
- **Tints and distortion:** on hit, the target flashes **white** (physical), then takes the element's **tint** for 200 ms (red fire, blue ice, violet dark, gold holy). Fire adds **heat shimmer** over the cell, water a **ripple**, dark a **smear**, holy a **bloom**. A critical hit adds **hit-stop** (80 ms freeze) and a bigger number; a Sanity attack **inverts** the target's colors for one frame and desaturates the party panel for a beat.
- **Outlines:** a Scion's outline color shows their most important state: House color at rest, gold while Charging, red when Marked, violet under a Dark debuff, grey when Down, pulsing dark-red in **Last Stand**. Enemies: white at rest, red when telegraphing, yellow when a Part is destroyed.
- **Telegraphs:** the shape's cells are hatched in red with a tick countdown on the first cell; the forecast bar shows the attack's icon at the tick it lands.
- **Movement:** sprites slide between cells (120 ms per cell) with a small dust puff; a leaper's jump arcs over the Front; a flyer hovers one pixel-row up with a bob.
- **Injury roll:** a full-screen moment. The d20 rolls on a dark cloth, the table's bands light as the die settles, the location's name is shown, then the result in the band's color: Devastating in red with a slow fade, Shrug with a small flourish. Each House sees it; only the Scion's House may press the Grit-Marked prompt.
- **Death:** the sprite dissolves upward in House-colored motes; the Chronicle line writes itself at the result screen.
- **Screen shake:** scaled by damage as a share of the target's HP; capped; off with the accessibility toggle.

### 15.5 Battle screen [DECIDED, to iterate]

- Two tilted planes (§10.1), the gap between them a strip of the pool's background; three-layer parallax behind (§14.10).
- Cells: a faint grid; House-colored rings under Scions; enemy cells show a size footprint for multi-cell enemies; ground effects as animated overlays (fire, ice, webs).
- **HUD (§10.12):** the turn forecast across the top (portraits in order, ticks until each); the party panel on the right (HP, MP, TP bars; four Durability pips that crack and go dark; Sanity as a thin magenta bar; status icons); the enemy panel on the left (HP bars, buffs, a Part's HP under its owner's); the active Scion's action menu beneath the grid.
- **Targeting preview:** hovering an ability shows its shape on the grid, the hit chance per cell, the damage range, and the location odds pie (Head/Body/Arms/Legs) for single targets; against a weak point, the bonus shows.
- **Damage numbers:** pop from the hit cell, colored by element (physical white, crit gold and larger, heal green, Sanity magenta), with a location tag ("Head!") on Scions, "Broken!" when a location breaks, "Weak!" on a weak point.
- **Gambits (Sorties and enemies):** a Sortie's auto-battle plays at 4× with the same effects, skippable; a summary stays in the log.

### 15.6 Town Map [DECIDED, to iterate]

- Built from Oryx tiles (16-bit Fantasy and Ultimate Fantasy for the town, 32 Gothic for the Chapel, Barrows-facing wall and the rift's edge). Top-down; Ultimate Fantasy's 16 px tiles at ×3 (or 16-bit Fantasy's 24 px at ×2) so a tile is 48 CSS px; the map is about 60×40 tiles and pans; the Commons in the center, the Rift Gate at one edge where the ground tears into the otherworld (animated: a slow purple shimmer).
- Each Seat (§5.5) is a cosmetic building set of 2–3 tile variants per Seat type, with the House's banners.
- Buildings show their level (3 sprites each) and, when something waits (a Crisis, a finished build, an auction), a small marker.
- Scions stand as LPC sprites near their assignment; dragging a chit to a building assigns them; a Scion in the Infirmary lies down; a Scion at the Chapel kneels.
- Year change: the otherworld has no sun. The bell tolls, the sky's color shifts along a 20-step gradient from the first Year's dusk to the last Year's red, and Doom adds cracks of light along the horizon.

### 15.7 Hidden information on screen [DECIDED, to iterate]

- Each House sees its own panels; the shared screen is the same for everyone. A private decision (a Crisis pledge, an auction bid, a Pact offer, House creation's Ambition) opens a modal only that House sees; others see "House Vane is deciding" with a timer.
- Standing tiers are shown as four-step banners under each House's name; never a number.
- Votes show hands as they are cast (public) and the Accord cost of a tie before it is broken.

### 15.8 Input and accessibility [DECIDED, to iterate]

- Mouse, touch and keyboard for everything; the battle is playable with arrows and Enter (the Vibe Pulse howto needs all three, §4.1).
- Toggles: reduce flashing (no inversion, no white flash: outlines only), reduce motion (no shake, shorter effects), color-blind palettes (elements also carry icons), larger damage numbers, a battle log that can be read instead of watched.
- Everything fits `vp-play` by width and height (§4.1); the HUD collapses to tabs under 900 px wide.

## 16. Audio [DECIDED as a first pass, batch 12]

[DECIDED, from the brief] Distinct sound effects for every action, from BOOM Library packs (§17). Music from the Sovereign Pact music folder; each House picks a Settlement theme. [DECIDED, batch 12] The mapping below is accepted as the start; the music assignment is to be judged in play.

### 16.1 Sound effects: mapping to the BOOM libraries [DECIDED, to iterate]

Every ability, item, hazard and UI action names a **cue**; cues map to processed cuts in `content/audio/sfx.json`. Each cue has 2–4 takes and plays with ±5% random pitch, so repeats never sound identical.

| Library (BOOM) | Used for |
|---|---|
| **Medieval Weapons** (Construction Kit, Designed) | Every weapon type's swing, hit, parry and sheath: swords, axes, maces, spears, knives, bows and crossbows (draw, loose, impact), shields (block, bash); armor foley by class (light, medium, heavy footsteps and hits) |
| **Close Combat** (Construction Kit, Designed) | Pugilist combos, grapples (Kelpie drags, Grapplers), body hits, Knockback, the Last Stand's exhausted breaths |
| **Creature Foley** (Designed) | Monster voices by tag: beasts (growls, roars), insects (chitter), undead (rattles, moans), demons (roars, laughs), slimes (squelch), constructs (grind, clank), aberrations (wet, wrong), dragons (breath intake); idle, attack, hurt and death per tag, with per-enemy overrides for bosses |
| **Magic – Arcane Forces** (Construction Kit, Designed) | Charging loops (rise with charge), spell casts and impacts by element tier (§15.4), dispels, summons appearing and vanishing, Readiness damage, buffs and debuffs |
| **Magic** (Construction Kit, Designed) | Holy and Dark families, healing, the Chapel's rites, Tarot draws, Relic reveals, the rift's hum |
| **Free Sounds – Death Whistle** | Sanity attacks, horrors' presence, the trauma incident sting, the injury roll's Devastating result |

- **UI** sounds (clicks, cards, votes, bids, the Year bell) are cut from the kits' cleaner elements, kept short and quiet.
- **Processing:** cuts are trimmed, normalized to −16 LUFS short-term, exported as OGG Vorbis (mono for SFX, 44.1 kHz, q4), named by cue. The source packs are never shipped (§17).
- **Mixer:** the site's `mixer` (§4.1) with buses: music, sfx, ui, ambience, voice-like (creature). Music ducks 6 dB under boss telegraphs and the injury roll; ambience ducks under battle.

### 16.2 Music: assignment of the 18 tracks [DECIDED, to iterate]

| Where | Track(s) | Why |
|---|---|---|
| Title and campaign load | Kingsfall (Alexander Nakarada) | The fallen crown |
| House creation | The Faded Rose (Ob-Lix) | Intimate, heraldic |
| Settlement themes (each House picks one at creation; the Town Map plays the current viewer's choice, and the Commons' vote screens play Night Market) | Irish Celtic Medieval Music (HitsLab); Night Market in Old Town (kang_saif); Shadows Beneath the Keep (MenielDM); Winter Sky (nojisuma); On the Way Home (nojisuma); BGM006 Dark Fantasy Lo-fi (welc0me.i0) | Six moods: festive, market, brooding, cold, homely, retro |
| Rift Gate and the chain map | Dark Fantasy Ambient (lux_aeterna_2026) | Dread, no beat |
| Events on an expedition | Light Blocking (nojisuma) under the prose; silence for Camp | Lets the text lead |
| Normal battles | Anime Battle Music (PhatPhrogStudio); Crimson Horizon (mroneilovealot); Dark Epic (nastelbom), chosen by pool: beasts and courts get the first, Pit and Outer Dark the second, undead and horror the third | Three battle colors |
| Elite and Hunt battles | Samurai Spirit: Cursed Oni (PhatPhrogStudio) | The yokai and hunts |
| Bosses | Japanese Gaming Boss Battle Music (OpenMindAudio) | The boss theme |
| Mandatory bosses and the Year 20 fight | The Spell (Ob-Lix) for Years 5–15; Dark Fantasy Music (Lux Aeterna) for the End Ruler | The arc's own themes |
| Results, the Chronicle and the Reckoning | The Lost City of Atlantis (OneCinematicStudio) | Grief and account |
| Campaign won / lost | Kingsfall reprise / Dark Fantasy Ambient | |

- Tracks loop with a marked loop point; screens crossfade over 1.5 s. The Vibe Pulse room plays the catalog's `music.ts` set (§4.1): the Settlement, battle and boss tracks, 1.5–3 minutes each, cut to length where the source is longer.
- **Adaptive touches** (cheap, no stems): battle music gains a low-pass filter when the party is below 30% HP and loses it on a kill; the boss theme's volume steps up at each phase; the Sanity bus adds a faint reversed-reverb layer (Death Whistle) when any Scion is under 25% Sanity.
- **Music brief for `meta.ts`** (§4.1): mood dark heraldic fantasy, slow to mid tempo (70–110 bpm) for town and travel, 130–160 for battle; strings, low brass, bodhrán and frame drums, solo female voice, church organ for Holy, detuned bells for the Unknown; `own: true`.

### 16.3 Ambience [DECIDED, to iterate]

One loop per pool (§14.5), 30–60 s, built from Creature Foley and Magic beds: wind and crows (Beast Lands), drips and creaks (Hollow Wood), water and bubbles (Marches), bone-wind (Barrows), blizzard (Deep Cold), fire and chains (Pit), grinding gears (Forge Ruins), whispers and a distant bell (Faceless City), camp noise and distant horns (Apostate Court), chimes (Shrine), wind and wingbeats (Reaches), a sub-bass hum and reversed voices (Outer Dark). The Town Map's ambience is the settlement: hammers, a market, the Chapel bell on the Year.

## 17. Assets and credits
See [CREDITS.md](CREDITS.md). Every asset author must appear in the in-game credits.

## 18. Open questions
Tracked with numbers in [DECISIONS.md](DECISIONS.md#open-questions). At handoff, batches 1–12 (Q1–Q84) are closed. What remains open is implementation work, not design: the LPC layer-set export and its per-layer credits (§6, §15.3), and every number marked "first pass" or "tune", which Josh wants to see in play before fixing.
