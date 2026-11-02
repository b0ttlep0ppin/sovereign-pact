# Decisions log — The Sovereign Pact

Newest first. Each entry: date, decision, who decided, where it lands in SPEC.md.

## 2026-11-02 (implementation, Milestone 8c): the battle screen, playing back

- A battle now opens on its own screen as soon as it is fought (§15.5). The pieces:
  - The enemy grid (E3 E2 E1) faces the party's (Front, Middle, Back) across a gap, both planes tilted.
  - The enemy panel is on the left, with HP. The party panel is on the right, with HP, MP, TP, Sanity, the four Durability pips (cracked under half, dark when Broken) and statuses.
  - The acting combatant glows. A telegraphed charge hatches its target cell red.
  - Damage numbers pop from the struck combatant: white, gold and larger for a crit, green for a heal, magenta for Sanity, with "Legs!" and the like on Scions and "Weak!" on a weak point.
  - An injury roll gets its own moment: the d20, the total, and the result in its band's color. The turn lasts twice as long.
  - The turn's headline sits above the field and its log lines below.
- Controls: play and pause, step a turn either way, 1×/2×/4×, skip to the end, and a turn slider. By keyboard: Space, the arrows, End and Escape.
- Several battles in one move queue up ("Next battle (2 more)"). A Battles panel lists the last twelve to watch again. "Watch battles as they happen" can be turned off, and the choice is remembered on that device.
- Readings:
  - The tokens are CSS (initials in House-colored rings) until the sprite pipeline exists (HANDOFF §8). The 4× gambit speed of §15.5 is one of the speed buttons rather than forced for Sorties.
  - Reduced motion (the system setting, until the game's own toggles exist): no tilt, no slides, no pops floating away (the numbers simply show for the turn).
  - Under 900 px the panels go under the field, and the controls stay pinned to the bottom.

## 2026-11-02 (implementation, Milestone 8b): battle replays

- Battles are still fought by gambits (DECISIONS, Milestone 6), so the battle screen (§15.5) plays them back. The rules record each battle as it is fought (`combat/replay.ts`):
  - who fought (names, sides, sizes, maxima),
  - every turn's events,
  - and after each turn, the vitals that changed: HP, MP, TP, Sanity, place, Down/Dead/Last Stand/Charging/Fled, Durability and statuses.
  The screen draws what was recorded and never re-runs the rules. Recording changes nothing: a recorded battle plays out exactly as an unrecorded one (tested).
- Expedition battles and Sorties are both recorded. Every House sees every battle, Sorties too, since the log already tells them all.
- Readings:
  - A replay is large (a long battle is up to about 100 KB). So the state keeps a move's replays only until the next move, and the screen keeps its own copy of what it has seen. A save never holds one (`checkpoint` drops them), so the 64 KB budget is untouched. On Vibe Pulse this means a replay crosses the network once, with the move that fought it.
  - A hidden trap's place is not in a replay: the field's hazards are not recorded, only the events, and a hidden trap makes none until it is sprung or disarmed.

## 2026-11-02 (implementation, Milestone 8a): the Town Map, first prototype

- The Settlement Phase now shows the Town Map (§15.6). Its pieces:
  - The Rift Gate tears open at the top edge.
  - The Commons sits in the middle, with its treasury, the year's Crisis, and its projects at their levels (those being paid for show as "rising").
  - Each House's Seat stands around it, with its keep and its buildings at their levels, in House colors with the emblem and a banner.
  - The walls run along the bottom.
  - The sky moves from dusk in Year 1 to red in the last Year, and Doom draws cracks of light along the horizon.
- The viewer's people stand as chits by their Year assignment. Dragging a chit onto a place assigns them; so does picking a chit and then the place, which also works by keyboard and touch. The places and what they do:

  | Place | Assignment |
  |---|---|
  | Keep | Rest |
  | Chapel | Chapel |
  | Infirmary | Infirmary |
  | Scriptorium | Study |
  | Training Ground | Train, or Teach for the Retired |
  | Farm, Lumber Camp, Quarry, Mine | Work there |
  | The walls | Guard |
  | The Rift Gate | Sortie |

  The rules refuse what is not allowed, and the reason shows.
- Readings:
  - The tiles are drawn in CSS for now. The Oryx tiles replace them once the packs are cut (HANDOFF §8.5), and the layout stays: four Seat quadrants around the Commons, rather than a 60×40 panning tile map, until the tiles exist.
  - Only the viewer's own chits are shown. Other Houses' assignments are private, as they are in the view.
  - A chit dropped on the Gate goes on the House's Sortie for this Year, or the first Sortie on offer if the House has none yet. A Sortie picker comes with the Gate's own panel.

## 2026-11-02 (implementation, Milestone 7bb): the last four consumables

With these, every consumable in §13.7 works.

- **Thief's Candle** (battle data `reveal`). It disarms every hidden trap on the party's grid, and every enemy Lurker's Readiness drops to 0.
- **Bottled Chorus.** It plays a March, Speed +1 to every ally, for 200 ticks (status `bottled_chorus`).
- **Component Pouch** (`grantParts` 2). A Tinkerer target gains the 2 Components its recipes want most, picked the way the bots pick from an offer. On anyone else it does nothing.
- **Passive Draught.** A new Settlement Phase move, `drink_draught {person}`. One of the House's Scions gains the blessing Draught-Strong: passive budget +1 until the Reckoning, so for the Year's expedition.
  - At every Reckoning, a Scion whose budget shrank now sheds passives, the last equipped first. Before this, a faded blessing could leave a Scion over budget.
- Bots:
  - The Candle on a first turn against a Lurker with a head start, or a hidden trap.
  - The Chorus once three foes stand.
  - The Pouch for a Tinkerer missing a recipe's parts.
  - Bots don't buy Tarot Tokens or Passive Draughts yet.
- Readings:
  - Thief's Candle, "reveals every hazard on the enemy grid". Hazards on the enemy grid are always in plain sight; the hidden ones are traps on the party's grid. So the Candle finds those, and a trap that is found is stepped around (disarmed). "A Lurker loses its free turn": in battle, its head start (CT) is gone.
  - Bottled Chorus, "a Minstrel song for 2 turns": the bottle holds a March. Two turns is 200 ticks.
  - The Component Pouch picks the Components itself, as the bots do. A choice by hand comes with the battle screen.
  - Passive Draught: "for one expedition" means until the next Reckoning. It is drunk in town, where passives are equipped.

## 2026-11-02 (implementation, Milestone 7ba): carried items, and the Tarot Token

- The **Saint's Tooth** and the **Dice of the Marches** work from the party satchel on a Scion's injury rolls, in battle and in expedition events (`carriedRoll` in `combat/injury.ts`). Each is spent when it works.
- The **Tarot Token** is a new Settlement Phase move, `draw_tarot {person}`. One of the House's Scions draws a new Tarot, never the one they had, once in their life (a new history counter, `tarot_tokens`). The log names the Scion but not the card; only their House sees it.
- Bots pack one Saint's Tooth and one Dice of the Marches when they hold them.
- Readings:
  - Saint's Tooth. "A Mortal wound becomes Devastating (severed)": the only Mortal wound is on the Body table, which has no severing. The wound becomes the Arms table's Severed instead (`tuning.consumables.uses.toothResult`): the saint takes an arm in place of a life. A cap on injuries never softens it.
  - Dice of the Marches. "Reroll one injury roll, before seeing the table; whoever holds it decides." The rule decides for the holder: it rerolls a d20 of 5 or less (`diceRerollAt`), seen before the table is read, and keeps the second roll.
- Left for 7bb: the Passive Draught, the Thief's Candle, the Bottled Chorus and the Component Pouch.

## 2026-11-02 (implementation, Milestone 7az): the satchel between nodes

- A new move, `use_item {id, person?}`, opens the party satchel between nodes.
  - **Camp items** work only when the last node was a Camp:
    - Pilgrim's Bread restores the whole party.
    - Widow's Tea gives a Scion Sanity +20%, and Sleep for the next battle's first 100 ticks.
    - The Smuggler's Flask makes every location whole for the next battle, for Sanity −5%.
  - **The Lantern** lights the next node. If that node is an Encounter (or an event's, a raid or a lair), the party gets the Surprise, even against a quarry that would ambush.
  - **The Signal Flare** works on a Rescue card: one of its Lost Scions joins the party at once.
- Readings:
  - The satchel belongs to the party. Out of battle, as in battle, any House with a Scion marching may use anything in it, whoever packed it.
  - HP is whole at the start of every battle, so Pilgrim's Bread's "the whole party to full HP" would do nothing. It restores what the road wears down and a Camp does not: the whole party's MP, to full.
  - "Joins the party at the next node" is read as joining now, between nodes, so the Scion fights at the next one.
  - Bots:
    - They pack one each of the road items they know how to use: Pilgrim's Bread, Widow's Tea, the Smuggler's Flask, the Lantern, and the Signal Flare (only on a Rescue card).
    - At a Camp they use these for a Scion under half their MP, Sanity or a location's Durability.
    - They light a Lantern before an Encounter, raid or lair, and fire the Flare whenever it can bring someone back.
    - They now keep one Lantern at home.

## 2026-11-02 (implementation, Milestone 7ay): the hand-coded battle items, as data

- Most of §13.7's "special" battle items are now plain battle data, using four small additions to abilities: a status may name a `tag` (only targets with it take the status), `ownHouse` (only the user's House's Scions take the effects), `bossReadiness`, and `cast` (a Job active cast at once).
  - Ember Oil, Brine and Stormwax give the Scion's weapon a fire, water or wind edge (status `edged`) for the battle. A new edge replaces the old one.
  - Oathwine gives every Scion of the user's House on the field +10% damage (`oathbound`) for the battle.
  - Blackroot Chew mends 5% of every location's Durability at the start of each turn for 300 ticks (`durPctPerTurn`).
  - Hollow Ivory Dust Stuns the undead and constructs in a cross.
  - Wine no longer makes a Scion of the Fond of Wine Tipsy (the trait gains `immune.tipsy`).
- Readings:
  - Grave Dust: 18 of the 24 undead enemies are immune to Fear, so the dust inflicts its own status, Turned. A Turned enemy flees as the Afraid do, fearless or not. A boss it hits loses 30 Readiness on top.
  - The Mourning Veil's cost, "Sanity −10% after", is paid when the veil is worn. It then makes the Scion take no Sanity damage and immune to Fear for the battle (`veiled`). Paying up front keeps the cost in the battle that bought the protection.
  - Blackroot's "Sanity −5" is read as 5% of maximum Sanity, like every other Sanity cost on a consumable.
  - The one generic Scroll ("names its spell when found") is now five Scrolls, each naming its spell: Firestorm, Glacier, Tempest, Mending Rain and Breath of Life. A Scroll casts its spell at once, for no MP, from the reader's own stats.
  - Bots use Grave Dust and Hollow Ivory Dust once two of their targets stand, and Oathwine once three foes stand and no Scion of their House has drunk it yet.
- Still hand-coded, for 7az: Thief's Candle, the Bottled Chorus and the Component Pouch in battle, and the camp, node, held and town items.

## 2026-11-02 (implementation, Milestone 7ax): consumables in battle

- Any Scion may use a consumable from the party satchel as its action (`{do: "item"}`), for 100 CT, or 60 under the Vagabond's Quick Hands (`itemCt`). Each consumable acts as the ability its content describes: Tonics heal, salves mend Durability, Antidotes and Clarity Draughts cure, Smelling Salts revive, Ethers restore MP (a new `mpPct`), bombs strike a 3×3, and Nets root. What a battle uses leaves the expedition's satchel, the first packed of its kind first.
- Herb Lore (`itemHealPct` 30) and the Herbalists (20) raise what consumables heal and mend; Herb Lore is no longer marked for later.
- Readings:
  - A bot Scion without a gambit list of its own reaches into the satchel in this order: Smelling Salts on a Down Scion, a Tonic on an ally under 35% HP, a Clarity Draught or an Antidote on the afflicted, a salve on a location under 30%, an Ether when its own MP is under 20%, and a bomb when three foes stand (`tuning.consumables.bots`).
  - A Scion with its own gambits uses items only through rules that name them (`do: "item:tonic"`).
  - Thrown single-target items (the Net, Caltrops, the Hangman's Rope) reach any column.
  - The hand-coded specials (Grave Dust, edges, Oathwine and the rest) wait for the next PR, and so does Wine's exception for the Fond of Wine.
- Six 2-House campaigns from seed 1 (`npm run sim:campaign`): mandatory expeditions won rose from 6 to 8 of 18, and wipes fell from 31 to 30.

## 2026-11-02 (implementation, Milestone 7aw): packing the party satchel

- A House packs the satchel as it fields its Scions (`field` takes an optional `pack`, by id and count), from what it holds at home. The satchel holds one consumable a slot, 12 slots (`tuning.consumables.satchel`), and remembers who packed each one.
- Unused consumables go home to the Houses that packed them when the expedition closes. A wiped party loses its satchel with everything else it carried (§9.9). Every House sees the satchel.
- Readings:
  - Each House may fill its share of the 12 slots: 12 × the Scions it fields ÷ the card's seats, rounded up, and never more than the satchel has left. First come, so no House can fill it alone.
  - A bot packs the battle consumables it holds, Tonics first, up to its share.
- Using them in battle comes next.

## 2026-11-02 (implementation, Milestone 7av): consumables as data, and buying them

- `content/consumables.json` holds §13.7's list, the slashed entries split into their own items (Tonic, Strong Tonic and Vital Draught; Firebomb, Frost Flask and Shock Jar; Ember Oil, Brine and Stormwax…), 41 in all. Each has a first-pass Gold price, where it is sold, when it is used (battle, camp, node, town or held), and either a battle effect shaped as an ability or a hand-coded `special`. Its schema is `schemas/consumables.schema.json`.
- A House holds consumables by count (`House.consumables`), seen only by that House. It buys them in the Settlement Phase (`buy_consumable`, 1–10 at a time) wherever they are sold.
- Readings:
  - "Apothecary 1/2/3" is the Apothecary's stock tier, which expedition finds raise like the other shops'. "Workshop", "Chapel", "Farm", "Shrine", "Forge" and "Scriptorium L2" are the buying House's own building at that level. "Market" is the Great Market and "Curio" the Curio Dealer.
  - A House pays the list price at its own buildings. The Patrons of the Guilds' discount applies only in the Commons shops.
  - Caltrops slow, and the Net and the Hangman's Rope root, the one enemy they are thrown at. The enemy grid has no cell traps to place them in.
  - Wine's Accuracy malus is a new status, Tipsy.
  - A bot keeps a few Tonics, Bone Salves, Antidotes, Clarity Draughts and Smelling Salts at home while it has 40 Gold to spare (`tuning.consumables`).
- Packing the satchel, using items in battle, and the camp, node and carried items follow in the next PRs.

## 2026-11-02 (implementation, Milestone 7au): every event pool meets its budget

- Twenty-eight events (556 in all) bring every region to 25: two each for the Beast Lands, the Hollow Wood, the Drowned Marches and the Barrows, and one or two for each of the rest. With the general pool at 150 and the five card-type pools at 25, every pool HANDOFF §6 budgets is now full; `npm run events` shows each as ok.
- Maiming is 0.12% of outcome weight, well under the 2% budget, and every subject rule is used at least five times.
- Reading: the Name Wall's subject is a random Scion ("one of the uncrossed names is a Scion's"); crossing it out either lets the party pass as the city's own or silences that Scion.

## 2026-11-02 (implementation, Milestone 7at): sixteen region events toward 23 each

- Sixteen events (528 in all): two each for the Deep Cold, the Pit, the Forge Ruins, the Faceless City, the Apostate Court, the Shrine of Six, the Dragon Reaches and the Outer Dark. Those eight regions now have 23, the other four 22; the budget is 25.
- Reading: the Healing Hands names its subject with `scion:injured:any`, falling back to the Scion with the least Sanity when no one is injured, so the shrine always has someone to mend.

## 2026-11-02 (implementation, Milestone 7as): sixteen region events toward 22 each

- Sixteen events (512 in all): two each for the Beast Lands, the Hollow Wood, the Drowned Marches and the Barrows, one for each of the other eight regions. Four regions now have 22, the rest 21; the budget is 25.
- Reading: the Dryad's Bargain is an each_scion event on both options; each Scion decides whether to give her a lock of hair.

## 2026-11-02 (implementation, Milestone 7ar): every region reaches 20 events

- Sixteen events (496 in all): two each for the Drowned Marches, the Forge Ruins, the Faceless City and the Shrine of Six, one for each of the other eight regions. All twelve regions now have 20; the budget is 25.
- Reading: a Fork that sends the party off course on the Drifting Island adds an encounter and a cache, so a wrong landing can still pay.

## 2026-11-02 (implementation, Milestone 7aq): sixteen region events toward 19 each

- Sixteen events (480 in all): three for the Outer Dark, two each for the Beast Lands, the Barrows, the Deep Cold, the Pit, the Apostate Court and the Dragon Reaches, one for the Hollow Wood. Eight regions now have 19, the other four 18; the budget is 25.
- Reading: the Sleeping Queen wakes more often than not when her crown is taken (60%), at encounter level +2, since the crown is a tier-3 item.

## 2026-11-02 (implementation, Milestone 7ap): sixteen more region events

- Sixteen events (464 in all): three each for the Hollow Wood, the Drowned Marches, the Forge Ruins, the Faceless City and the Shrine of Six, one for the Apostate Court. Every region now has 16–18; the budget is 25.
- Reading: the Blank Portraits is an each_scion event (both options), since each Scion sees their own likeness.

## 2026-11-02 (implementation, Milestone 7ao): sixteen region events for the thinnest regions

- Sixteen events (448 in all): three each for the Beast Lands, the Deep Cold, the Pit and the Dragon Reaches, two each for the Apostate Court and the Outer Dark. Every region now has 15–17; the budget is 25.
- Readings: a Fork that sends the party "somewhere else entirely" adds two encounters (the schema's node kinds are encounter, event, camp and cache). Burning the Map of Nowhere lowers Doom by 1, the same size as the other events that lower it.

## 2026-11-02 (implementation, Milestone 7an: every card-type pool reaches 25) — implementer
- **Built** (content only). Sixteen events: the Trail of Coins, the Mad Hermit and the Lost One's Shadow (Rescue); the Fallen Watchtower, the Copper Creek, the Wild Horses and the Essence Moths (Resource); the Bone Pile, the Hunter's Moon and the Wounded Quarry (Hunt); and the Thorn Lion, the Hoarfrost Hermit, the Pit Gladiators, the Dragon Bard, the Echo Self and the Spirit Bear for the six thinnest regions. That makes 432 expedition events. Every card-type pool (Delve, Hunt, Pilgrimage, Rescue, Resource) and the general pool now meet HANDOFF §6; the twelve regions have 14 to 17 each and remain to fill.

## 2026-11-02 (implementation, Milestone 7am: Delve and Pilgrimage pools reach 25) — implementer
- **Built** (content only). Sixteen card-type events: the Sealed Vault and the Lowest Level (Delve); the Beggar Saint, the Vigil, the Pilgrims' Feast, the Stigmata and the Chained Pilgrims (Pilgrimage); the Ghost of the Lost, the Broken Bridge and the Last Letter (Rescue); the Beaver Dam, the Star Iron and the Mushroom Cellar (Resource); the Shed Scales, the Poachers and the Calling Horn (Hunt). That makes 416 expedition events. Delve and Pilgrimage meet HANDOFF §6's 25; Rescue and Hunt have 22, Resource 21.

## 2026-11-02 (implementation, Milestone 7al: a ninth round for the regions; 400 events) — implementer
- **Built** (content only). Sixteen events: the Vulture Tree, the Green Knight, the Mud Men, the Grave Digger, the Northern Lights, the Brass Bull, the Forge-Master's Ghost, the Rooftop Chase, the Confessional, the Six Stars, the Kobold Mine and the Unravelling (one for each region), the Lost One's Song and the Deserters for Rescues, the Sap Trees for Resource cards and the Quarry's Hide for Hunts. That makes 400 expedition events; every region has 13 to 17.
- **Reading:** the Green Knight's return a Year later would want a town event of its own; for now his promise only raises Doom, and the return is left for a later pass.

## 2026-11-02 (implementation, Milestone 7ak: an eighth round for the regions, Delves and Pilgrimages) — implementer
- **Built** (content only). Sixteen events: the Snake Charmer, the Hollow Oak, the Eelmen, the King's Barrow, the Ice Witch, the Hellhound, the Quench Pool, the Pickpocket, the Burning Heretic, the Offering Bowl, the Dragon-Bone Bridge and the Door in the Air (one for each region), the Crystal Cave and the Underground River for Delves, and the Pilgrim Ghost and the Relic Thieves for Pilgrimages. That makes 384 expedition events; every region has 12 to 16, Delve 23 and Pilgrimage 20.

## 2026-11-02 (implementation, Milestone 7aj: a seventh round for the regions) — implementer
- **Built** (content only). Sixteen events: the Lion Pride, the Spider Silk, the Heron King, the Bone Harp, the Frozen Army, the Demon Tailor, the Mold Room, the Name Thief, the Penitent Knight, the Choir Loft, the Wyvern Nest and the Mouth (one for each region), the Message in the Bark and the Ransomed One for Rescues, the Ruined Quarry for Resource cards and the Track in the Snow for Hunts. That makes 368 expedition events; every region has 11 to 15.

## 2026-11-02 (implementation, Milestone 7ai: card-type pools fill out) — implementer
- **Built** (content only). Sixteen card-type events: the Bloody Boot, the Cage Cart, the Witness and the Wounded Hound (Rescue); the Peat Bog, the Rival Miners, the Amber Cliff and the Hidden Spring (Resource); the Shed Antler, the Hunters' Shrine, the Lair Mouth and the Wounded Hunter (Hunt); the Bat Roost and the Stone Door (Delve); the Shrine of Feet and the False Prophet (Pilgrimage). That makes 352 expedition events: Delve 21, Pilgrimage 18, Hunt 17, Resource 16, Rescue 15.
- **Reading:** a few options here move Accord a point either way (sharing a seam with a rival House's miners, leaving a rival's wounded hunter behind), as other Houses' people are involved even though their Scions are not present.

## 2026-11-02 (implementation, Milestone 7ah: a sixth round for the regions, Pilgrimages and Delves) — implementer
- **Built** (content only). Sixteen events: the Horned Rider, the Fox Wedding, the Frog Prince, the Mourners, the Mammoth Graveyard, the Lava Ferry, the Clockwork Bird, the Lamplighter, the Relic Forger, the Seventh Door, the Dragon Hatchling and the Inverted Tower (one for each region), the Footwashers and the Last Mile for Pilgrimages, and the Echo Chamber and the Ghost Light for Delves. That makes 336 expedition events; every region has 10 to 14.
- **Reading:** the Lava Ferry, the Lamplighter and the Last Mile are whole `each_scion` events (every option is each Scion's own pick), as 7ag's test now requires.

## 2026-11-02 (implementation, Milestone 7ag: a fifth round for the regions, and whole each_scion events) — implementer
- **Built** (content only). Sixteen events: the Wolf Mother, the Witch's Hut, the Bog Bodies, the Tomb Robber's Map, the Snow Queen, the Soul Auction, the Rusted Titan, the Dung Heap Court, the Bishop's Offer, the Pool of Six, the Dragon Knights and the Last Lamp (one for each region), the Signal Fire and the Prisoner Exchange for Rescues, the Wild Orchard for Resource cards and the Quarry's Mate for Hunts. That makes 320 expedition events; every region has 9 to 13.
- **Fix.** The rules treat `each_scion` and `secret` as the way a whole event is put (every option has the rule), but six events from 7af and this batch gave one option `each_scion` beside voted ones, and choosing it crashed the reducer (the view test's campaign found it). Those options are now voted, with their effects on the whole party. `npm run content` now fails on an event that mixes either rule with others.

## 2026-11-02 (implementation, Milestone 7af: a fourth round for the regions, with two more secret choices) — implementer
- **Built** (content only). Sixteen events: the Stag Trial, the Lost Children, the Drowned Hoard, the Barrow Wight, the Frost Giant's Cup, the Devil's Contract, the Last Apprentice, the Mirror Maze, the Inquisitor, the Fasting Monks, the Wyrm Priest and the Starless Choir (one for each region), the Pilgrims' Bridge and the Saint's Bones for Pilgrimages, and the Cave-In and the Glowworm Cavern for Delves. That makes 304 expedition events; every region has 8 to 12.
- **Reading:** the Drowned Hoard and the Devil's Contract are secret choices (Q91): each House picks alone, and the outcome turns on whether any House took the selfish option. If every House tears up the Devil's Contract, Doom falls by one.

## 2026-11-02 (implementation, Milestone 7ae: a third round for the regions, and the ones who lag behind) — implementer
- **Built** (content only). Sixteen events: the Crow Counsel, the Weeping Willow, the Sinking Road, the Open Coffin, the White Bear, the Brimstone Lift, the Bellows' Breath, the House of Doors, the Relic Procession, the Six Masks, the Dragon's Shed Skin and the Silence (one for each region), the Lost One's Camp and the Captor's Deal for Rescues, the Salt Pans for Resource cards and the Rival Party for Hunts. That makes 288 expedition events; every region has 7 to 11.
- **Budget:** the lowest-Resilience and lowest-Speed rules 7ad added now have five uses each, so `npm run events` flags no rule.

## 2026-11-02 (implementation, Milestone 7ad: a second round for the regions, Pilgrimages and Delves) — implementer
- **Built** (content only). Sixteen events: the Boar King, the Moth Lantern, the Floating Market, the Bone Choir, the Ice Bridge, the Chain Gang, the Slag Golem, the Masked Judge, the Heretic's Bonfire, the Sixth Bell, the Scorched Village and the Hole in the Sky (one for each region), plus the Pilgrims' Well and the Hermit's Cave for Pilgrimages and the Flooded Gallery and the Singing Vein for Delves. That makes 272 expedition events; every region now has 6 to 10.
- **Reading:** two subject rules join the pool (the weakest Resilience and the lowest Speed, for a scene that falls on the one who lags behind); `npm run events` flags them until the next batches bring each to five uses.

## 2026-11-02 (implementation, Milestone 7ac: Rescue, Resource and Hunt cards get their own scenes) — implementer
- **Built** (content only). Sixteen card-type events: six for Rescue cards (the Torn Banner, the Ransom Note, the Survivor's Cache, the Lost One's Trade, the Echoing Voice, the Healer's Hut), five for Resource cards (the Quarry Face, the Timber Giants, the Ore Beast, the Essence Well, the Abandoned Mill) and five for Hunts (the Blood Trail, the Baited Snare, the Quarry's Den, the Hunter's Tale, the False Quarry). That makes 256 expedition events; Rescue has 7, Resource 10 and Hunt 11 against a goal of 25.
- **Reading:** a Rescue scene speaks of the Lost without naming them, since the rules do not yet pass the card's Lost Scions to an event; its options shorten the way to them (`skip`) or warn of what follows (`foresee`).

## 2026-11-02 (implementation, Milestone 7ab: one more event for every region, and every subject rule in use) — implementer
- **Built** (content only). Sixteen region events: the Old Bull (Beast Lands), the Bark Mask (Hollow Wood), the Eel Wife and the Net Mender (Drowned Marches), the Veteran's Barrow (Barrows), the Frozen Lake (Deep Cold), the Dice Pit (Pit), the Cold Anvil (Forge Ruins), the Face Trader and the Shooting Gallery (Faceless City), the Mother Superior and the Court Cartomancer (Apostate Court), the Silent Cell and the Two Candles (Shrine of Six), the Dragon's Tithe (Dragon Reaches) and the Backward Man (Outer Dark). That makes 240 expedition events.
- **Budget:** every subject rule is now used at least five times, as HANDOFF §6 asks; `npm run events` flags none. Each region now has 5 to 9 events against a goal of 25.
- **Reading:** an option keyed to a trait, a Tarot card, a Change or a hurt arm always names a fallback rule, so a party without such a Scion still has the option.

## 2026-11-02 (implementation, Milestone 7aa: the general pool reaches 150) — implementer
- **Built** (content only). Sixteen general expedition events: the Iron Maiden, the Archer's Wager, the Green Hand, the Widow's Tide, the Overgrown Throne, the Lamp on the Peak, the Old Soldiers, the Inn of the Changed, the Arrow Storm, the Shy Ghost, the Brave Man's Bridge, the Scrap Heap, the Dice of Houses, the Coward's Cave, the Altar of Scars and the Tide Bell. That makes 224 expedition events, 150 of them open to any card, which meets HANDOFF §6's general budget.
- **Reading:** these lean on the subject rules `npm run events` flagged as rarely used (a trait, a Tarot card, a Change, an old wound, fewest kills or expeditions, the House the dice pick), each with a fallback rule for a party that has no such Scion. Fewest kills and fewest expeditions now reach five uses; the per-pool fill will raise the rest.

## 2026-11-02 (implementation, Milestone 7z: sixteen more general events) — implementer
- **Built** (content only). Sixteen general expedition events: the Fallen Messenger, the Oathstone, the Chess Player, the Fallen Star, the Prison Cart, the Bridge of Light, the Sunken Road, the Lantern Procession, the Crown in the Mud, the Cold Cave, the Puppet Show, the Honest Merchant, the Black Dog, the Clear Spring, the Bandits' Toll and the Glass House. That makes 208 expedition events, 134 of them open to any card.
- **Reading:** each uses only effects and subject rules the rules already have.

## 2026-11-02 (implementation, Milestone 7y: sixteen general events, and one title per scene) — implementer
- **Built** (content only). Sixteen general expedition events: the Hollow Hill, the Ship on the Hill, the Sick Village, the Doppelganger, the Dancing Bear, the Storm, the Sleeping Knight, the Ogre's Kitchen, the Hedge Maze, the Widow's Lantern, the Stone Circle, the Thief in Camp, the World's Root, the Lost Patrol, the Well-Keeper and the Idle Golem. That makes 192 expedition events, 118 of them open to any card.
- **Test.** `npm run content` now fails when two expedition events share a title (ignoring case and a leading "The"), after 7x found three near-copies by hand; it caught a fourth in this batch (a Bone Market beside §9.7's), which became the Dancing Bear.

## 2026-11-02 (implementation, Milestone 7x: seventeen general events, three in place of near-copies) — implementer
- **Built** (content only). Seventeen general expedition events: the Ruined Watchtower, the Cursed Coin, the Abandoned Kennel, the Ferryman, the Painted Cave, the Starving Wolf, the Scholar's Tower, the Two Doors, the Bleeding Ground, the Sellswords, the Hedge Witch, the Ford, the Golden Cage, the Stopped Sundial, the Salt Flats, the Collector and the Howling Pass.
- **Fixed.** Three events from 7n and 7q (the Weeping Statue, the Mirror Pool, the Feast of Crows) shared their title and idea with §9.7's own Weeping Statue, Mirror Pool and Feast of Crows; they are removed, and the Salt Flats, the Collector and the Howling Pass take their places. That makes 176 expedition events, 102 of them open to any card.

## 2026-11-02 (implementation, Milestone 7w: events for the card types) — implementer
- **Built** (content only). Fourteen events drawn by card type rather than region, since an Event node draws from the card's pools (its region or its type) half the time: Delves (the Collapsed Stair, the Bad Air, the Listening Chamber, the Miners' Ghosts, which is also a Resource event), Hunts (the Quarry's Trail, the Old Hunters' Camp, the Bait, the Rival Hunter), Pilgrimages (the Pilgrim Road, the Penitent's Steps, the Relic Seller), Resource runs (the Rich Seam, the Old Stand) and the first Rescue event (the Lost One's Mark). That makes 162 expedition events.
- **Reading:** a Rescue card draws `rescue` events like any other type; they speak of following the Lost and never decide whether the Lost are found, which stays with the Rescue rules (§9.9).

## 2026-11-02 (implementation, Milestone 7v: fourteen more general events) — implementer
- **Built** (content only). Fourteen general expedition events: the Overturned Cart, the Struck Oak, the Singing Blade, the Honey Hall, the Ghost Caravan, the Blind Archer, the Glass Bridge, the Other Party, the Forgotten God, the Lame Horse, the Nest of Knives, the Last Dance, the Rust Moths and the Traveling Players. That makes 148 expedition events, 88 of them open to any card.
- **Reading:** each uses only effects and subject rules the rules already have. In the Traveling Players the cruel option (paying to cast a rival House as the villain) falls to the House highest in Standing and costs Accord, as sabotage that is visible but deniable.

## 2026-11-02 (implementation, Milestone 7u: a third event for each pool) — implementer
- **Built** (content only). Fourteen pool events, one more for each region and a fourth for the Pit and the Outer Dark, the two thinnest: the Pack Den, the Ring of Mushrooms, the Bog Light, the Grave Robbers, the Avalanche Bell, the Brimstone Spring, the Forge Spirit, the Mask Seller, the Procession, Six Pilgrims, the Wyrm Graveyard, the Unlit Stars, the Pit Brawl and the Door Out. That makes 134 expedition events.
- **Reading:** the Pack Den brings home a recruit (`house_improvement: recruit`): a pup raised in the House stands for a new follower, as that effect already allows.

## 2026-11-02 (implementation, Milestone 7t: the event pool report, and fourteen events for the quieter rules) — implementer
- **Built.** `npm run events` (`tools/events.ts`) reports the expedition event pool against HANDOFF §6's budget and lints: events per pool (≥ 150 general, ≥ 25 for each other pool), option tags, the share of outcome weight that can maim (≤ 2%; an injury roll maims on its table's devastating results), and how often each subject rule is used (≥ 5 times each). It is a report, not a test, while the pool is being filled; it becomes a test once the budget is met.
- **Built** (content). Fourteen general events written for the subject rules the report showed as rarely used: Falling Rocks, the Veterans' Shrine, the Field Hospital, the Proving Stone, the Hungry Doorway, the Watcher in the Trees, the Empty Feast, the Drawing of Lots, the Greenhorn's Chance, the Bridge of Names, the Simple Oracle, the Kin of the Changed, the Shrine of Trials and the Newcomer's Luck. That makes 120 expedition events, 74 of them open to any card. Maiming stays well under budget (about 0.3%).

## 2026-11-02 (implementation, Milestone 7s: the named items reach 120) — implementer
- **Built** (content only). The last twenty named items of the budget, which makes 120. Each pool now hides at least five of its own, from the Bloodhound Collar (Beast Lands) to the Voidstep Sabatons (Outer Dark and the Pit).
- **Reading:** six of them carry a real cost beside their gift, so a House has to want them: the Rootbound Plate (more Fire damage), the Chain of the Pit (hexed: Sanity −5 each battle), the Ring of the Kept Promise (Marked every battle), the Veil of Many Faces (lower max Sanity), the Hollow Crown (it whispers, queueing a trauma incident) and the Voidstep Sabatons (weaker against physical ailments).

## 2026-11-02 (implementation, Milestone 7r: twenty more named items) — implementer
- **Built** (content only). Twenty named items found in the otherworld, most of them shared between two pools that border each other in theme (the Lantern Shield in the Outer Dark and the Barrows, Tidebreaker in the Drowned Marches and the Deep Cold), a few kept to one pool (Frostbrand, the Dragonhide Boots, the Marsh-Lord's Circlet). That makes 100 named items.
- **Reading:** the Eye of the Deep pays for its sight with a weaker mind (brittle nerve); every value stays within its property's roll range.

## 2026-11-02 (implementation, Milestone 7q: fourteen more general events, with secret and each-Scion ones) — implementer
- **Built** (content only). Fourteen general expedition events: the One Rope and the Poisoned Well (secret: each House picks alone, and how it goes turns on whether another House betrayed the rest, Q91), the Echoing Hall and the Steaming Pool (each Scion chooses for themself), and the Thirsting Banner, the Beggar King, the Crooked Signpost, the Stranded Merchant, the Quiet Battlefield, the Dreaming Tent, the Glass Garden, the Old Soldier, the Feast of Crows and the Fortune Teller. That makes 106 expedition events, 60 of them open to any card.
- **Reading:** each uses only effects and subject rules the rules already have. The Beggar King asks the House lowest in Standing, and its cruel option falls to the highest, so a lead can cost Doom.

## 2026-11-02 (implementation, Milestone 7p: two more named items for each pool) — implementer
- **Built** (content only). Twenty-four named items found in the otherworld, two for each pool, so every region now hides at least three: for example the Alpha's Mantle and the Long Spear of the Hunt (Beast Lands), the Brimstone Plate (Pit), the Unfinished Blade (Forge Ruins), the Scale of the Old Wyrm (Dragon Reaches) and the Starless Blade (Outer Dark). That makes 80 named items.
- **Reading:** each has a property or two that make it worth carrying, and the strongest have a cost too: the Shroud of the Unquiet takes more Holy damage, the Brimstone Plate more Water, the Lantern That Remembers lowers max Sanity and the Starless Blade weakens its wielder's mind. Every value stays within its property's roll range.

## 2026-11-02 (implementation, Milestone 7o: a second event for each pool) — implementer
- **Built** (content only). A second pool event for each of the twelve regions: the White Stag (Beast Lands), the Hanging Wood (Hollow Wood), the Drowned Chapel (Drowned Marches), the Barrow Feast (Barrows), the Frozen Hunter (Deep Cold), the Bargain Pit (Pit), the Bellows Ghost (Forge Ruins), the Census Takers (Faceless City), the Heretic's Trial (Apostate Court), the Seventh Altar (Shrine of Six), the Wyrm Egg (Dragon Reaches) and the Still Traveler (Outer Dark). That makes 92 expedition events.
- **Reading:** each uses only effects the rules already have; the Still Traveler is the first event outside the arc to use `foresee`, as the rarest kind of luck in the Outer Dark.

## 2026-11-02 (implementation, Milestone 7n: fourteen more general events) — implementer
- **Built** (content only). Fourteen general expedition events, which can turn up on any card: the Toll Keeper, the Weeping Statue, the Lost Child, the Mirror Pool, the Rusted Army, the Merchant of Teeth, the Starving Pilgrims, the Warm Ashes, the Fallen Scion, the Whispering Well, the Bone Dice, the Red Rain, the Sleeping Giant and the Singing Skull. That makes 80 expedition events, 46 of them open to any card.
- **Reading:** each uses only effects the rules already have. Each has a careful option, a bold or reckless one, and a clever, kind or cruel one, so a party's temper shows in what it picks.

## 2026-11-02 (implementation, Milestone 7m: a pool event for each of the twelve regions) — implementer
- **Built** (content only). One expedition event of its own for each otherworld pool, so every region has a scene that can happen nowhere else: the Stampede (Beast Lands), the Singing Tree (Hollow Wood), the Ice Choir (Deep Cold), the Pit Market (Pit), the Vacant Star (Outer Dark), the Last Hoard (Dragon Reaches), the Masked Ball (Faceless City), the Empty Court (Apostate Court), the Sunken Bell (Drowned Marches), the Engine Heart (Forge Ruins), the Six Bowls (Shrine of Six) and the Open Grave (Barrows). That makes 66 expedition events.
- **Reading:** each uses only effects the rules already have, and draws at weight 3 within its pool's own level range, so it turns up about as often as a general event on that pool's cards. The SPEC budget (at least 150 general and 25 per pool) is still being filled.

## 2026-11-02 (implementation, Milestone 7l: the rest of §9.7's events) — implementer
- **Built** (content only, plus the `mend` effect). The 13 events in §9.7's table that were not yet in the game: the Trial of the Veteran, A Perfectly Preserved Library, Wolves at the Fire, the Rot That Thinks, the Hermit of the Gate, Footprints Leading Back, the Spider Queen's Court, the Chained Angel, the Prisoner Who Knows Your Name, the Burning Man, the Grinning Surgeon, the Count of the Dead and the Last Stair. That makes 54 expedition events.
- **New effect** `mend`: the subject's oldest lasting Moderate injury heals. It is used by the Grinning Surgeon.
- **Readings** (where the table names something the rules cannot do yet; each uses the nearest existing effect):
  - The Veteran's duel is a 55/45 roll: a blessing, Valor and XP, or a Body injury roll.
  - The wolves "joining the boss fight on your side" becomes Haste for the next battle.
  - The Hermit "revealing the boss's pattern" becomes Shell for the next battle; his lie becomes Slow.
  - Footprints Leading Back finds a lost campsite's gear (a Fine item) or a doppelganger ambush. It does not find Lost Scions, who come home only by Rescue cards (§9.9).
  - The Chained Angel's "unique fallen-angel Scion" is a recruit for the House.
  - The Count of the Dead's "dead Scion walks again" is a recruit, until a Grave-Touched return exists.
  - The Spider Queen's "offer a Ward" became tribute in Gold, since no rule yet names a Ward as the subject.
  - The Rot's "Alterer form unlocked" is a Sagacity growth.
  - "Most Holy affinity" is read as a Devout or Pious Hands Scion, falling back to the party's vote.
  - "Water affinity" is read as a Tidebound Scion, falling back to the highest Resilience.

## 2026-11-02 (implementation, Milestone 7k: The Gate's Reflection) — implementer
- **Built** (§9.7, §14.7, §14.7a; `withReflection` in `arc.ts`, `offerReflection` in `bargains.ts`, event `content/expedition/gates_reflection.json`, three `reflection` bargains). The final Year's chain ends with a `reflection` place just before the End Ruler. Arriving there:
  - Each House in the party is privately offered one of the Year 20 bargains: the Crowned Reflection (Renown and Lineage), the Glass Champion (a stat +3 on the House's best Scion), or the Rival's Reflection (a bane on a rival's Renown and Valor). Every one carries a Pact mark (the SPEC's [PROPOSED] "always carries one").
  - Each Scion's House chooses for them (`each_scion`). If they look, the House is told its Ascendancy as a number, with the Ambition counted (the SPEC's "Ambition revealed as a number"), and the Scion starts the final fight with Protect, and usually Regen too; 30% of the time the look also costs 20 Sanity. If they look away, they gain 15 Sanity.
- **Readings**:
  - The bargain is answered during the expedition, and the party waits on every House in it (`waiting`) before the Leader can press on. Every House present is offered one, so waiting on a House shows nothing about what it chose.
  - The SPEC has these bargains resolve during the End Ruler's last phase. Here a bargain is paid and settles as soon as it is accepted, which is still just before the final fight, so its stat or score lands before the boss. Resolving it inside the battle at 25% is left for the presentation pass, when a moment like that can be shown on screen.
  - Bots refuse, as everywhere.

## 2026-11-02 (implementation, Milestone 7j: cure items) — implementer
- **Built** (§11.2, §13.6, `cures.ts`; content: five named items with a `cure` in `content/named.json`). The Saint's Hand (a severed or mangled arm), the Clockwork Leg (a severed leg or shattered pelvis), the Seer's Eye (blindness or a lost eye; leaves the `hollow_eyes` look), Lethe Water (a shattered mind or the Thrall of the Rift) and the Surgeon's Kit (any one lasting Moderate result). The Nest won in Year 15 puts one of each into the haul, so the Houses draft them.
- **Readings**:
  - A cure is a named item on a charm base that cannot be worn, so the draft, deals, auctions and the Relics score all handle it as they do any Relic. Unlike other named items, it can be made more than once a campaign.
  - It is spent with a new Settlement Phase move, `cure` (item, person, optional injury), on any of the House's own who are at home: its Scions, Retired and Wards it hosts. Without a named injury it mends the oldest one it can. Bots spend a cure as soon as one of theirs needs it.
  - The Seer's Eye also mends a lost eye, and the Saint's Hand a mangled hand, since both are the same kind of wound. Lethe Water mends only the two Devastating sanity results.
  - Events and bosses that reward a cure come with the event fill; the `cure` field on a named item is all they need.

## 2026-11-02 (implementation, Milestone 7i: the great Arcana's Hunts) — implementer
- **Built** (§14.9, `arcanaHuntFor` and `huntArcana` in `arcana.ts`, numbers in `tuning.arcana`). The Tower, Death and the World carry a Hunt card of their own: a card the Gate deals in their boss's pool at level 8 or higher becomes that Arcana's Hunt 35% of the time, while it is unmet. The Arcana is the card's boss, shown on the Gate. Setting out meets it for the campaign (no Arcana node on the same chain); the kill marks a bearer of that Tarot with its trait and drops its Relic, as at a node.
- **Readings**:
  - The Hunt is dealt in the boss's pool whatever cards that pool usually deals (the Barrows deal no Hunts; Death's is the exception). Never on a Rescue, mandatory or forced card, and not on a card that already ends at an Idol.
  - It is fought as a boss at the card's level, like an Idol. A lost fight still uses the Arcana up, as a node does.

## 2026-11-02 (implementation, Milestone 7h: the last eight Arcana) — implementer
- **Built** (§14.9, content only). All 22 Major Arcana now have a node; a test checks the list against the Tarot.
  - Wheel of Fortune: the Temporal Snail (Outer Dark), slows and Stops everyone, hastens itself; trait Wheel-Turned, Relic the Clockwork Shell
  - Justice: the Lady of the Scales (Apostate Court), counters and reflects, sentences the marked; Even-Handed, the Feather Blade
  - the Hanged Man: the Hanged Shadow (Barrows), roots, confuses and drains Sanity; Seen from Below, the Gallows Cord
  - Temperance: the Undine (Drowned Marches, 2×2), freezes and burns together; Tempered, the Mixing Cups
  - the Devil: the Smiling Devil (Pit), charms and hexes the strongest, hellfire; Unsigned, the Devil's Fork
  - the Star: the Willbound Star (Outer Dark), starfall, blinding, hides to heal; Starlit, the Fallen Star
  - Judgement: the Last Trumpeter (Shrine of Six), a trumpet that deafens all, rises when hurt; Answered, the Last Trumpet
  - the World: Gaia, the World Mother (Dragon Reaches), slow and huge; Worldwalker (+1 passive budget), the World's Mantle
- **Readings**: SPEC's table names Maat and Mephistopheles; the bosses carry titles (the Lady of the Scales, the Smiling Devil) as the Idols do, and Gaia keeps her name (a Greek figure, like Thanatos). Every boss is won 100% by the simulator's party at levels 3, 6 and 8, losing 10–32% of HP. The Arcana Hunt cards for the Tower, Death and the World come next, as their own step.

## 2026-11-02 (implementation, Milestone 7g: eight more Arcana) — implementer
- **Built** (§14.9, content only: `content/arcana.json`, eight `content/bosses/arcana_*.json`, eight traits, eight named Relics). Fourteen of the 22 Major Arcana now have a mini-boss:
  - the High Priestess: the Veiled Priestess (Shrine of Six), silences and tides; trait Veiled Sight, Relic the Priestess's Veil
  - the Empress: the Empress of Thorns (Hollow Wood), roots, bleeds and a sleeping blossom storm; Thornblood, the Thorn Crown
  - the Emperor: the Iron Emperor (Apostate Court), marks the strongest and marches on every Front; Imperial Bearing, the Iron Sceptre
  - the Hierophant: the Calamity Priest (Faceless City), Sanity sermons; Heretic's Ear, the Calamity Bell
  - the Lovers: the Twin Tempters (Faceless City), charm the strongest; Heartwhole (Charm immune), the Twin Rings
  - the Chariot: the Siege Chariot (Forge Ruins), charges down the densest row; Unstoppable, the Iron Wheel
  - Strength: the Hero of Labors (Beast Lands), steels himself and shakes the ground; Laborer, the Lion's Hide
  - the Hermit: the Floating Monk (Deep Cold), hides, heals and Stops a row; Lanternbearer, the Hermit's Lantern
- **Reading**: each Arcana's trait is a small edge (a resist, a few % of a stat), the size of a common trait's, because it is earned once and kept for life. All eight bosses are won 100% by the simulator's party at levels 3, 6 and 8 (60 battles each), losing 6–38% of HP.

## 2026-11-02 (implementation, Milestone 7f: Idols, the first three) — implementer
- **Built** (§14.9, `idols.ts`, content `content/idols.json`, numbers in `tuning.idol`). Three Idols, each with a two-phase boss tagged `idol`, an offer event (pool `idol`, never drawn by chance) and a Lore artifact Relic:
  - the Thunderer (Shrine of Six)
  - the Lord Below (Barrows)
  - the Weigher of Hearts (Barrows)
- **How an Idol is met**: a Pilgrimage card of level 6+ ends at one of its pool's unmet Idols 60% of the time. The Idol is the card's boss, so the Gate shows it, and its offer is the node just before it.
- **Readings**:
  - The offer has three answers:
    - **Kneel**: pay the price (Sanity) for the blessing. The kneeling Houses lose Renown, and the expedition ends in triumph with the Idol unfought.
    - **Refuse**: the Idol is the boss.
    - **Take the gift and refuse the price**: the Leader's gamble, and a fight either way.
  - Killing an Idol pays each House in the party 10 Valor and 6 Renown. Renown stands in for Piety until Q92 is answered.
  - An Idol is met once a campaign. Bots kneel (the cautious option).
- **Not yet**: the other three Idols (Q93).

## 2026-11-02 (implementation, Milestone 7e: Arcana nodes, the first six) — implementer
- **Built** (§14.9, `arcana.ts`, content `content/arcana.json`, numbers in `tuning.arcana`):
  - Six of the 22 Arcana, each with its boss, the trait it grants and its Relic: the Fool, the Magician, Death, the Tower, the Moon and the Sun.
  - The Tower is the Stone Colossus, the forge's existing boss. Its Relic, the Tower Stone, also falls the first time it is beaten as the Forge Ruins boss.
  - Five new two-phase bosses, tagged `arcana`, which never end a card as a pool's boss.
  - Six new traits, weight 0 and so gained only from an Arcana kill.
  - Six new named Relics; the named item count is now 32.
- **Readings**:
  - When the chain is rolled at departure, it holds an Arcana node 30% of the time if a Scion of a still-unmet Arcana is in the party (that Arcana). Otherwise the chance is 6%, for any unmet Arcana.
  - An Arcana is met once a campaign, whether the party wins or not. It is never met on a mandatory or forced card.
  - The node sits at a random place before the boss. It is fought as a boss at the card's level, without the +1 a card's boss gets ("elite-tier").
  - On the kill, every bearer of that Tarot still marching gains the trait, and the Relic goes into the haul (lost on a wipe).
  - The spec's "that Scion is the subject of the node's event" is read as the trait reward for now. A pre-fight event per Arcana can come with the event fill.
- Chains now take their raid and Arcana rolls from the same random stream as the rest of the chain.
- **Not yet**: the other 16 Arcana, and Hunt cards of their own for the Tower, Death and the World at level 8+.

## 2026-11-02 (implementation, Milestone 7d: Hunt quarries and the bestiary) — implementer
- **Built** (§14.9, `hunt.ts`, content `content/quarries.json`, numbers in `tuning.hunt`):
  - Eighteen named quarries, three for each pool that deals Hunt cards.
  - A Hunt card names one of its pool's living quarries, nearest the card's level, and one Encounter of its chain becomes the quarry's **Lair**. If the chain has no Encounter, the Lair goes before the boss.
  - In the Lair, the quarry leads a normal Encounter of its kin. It is a level up, with 150% HP, and has one trick:
    - Enrage: it starts enraged.
    - Ambush: the Lair opens with an ambush.
    - Call the Pack: two more fodder join.
  - The trophy is Valor for each House in the party, plus materials into the haul (lost on a wipe like the rest).
  - A slain quarry is never named again that campaign.
- **Bestiary**: kills by enemy id for the whole campaign, open to every House in `view`, with each slain quarry beside the Houses that took it.
  - **Reading**: the first kill of an enemy, by anyone, is a new entry and gives 1 Lore to each House in that fight (§3.4: bestiary entries score Lore).
  - Weakness and pattern after 3 kills is the screens' job, from the counts.
- **Not yet**: the Seat cosmetic for a trophy; dragons as Dragon Reaches quarries use the pool's Dragon and Dark Wyrm, not the named-boss dragons; Arcana Hunt cards (7e).

## 2026-11-02 (implementation, Milestone 7c: Dark Bargains) — implementer
- **Built** (§14.7a, `bargains.ts`, content `content/bargains.json`, numbers in `tuning.bargain`):
  - Eleven offers: nine at Omens, two from the Crown.
  - A House is offered one at Omens 8% of Years from Year 2, at most twice a campaign, so about 1.5 each. Pious and Ink-and-Seal Houses are offered half as often.
  - Each House gets a Crown offer when the Cursed King kneels (the Year 10 assault won).
  - A `bargain` move accepts or refuses. A bane names a rival House. Whatever is unanswered at the seal fades, refused.
  - Bots always refuse.
- **Readings**:
  - The price is paid on accepting, whatever then comes.
  - The hidden roll is 60% as promised, 25% nothing, 15% twisted. A twisted boon comes at half (an item one tier lower). A twisted bane strikes the bargainer's own House.
  - Demon-Blooded, Cursed Line and Old Blood of Kings move 15 points from "nothing" to "as promised".
  - Grudge-Holders' banes are 1.5× as strong.
  - A bane's victim reads only the offer's `misfortune` line (ruined buildings still show on the Town Map as any damage does). The bargainer reads the same line whether the bane struck or came to nothing, so neither House can be sure.
  - A Watchtower at L3 has a 25% chance to hear that some House struck a bargain, never which.
  - Pact marks: 50% on Omens offers and 75% on the Crown's. Each mark takes 25% of the kingdom's mean Ascendancy off the House's final score, which is about one Standing tier. Marks are shown to everyone only once the campaign is over.
  - Pious Houses do not lose Piety yet, since no Piety track exists.
- **Not yet**:
  - The Year 20 bargain (*The Gate's Reflection*, always marked) needs a step after the final assault and before the score.
  - Expedition `house_private` bargains (the Idol, the Sealed Card, the Mi-go) come with their events.
  - Some banes wait on systems that do not exist yet: illness for a Year, and a halved Crisis pledge.

## 2026-11-02 (implementation, Milestone 7b: the mandatory arc's stakes) — implementer
- **Built** (§14.7, `arc.ts`, numbers in `tuning.arc`):
  - Year 5 won: the Bastion of the Gate can be built (`unlockedBy` on a project). Before then the Commons cannot fund it.
  - Year 10 lost: every later expedition's chain gains one `raid` node before its boss, an Encounter drawn from the Apostate Court.
  - Year 15 lost: the Devastation adds Doom 40 instead of 25 (Walls still soften it), and the Outer Dark's fodder and swarms join every other pool's fights, Sorties included. Year 15 won: Doom −20.
- **Readings**:
  - "Doom +40" replaces the Devastation's own Doom; it does not add to it.
  - The Bastion's shield is on every Scion at the start of **each** battle of the final assault, 20% of their HP.
  - Its "one free retreat" is read as: once, a lost battle of the final assault does not wipe the party. It falls back, makes camp, and goes on; a boss that beat it waits to be fought again. (The final assault cannot turn back, so a plain retreat would be no use.)
- **Not yet**:
  - The Year 15 win's cure items wait for cure items themselves (§11.2), which do not exist yet.
  - The Crown's Dark Bargain waits for Milestone 7c.
  - The Throne cosmetic waits for the screens.

## 2026-11-02 (implementation, Milestone 7a: named items) — implementer
- **Content**: `content/named.json` (schema `schemas/named.schema.json`) holds 26 named items so far, toward the ≥120 of HANDOFF §6: the arc's three (the Gatebreaker's Horn from the Siege Beast, the Crown from the Cursed King, the Mother's Cord from the Unknown Mother), one for each of nine bosses, and at least one hidden in every pool. Each is a base with fixed properties (§13.4), Relic tier, at the level found or its own minimum.
- **Readings**:
  - A named item exists once a campaign. It is marked made (flag `named_<id>`) when it is minted, so a haul lost on a wipe loses it for good.
  - A boss drops its own named item the first time it falls (`bossLoot`), on top of the usual haul.
  - A Fine-or-better find (Cache or haul) is one of the pool's unmade named items `loot.namedPct` (15%) of the time, once the expedition's level reaches the item's minimum.
  - An artifact (an item with a `score` line) adds its points to that category for the House holding it, on top of what it scores as a Relic (§3.4).

## 2026-11-02 (implementation, tuning pass 3: the middle Years) — implementer
- **Seen**: after pass 2, bot campaigns still fell at the mandatory Years 5 and 10. The best Scions stood near 2.5L there, not the 3L reference, and an 8-Scion mandatory party is half fresh promotions.
- **Knobs**:
  - `enemies.soften` now runs through every level: 0.5, 0.55, 0.6, 0.65, 0.7, 0.7, 0.75, 0.75, 0.8, 0.8 at L1–10.
  - Base XP is 40 a battle and 150 an expedition (catch-up stays +50% a level below 3L).
  - Bots send no Sortie of fewer than two Scions (`sortie.botMin`); a lone Scion rests instead.
- **Campaign simulator**: `npm run sim:campaign -- [--houses H] [--runs N] [--seed S] [--short] [--each]` plays whole bot campaigns. It reports how they ended, expeditions by result (mandatory ones apart), and the best four Scions' average level by Year.
- **Result**, 27 bot campaigns from 1 to 4 Houses: 5 won (none before). About half of all expeditions triumph. The best Scions average about 9 at Year 5, 14–21 at Year 10 and 14–25 at Year 15, which is about §6.6's "20–30 by Year 20" for those who live. The usual loss now is the Year 20 assault on the rift, then Doom at Year 15 or Accord. Bots are cautious and never play battles by hand, so people should do better. Numbers to revisit when battles are playable.

## 2026-11-02 (implementation, tuning pass 2: the first Years) — implementer
- **Seen**: bot parties of level-1 Scions lost most L1 fights the simulator said they win. The simulator's party is level 3L with Fine gear and spent JP; the campaign's had Crude gear, no abilities, and a Vagabond or Gambler starting with a knife in the Back line, where it cannot reach and only Defends.
- **Starting kit**: each Job names its `starter` weapon in `jobs.json` (a Vagabond's bow, a Gambler's crossbow, a Minstrel's instrument). New Scions, at founding or promotion, start with `progression.startJp` (150) JP in their Job, enough for a first ability or two. Reading: §6.5 is silent on starting JP.
- **Softer first levels**: enemy HP and damage × `enemies.soften` (0.5, 0.6, 0.7, 0.8, 0.9 at L1–5, then 1), bosses included. Starting Scions are level 1 (§6.2), and the 3L reference (§14.2) would expect level 3 at L1. The §14.2 formulas are unchanged; this multiplier comes after them.
- **Catch-up XP** (FFT-like): battle and expedition XP gain `progression.catchUpPct` (50%) for each level a Scion stands below 3L. Base XP raised to 25 a battle and 100 an expedition. Training's reference stays 135.
- **The Rift Gate** always offers one card for 4 at the bottom of the Year's band (`gate.floorCard`).
- **Bot judgment**:
  - The bot picks the card nearest the level its Scions can take, ⌊(best Scions' average level + 2) ÷ 3⌋, with a card above that counting double. It goes after its own Lost only when that card is not above its level.
  - The bot Leader turns back only when half the party is out or has two or more broken locations, or a Scion's Sanity is nearly gone.
- **Items** handed out later (loot, shop lots, auctions) are filed in id order, as a save restores them.
- **Result** in bot campaigns (8 two-House, 4 one-House, 4 four-House): about 40% of expeditions triumph (was 10%). The best Scions average level 6–7 by Year 5 (was 1). Campaigns still fall around Year 14–15: the mandatory Years 5 and 10 are a cliff, and bots don't train or send proper Sorties. One two-House campaign reached Year 20 with Scions near level 26. These come next.

## 2026-11-02 (implementation, tuning pass 1: readying Scions in town) — implementer
- **Why**: in two-House bot campaigns every Scion was still level 1 in Year 15 and the city fell. Four causes: Houses had no move to spend JP or put on gear, so loot sat in the stash and JP piled up unspent; bots chased their own Lost on Rescue cards above their level; bots turned back after one battle; and bosses at the end of a chain beat parties already worn down. This PR fixes the first; the rest follow.
- **Readying moves** (§12.1, §13.1, `outfit.ts`), Settlement Phase only and not once sealed (on an expedition Jobs, passives and gear are locked, §9.2): `learn` (an ability of the primary Job, paid in its JP), `take_job`, `secondary` (or none), `passive` on/off within the budget, `equip`, `unequip`. A House readies its own Scions and the Wards it hosts, Retired ones included.
- **Readings**: changing Job sends gear the new Job may not wear back to the stash. A cursed item will not come off and cannot be equipped over (§13.5). Abilities whose system is not built yet can still be bought (they count towards mastery) but do nothing yet; bots skip them.
- **The bot** buys the cheapest ability it can afford (actives first at a price), equips bought passives while the budget allows, takes a secondary set when it has one, and wears the best stashed item in each slot it fits (tier, then item level).
- **Simulator**: `npm run sim -- --scion N` (or `3L-2`) fights at a chosen Scion level instead of 3L, and `--curve` prints win rates by Scion level and expedition level.

## 2026-11-02 (implementation, Milestone 6n: 2×4 expeditions) — implementer
- **Two parties** (§9.3, `split.ts`): at departure a 2×4 card's eight are dealt into two parties of four by House, so a House with two or more Scions is in both. The voted Leader's party walks first and the Leader is the expedition's. Reading: the other party's Leader is its most travelled Scion, with no second vote, to keep the phase short.
- **The ways**: each party rolls its own chain of N nodes (§9.3's N), with a **Gate** halfway and the **meeting place** at the end. The boss comes after, fought by everyone left.
- **The Gates** (reading of "the lever on the far side"): the first party's Gate opens once the second party reaches its own Gate; the second's opens once the first is through. A party at a sealed Gate waits, and control passes, so the parties alternate A, B, A, B. A party at the meeting place waits for the other. A Gate never waits on a party that is gone or already at the meeting place.
- **One party at a time**: the walking party is the one events, battles, Camps and Caches happen to. Reading: a leader-targeted event picks the walking party's Leader, since the first-named may be on the other way.
- **Turning back or falling** ends only that party. The fallen follow §9.9 (half Lost); the ones who turned back go home and still draft the haul if the expedition brings it home. The other party goes on alone. With both gone, the expedition ends as turned back if either party did, else wiped.
- **Events**: a Fork never drops a Gate and a skip never passes one.
- **Not built**: the full 3×8 grid for the united boss fight (the eight line up in their Job columns as an 8-card does).

## 2026-11-02 (Barrow Knight) — Josh
- The Change first written as the Hollow Knight is the **Barrow Knight** (`barrow_knight`): "Hollow Knight" is another game's name. → GLOSSARY, SPEC §9.6–9.7

## 2026-11-02 (implementation, Milestone 6m: forced expeditions) — implementer
- **Forcing events** (§3.2) are town events with `forces: { pool, size? }`: The Raiders' Nest (the Beast Lands), The Taken Child (the Hollow Wood), The Sick Well (the Drowned Marches). They are never drawn in the Omens. Reading, so that the Watchtower can foreshadow one a Year ahead: each Year there is a 10% chance (`tuning.gate.forced.pct`, first pass) that one is queued, hidden, on the timeline for the next Year. The Watchtower reads hidden entries, so its House sees which event is coming; everyone else sees "?" for that Year.
- **Limits**: at most two a campaign, each forcing event at most once, never for a Year before Year 3, a mandatory Year, or past the end. A forcing event due goes ahead of any other event due in the same Year, so it never slips.
- **The forced Year**: the forcing event opens in the Omens like any settlement event (a vote on how the town prepares). The Rift Gate offers only its card: type `forced`, its pool, a level in both the Year's band and the pool's range, 4 Scions unless the event says 8.
- **Failure**: turning back, a wipe, or no one going counts as failing it. That is the lesser Devastation already in `devastate(s, "forced")`: one building ruined, Accord (or Unrest) −10, Doom +10. Bots never turn back from one, as with a mandatory card.
- **Seen in play**: 12 two-House bot campaigns met 5 forced expeditions and failed 4 of them. That is the known early-wipe problem, left for the tuning pass.

## 2026-11-02 (implementation, Milestone 6l: Changes) — implementer
- **Changes** (§9.6, `content/changes.json`): Barrow Knight, Marsh Thing, Seraph Husk and Wyrmling. A Change's stats are its level-1 numbers grown by its own growths to the Scion's level. It wipes the Scion's traits (blessings too), injuries and look, and keeps name, House, Tarot, level, JP, learned Jobs and Loyalty.
- **What a Change can do**, all data:
  - `mods` ride into battle like a trait's (wards, immunities, Poisoning attackers, Regen, one-cell moves, Fire attacks, claws);
  - `job` fixes the Job (the Barrow Knight is a Knight and can take no other);
  - `slots` are the gear slots left (a Wyrmling has no hands; the Barrow Knight's armor is its own head, body, arms and legs);
  - `barred` Year assignments (the Barrow Knight and the Wyrmling cannot use the Chapel);
  - `upkeep` paid from the host House's Stores at each Reckoning. Short of it, the Scion loses 25% of their Sanity ceiling (`tuning.change.hungerSanityPct`, first pass).
- Reading: "no healing from Holy" is a −50% to healing received for the Barrow Knight, because no heal has an element yet. Changes take one cell for now; a two-cell Wyrmling waits for the party's 2×4 grid.
- **The effect** is `change` (an id), not `transform`, after Josh's word. `unchange` gives the old body back. Reading: the old body returns grown by the levels gained while Changed, with its old traits, injuries and Job. A second Change replaces the first, and the body kept is still the one they were born in.
- **Events** can pick a Changed Scion: `scion:changed` and `scion:change:<id>` (§9.6: "some Forms count as a unique Scion").
- **Everyone sees** a Scion's Change (`PersonView.change`); nobody sees the body it replaced.
- New events: The Armor That Walks (the Barrows), The Sinking Mother (the Drowned Marches), The Choir Missing a Voice (the Shrine of Six), The Egg That Hums (the Dragon Reaches), The Unmaking Spring (general; it reverses a Change).
- **Save version 13**: people carry `change` and the body it replaced.

## 2026-11-02 (implementation, Milestone 6k: the Lost and Rescue cards) — implementer
- **The Lost** (§9.9): a Scion left behind (a wipe, or a `scion_lost` effect) carries `lost`: the Year, and the pool and level of the expedition that left them.
- **Rescue cards**: from the next Year, the Rift Gate adds a Rescue card for each place Scions were Lost, beside its usual 2–3 cards. A Rescue card is size 4, at that pool and level, and holds all the Scions Lost there. Mandatory Years offer only the arc's card. A won Rescue brings them home as Scions, still without the gear they lost. A bot House votes for the card that holds its own Lost.
- **The death clock**: a Lost Scion not found by the second Reckoning after they were left is counted among the dead in their House's Chronicle (cause "lost"). Reading: Rescue cards come in the two Years between.
- **Save version 12**: people carry `blessed` (6h) and `lost`, and the history counters gained `retired`.
- **Change** (Josh, 2026-11-02): a Scion's permanent transformation is a Change; Form stays the Alterer's word. → GLOSSARY

## 2026-11-02 (implementation, Milestone 6j: Sorties) — implementer
- **Sorties** (§6.11) are a Year assignment, `sortie`, with the Sortie's id (`content/sorties.json`). Four are written, from §6.11's list: Patrol the walls, Hunt the marsh, Escort a caravan, Dig the old mine.
  - Each House runs one Sortie a Year, with up to four Scions or Retired. Recruits do not go.
  - A Scion fielded on the expedition goes there instead of on the Sortie.
- **When**: reading, every House's Sortie resolves as the expedition comes home, before the Reckoning.
- **The fights**: 1–2 gambit battles from the Sortie's pool, a level under the Year's band (`tuning.sortie`). Injuries are capped at Moderate: a worse roll lands on the table's next milder result (`Battle.injuryCap`), so nobody dies on a Sortie. A lost battle ends it, and the Scions limp home.
- **Rewards** (about a quarter of an expedition):
  - XP per battle won;
  - 25 JP for each Scion if every battle is won;
  - the pool's finds to the House per battle won;
  - some Gold or Valor by Sortie.
- **Bots**: a bot Scion with no training slot and no injury goes on Patrol the walls.
- **Not built yet**: per-Scion gambit lists (Sortie Scions fight with their Job's default gambits, as expedition battles do), the Arena's +50% and Mild cap, the Kennels' beasts, and injuries that forbid Sorties.

## 2026-11-02 (implementation, Milestone 6i: secret events) — implementer
- **`secret`** (§9.4, Q91): an event whose options are all `secret` is put to the Houses present. Each picks unseen: the view shows another House's pick only as chosen (−2) until every pick is in.
- At the reveal, the log names every House's choice. Each pick then happens to that House's own Scions in the party, its finds to that House.
- An outcome may carry `when`: `{ "any": option }` (another House picked it) or `{ "none": option }` (no other House did). Only the fitting outcomes are drawn from; if none fits, the plain ones are.
- New events: the Hoard in the Hollow, the Informer's Offer.

## 2026-11-02 (treasure as a pool of shares) — Josh
- **Treasure goes to one pool and Houses claim "shares" of it**: gear, a resource or an artifact, in a randomized House order. This replaces 6e's even split of materials (remainder to the Commons) and its lowest-Standing-first order. → SPEC §9.10, GLOSSARY "Draft"
- Implementer's reading: each item is one share, and each material is split into one bundle per drafting House (fewer when there is too little). The order is random, then snakes back as before, so no House picks twice running at the turn. The bot takes the share it values most (`tuning.loot.botWorth`). Gear is still drafted blind.

## 2026-11-02 (implementation, Milestone 6h: blessings and House improvements) — implementer
- **`blessing`**: a trait held for a time. The trait is added as any trait is, and `Person.blessed` counts the Reckonings it has left: `years: 1` lasts through the next Year and fades at its Reckoning. A trait already held is not blessed again. Gaining the same trait for good makes it stay.
- **`house_improvement`**:
  - `recruit` gives the subject's House a recruit.
  - `building` raises one of its built buildings a level, below the top.
  - `shop` raises one built Commons shop a tier, for everyone, up to 3.
  - Reading: when the party chose together, the recruit or building goes to a random House present (as town effects do with no subject House).
- New events: the Child in the Well, the Roadside Shrine, the Lost Caravan.

## 2026-11-02 (implementation, Milestone 6g: each Scion's choice and Forks) — implementer
- **`each_scion`** (§9.4): an event whose options are all `each_scion` is put to every Scion in the party. Their House picks for each of them, and nothing resolves until every pick is in. Then each Scion meets the outcome of their own pick, drawn for them alone. The `decide` move carries the Scion's id.
- **Forks** (§9.3): a `fork` effect passes by the next `drop` places and puts `add` places next. It never touches the boss, and the way ahead stays hidden. New events: the Mirror Pool (each Scion), the Twins, the Rift Scar and the Hidden Trapdoor (Forks).
- `secret` events wait on Q91.

## 2026-11-02 (implementation, Milestone 6f: the rest of the event rules and lasting effects) — implementer
- **Rules added** (`events.ts`):
  - `scion:heaviest_gear` (gear weight), `scion:most_open_slots`, `scion:tarot:<card>`, `scion:trait:<tag>` (a trait id or tag), `scion:injured:<location|any>` and `scion:retired_once`.
  - `house:trait:<tag>` and `house:random`.
- Reading: a rule that may fit nobody can name a fallback, `a|b` ("scion:injured:arms|scion:lowest:might", the Altar of Hands' "else lowest Might"). When nothing fits, the whole party is the subject, as §9.4 says for `trait`. Ties go to the first fielded. `retired_once` reads a new history counter that retiring adds to.
- **Effects added:**
  - `stat` (permanent base) and `growth` (hundredths; `all` is every stat but Speed).
  - `trait` (`+id` / `-id`; a gained trait replaces one of its group), `curse` (a random trait tagged cursed) and `tarot` (redrawn, and no longer reversed).
  - `status` (an ailment on the subject at the start of the next battle only), `loyalty` (Wards only), `scion_lost` (as in a wipe).
  - `item` (a found item of a tier: to the subject's House, into the draft when the party is the subject) and `timeline` (a town event queued N Years on, for the subject's House).
- Still to come: `each_scion` and `secret` events, Forks, `blessing` (timed traits), `transform`, `house_improvement`.
- 11 new events from §9.7's list and in its spirit (23 in all).

## 2026-11-02 (implementation, Milestone 6e: loot and the draft) — implementer
- **The haul** (`loot.ts`): everything found on the way (Encounter drops, Caches, the boss) rides home with the party and is shared out when it comes home, won or turned back (§9.9: "returns with everything carried so far"). A wipe loses it. Event finds still land at once, by §9.10's subject rule.
- **Drop tables** are per pool (`content/pools.json` `drops`, first pass): each material's % per roll and Essence's. A won Encounter rolls once and has a 10% chance of an item (Common, Fine at 20% + 5% × level). Common materials come 1 + level/3 at a time, Essence 1 + level/4, rare materials one.
- **Caches**: 1–2 items, Fine or Masterwork (5% × level), and two rolls on the table. Reading: one Cache in six is trapped, and until the Mimic has its enemy entry a trap is an ambush a level above the card; the party gets the Cache only if it wins.
- **Bosses**: one Masterwork item per House still in the party plus one, and three rolls on the table. Relics wait for named-item content.
- **Sharing out**: materials split evenly between the Houses with a Scion still in the party, the remainder to the Commons (§9.10). Reading: "a House with no Scion on the expedition does not draft" counts the Scions still marching at the end, so a House whose Scions all died or were Lost drafts nothing.
- **The draft**: lowest Standing tier first, ties at random, snake order, one pick per item until the haul is gone. Alone, a House takes everything. Found items are drafted **blind** (§13.4): the view hides their properties, showing base and tier only, until Identify exists with the Scriptorium. The bot takes the highest tier, preferring something one of its Scions can wear.
- Card completion rewards by type (Resource, Delve, Hunt…) are not built yet.

## 2026-11-02 (Q90 answered) — Josh
- **Who picks an expedition event's option: the party votes; the option's rule names who it happens to.** Every House with someone in the party votes. A tie goes to the Leader's House.
- **Only settlement ties cost Accord; expedition ties do not** (Josh, same day). Reading: settlement ties are votes in the Settlement Phase (Commons votes, town events, the Rift Gate's card) and keep −3. Expedition Phase ties are free: event options go to the Leader's House, the Leader vote to the most travelled Scion. → SPEC §8.1, §9.2, §9.4 The rule (`leader`, `scion:most_expeditions`, `house:lowest_standing`…) chooses the subject: the Scion or House the effects fall on. `each_scion` and `secret` events keep their own way of choosing. → SPEC §9.4

## 2026-11-02 (implementation, Milestone 6d: expedition events) — implementer
- **The engine** (`events.ts`, content under `content/expedition/`, `schemas/expedition.schema.json`):
  - An Event node draws an event in its level band whose requirements hold, never one met already this expedition. Half the time it comes from the card's own pools (its pool id or its type), else from the general pool.
  - The Houses present vote, per Q90. The outcome is drawn by weight.
- **Rules built:** `vote` (the whole party), `leader`, `scion:random`, `scion:most|fewest_expeditions|kills|healing|targeted`, `scion:highest|lowest:<stat or sanity>`, `house:lowest|highest_standing` (by Ascendancy; that House's Scions in the party are the subject). Ties among Scions go to the first fielded. Still to come: `each_scion`, `secret`, `scion:heaviest_gear|most_open_slots|tarot|trait|injured|retired_once`, `house:trait`.
- **Effects built:**
  - Sanity, Durability and MP as % of max; Durability can be on one location, and 0 Breaks it.
  - XP and JP.
  - A forced injury roll: a lasting result stays; Death or a Mortal wound kills, since there is no battle end to wait for.
  - Resources and score: to the subject's House, or to the Commons (resources) and every House present (score) when the whole party is the subject (§9.10).
  - Accord, Doom, flags.
  - `skip` (passes nodes, never the boss), `encounter` (a battle now, optionally Ambush/Surprise or levels up), `retreat`.
  - Still to come: status, stat, growth, trait, tarot, blessing, curse, transform, item, house_improvement, loyalty, fork, timeline, scion_lost.
- **Content:** 12 events, mostly from §9.7's table. Each option is tagged for balancing. A Leader killed by an event is replaced as in battle; a party killed to the last Scion is wiped.
- **Bots** choose a `cautious` option where there is one, else the first.
- **A Crisis's "the next expedition must wait"** (`expedition_delayed`, Milestone 4e) now keeps the Rift Gate shut for the Year, and the flag is spent.
- **Tuning waits for events and loot.** 45% of nodes are events, and they will heal, pay XP and give gear. So the level-curve pass from 6c comes after loot (6e), not before.

## 2026-11-02 (implementation, Milestone 6c: the chain, walked) — implementer
- **The chain** (`journey.ts`, §9.3): rolled at departure, N = 4 + level/2 nodes (+2 mandatory) by the decided weights, then the boss. The view shows only the nodes passed and the chain's length.
- **Walking it:** the Leader's House presses on (`press_on`) or turns back (`retreat`, any node but the boss). A Leader who dies or is Lost is replaced by the most travelled Scion still marching. Reading: §9.9's "vote if the Leader is incapacitated" is left for when battles are played by hand.
- **Battles are fought by gambits for now** (the simulator's `decide`), on both sides; playing them by hand is a later step of this milestone. Party layout: each Scion in their Job's column. HP refills between battles; Durability, Broken locations, Sanity, MP and this-expedition injury effects carry (§7.3: "they carry across the expedition, like MP"). Lasting injuries go on the person with their Years; the dead leave their House for its Chronicle (the birth House's), their gear in the host's stash; a Catatonic Scion sits out the rest of the expedition.
- **Rewards so far:** every battle won pays the survivors `battleXp`/`battleJp`, the finish `expeditionXp`/`expeditionJp` (§6.6, §12.1 numbers). Valor (first pass, `tuning.journey.valor`): +1 per Scion per battle won, +5 per Scion for the boss, through `creditWard` so Wards share it; a retreat costs each House present 3 Valor.
- **Coming home** (§9.9): turned back keeps what was carried; a wipe leaves each surviving Scion Lost at 50% (the Rescue card and the two-Year death clock come with Rescues). A mandatory card that is retreated from, wiped or left unmanned is failed: Devastation; Year 20's ends the campaign.
- **Bosses:** the arc's for mandatory cards; otherwise a boss of the card's pool within 2 levels of it (not the arc's, not a later form). Reading: a pool with no boss near the level ends in an Encounter a level above the card's.
- **Encounter levels:** a pool fields its own enemies at the nearest level it has, scaled to the fight's level (reading: the Pit has no L3 enemies, but Year 5's Tide at the Walls is a Pit warband at L3).
- **Events and Caches are passed through** with a line in the log until the event engine (6d) and loot (6e) exist.
- **Bots:** the Gate vote takes the lowest-level card the Houses' Scions could fill; the Leader turns back once a Scion is lost, Broken, or under 15 Sanity, never from a mandatory card.
- **Simulator finding (to tune next):** with the decided starting numbers, bot Houses are wiped out. Starting Scions are level 1, and §14.2 expects level 3L. A level-1 party wins about 100% of L1 encounters, about 90% at L2 and about 45% at L3. The Year 1–4 band reaches L3, and Year 5's mandatory card is L3. Parties wipe before they earn XP, and training cannot raise anyone above the House's best minus 3, so no one levels. Bot campaigns end in Years 10–15. Tests of the settlement bots now run with the Gate shut (`ashore` in testing.ts). The next PR is a tuning pass on this curve.

## 2026-11-02 (implementation, Milestone 6b: the party and its Leader) — implementer
- **The Expedition Phase now waits on the Houses** (`expedition.ts`, §9.2). At the seal the chosen card's seats (4, or 8 for an 8 or 2×4 card) are shared among the Houses with able Scions: equally, the spare seats to the House with the fewest expeditions attended (`House.attended`), then by a rotation that moves each Year. Reading: "8 seats: double" means equal shares doubled, so three Houses on an 8-card get 3/3/2, not 4/2/2. No House gets more seats than it has able Scions; the rest pass on in the same order.
- **Fielding** (`field {people}`): each House names its own Scions (a Ward counts as its host's). Naming fewer declines the rest; declined seats pass to the Houses that filled theirs and have Scions to spare, who are asked again; a House that declined is not offered more. Reading: only Scions are fielded; a Retired Scion is reinstated in the Settlement Phase first (§6.12 says Retired are freely fieldable, and reinstating costs nothing).
- **Seats left empty.** §9.2 says the card cannot depart and the Houses choose another. Reading for now: the card does not depart and no expedition goes that Year (a second Gate vote can come later if play wants it). A mandatory card departs with whoever came.
- **The Leader** (`lead {person}`): every House votes, in the open, for a Scion in the party. A tie costs Accord −3 and goes to the Scion with the most expeditions (then the oldest record). One Scion, or one House, needs no vote. The Leader's House gains Renown (`tuning.expedition.leaderRenown`, first pass 2), the Leader's `led` count rises, and every Scion in the party counts an expedition.
- **Bots** field their highest-level Scions (fewest injuries first among equals) and vote for their own best Scion in the party.
- **Tests' still Years:** `calm` (testing.ts) also shuts the Rift Gate, so economy tests don't stop for a muster; `sealYear` seals and lets the bots field and vote.
- **Not yet:** the party goes nowhere. Departure leads straight to the Reckoning; the chain, its nodes and the battles are 6c on. No save change: `expedition` and `attended` are plain state.

## 2026-11-01 (implementation, Milestone 6a: the Rift Gate's cards) — implementer
- **The offer** (`gate.ts`, §9.1): when the Year opens, the Gate deals 2–3 cards (`tuning.gate.cards`) from different pools whose level range meets the Year's band; each card's level is rolled inside both, its type from the pool's own card types, its party size by weight (first pass: 4 at 70%, 8 at 20%, 2×4 at 10%). The short campaign reads its band and arc by Year-of-20, as Crises do.
- **Mandatory Years.** Reading: §9.1 says "plus the mandatory one when due", but a mandatory expedition is do-or-die and only one expedition departs a Year, so in a mandatory Year the Gate offers the arc's card alone and there is no vote. The arc is fixed and in order (§14.7, `tuning.gate.arc`): the Siege Beast (L3, the Pit), the Cursed King (L6, the Barrows), the Unknown Mother (L8) and the End Ruler (L10), each in its boss's pool; both campaign lengths walk it in order. Mandatory cards take 8 Scions (reading: the arc's bosses fill the full grid and the stakes are the whole settlement's).
- **The vote** (`pick_card`, Settlement Phase): open, changeable until the House seals. At the seal the most votes take the card; a tie costs Accord −3 and goes to the card of the highest-Renown House among the tied voters (§9.1); no votes at all take the first card. The view shows the cards and votes to everyone.
- **The bot** votes for the lowest level on offer (cautious, like its combat).
- **Not yet:** nobody departs. The Year's log names the chosen card and the Reckoning follows; seats, the Leader and the chain are 6b on. Forced expeditions, the Observatory's preview and "Houses may pick a card above band" (no above-band cards are dealt yet) come with them. No save change: `gate` is plain state, and a save taken mid-Settlement before this restores with no Gate, which takes no card.

## 2026-11-01 (implementation, Milestone 5g: the Retired and Fallen Houses) — implementer
- **Retire and reinstate** (`lifecycle.ts`, §6.12):
  - `retire` and `reinstate` are free Settlement moves on the House's own people.
  - A Retired Scion's worn gear goes back to the stash, and they pay half upkeep.
  - Reinstating brings a Retired Scion back to Scion, with their injuries.
  - Teaching (Retired or a master as Mentor) was already in Milestone 4's assignments.
  - Forced retirement from a Devastating injury comes with campaign injuries (Milestone 6).
- **Fallen Houses** (§6.13):
  - A House is Fallen with no Scion, recruit or Retired hosted, shown on its public record (`fallen`).
  - Its Lineage is 0, since there is no one to count. It keeps voting, pledging, dealing and building, and a Ward or a recruit event can rebuild it.
  - If every House is Fallen when a mandatory expedition's Year closes, the campaign is lost.
- **Waiting:**
  - Mentor loans in deals and the two-Year trained recruit promoted at level 3 with a Mentor's passive (§6.12, PROPOSED).
  - The Chronicle of the dead and its Lineage. These come with expedition deaths in Milestone 6.

## 2026-11-01 (implementation, Milestone 5f: Wards and Loyalty) — implementer
- **Wards in deals** (`wards.ts`, §6.9): a deal side may list `wards`, Scions of the giving House.
  - On acceptance the Scion moves to the host. Their worn gear stays in the giver's stash, except a cursed piece, which goes with them and becomes the host's (per batch 10: the host outfits Wards, cursed items travel with the Ward).
  - Loyalty starts at 40: 20 if the birth House has Bad Blood, 60 with a Hound-Loyal host.
  - A Ward may not be given back to their birth House within 3 Years. They may be given to a third House only once Sworn, and then keep their Loyalty.
  - Going home ends the wardship.
  - The bot never gives a Ward and values receiving one like 40 Gold.
- **Loyalty** is hidden. Only a host with Insight 3 sees it, in the person's view.
- **The Reckoning's Ward step** (`wardYear`): first-pass numbers in `tuning.wards`.
  - Below 50, a 25% chance each Year (20% less with a Hound-Loyal host) that the birth House reads one secret of the host's in its own notes: exact Gold and Debt, exact Ascendancy, or the size of the recruit pool.
  - A Crisis pledge cannot leak yet, because the Crisis is settled before the Reckoning.
  - At 10 or less, a 50% chance each Year that the Ward slips home, publicly.
  - At 80 or more the Ward is Sworn: no leaks, no split.
- **Score split** (`creditWard`): Valor and Lore a Ward earns go to the host at Loyalty % and to the birth House for the rest. The Expedition Phase calls it in Milestone 6.
- **Waiting on expeditions:** the Year's Loyalty changes (fielded with good gear, saved or injured on the host's expedition, fielded while Retired, withheld in a Crisis). So does the Estranged Ward's one sabotage, a Crisis pledge quietly halved. Hostages (solo) come with events.
- **Save version 11:** a person's `wardSince` is saved.

## 2026-11-01 (implementation, Milestone 5e: promotion and the Tarot) — implementer
- **Promotion** (`promotion.ts`, §6.5, first-pass numbers in `tuning.promotion`): a Settlement move, `promote` (recruit, base Job).
  - It costs 20 Gold and a ceremony slot: one a Year, two with a Chapel.
  - The Scion keeps any level training gave them. Their Tarot becomes visible to everyone, as a Scion's does.
  - Reading: the House outfits a new Scion with plain starting gear (a weapon, body and head armor, as at the start), since the spec has no other way to arm them and a bare Scion is useless.
  - The bot promotes its best recruit (stats plus growths) into the base Job its top stat suits. It does so while it has fewer Scions than its target (8/5/4/4 by House count) and can still pay two Years of upkeep.
- **The Tarot's bonuses** (`content/tarot.json` `mods`, `tarotMods`) ride into battle.
  - The Fool's Evasion, the Magician's MP, the High Priestess's Sanity, the Empress's healing, the Hierophant's Holy, the Chariot's −5 CT a cell, Strength's +2 Might, the Wheel's crit, Justice's counter, the Devil's Dark/Holy, the Star's MP each pulse, the Moon's mental resistance, the Sun's Blind immunity and Holy.
  - The World's +1 passive point goes to the passive budget.
  - Conditional cards wait as text until the systems they name exist: the Emperor, the Lovers, the Hermit, the Hanged Man, Death, Temperance, the Tower and Judgement.
- **Reversed** (Superstitious, 25% at generation): each bonus becomes the same loss, and an immunity becomes nothing.
- Renamed the individual trait Superstitious to **Omen-Watcher** so it does not share a name with the House flaw.

## 2026-11-01 (implementation, Milestone 5d: individual traits) — implementer
- **The trait set** (`content/traits.json`, `schemas/traits.schema.json`): 55 traits.
  - §6.7's 30, counting each listed Curse as its own trait, plus 25 new first-pass ones in the same pattern (Hardy/Frail, Stout-Hearted/Brittle Mind, Keen-Eyed, Cold-Blooded/Tidebound, Stone-Steady/Windborn…), toward the target of 60.
  - Each has flavor and crunch, battle `mods`, event `tags`, a generation `weight`, a `group` and an `element`.
  - Weight 0 means the trait is gained, never rolled: Veteran of the Rift, Touched by the Deep, Grafted, Grit-Marked and the Curses.
  - A `group` keeps opposites apart (never Fleet and Sluggish). An `element` is rolled twice as often for a House aligned with it (§5.6, `tuning.recruits.traits.alignedWeight`).
- **Generation** (`rollTraits`, §6.3): first the House's innate traits by their chance (Fleet of Foot: 30% Fleet; Fae Changeling: 50%), then the table up to 1–3 traits in all (50/35/15%, first pass).
- **In battle** (`carriedMods`) traits add their mods.
  - Readings: "Dual wield penalty removed" is Dual Wield Mastery. Lucky rerolls a miss, like the Lucky property: §6.7 says a failed injury roll, but injury rolls have no failure to reroll yet.
  - Tag-only effects wait on events or later systems: Bleeder, Berserker, Steady, Nightmares, Clumsy, Cruel, the stealth, charm and intimidation options, and the Curses' Withering and Hunger.
- **Tests:**
  - The assignment tests now measure Sanity against `caps` (the ceiling, traits included).
  - The Short-campaign test uses a seed the bots win, since seed 3 now loses its Accord in Year 9. Bots losing a campaign is a legal outcome; tuning will look at it.

## 2026-11-01 (implementation, Milestone 5c: founding the Houses) — implementer
- **A founding phase before Year 1** (`founding.ts`, §5.1).
  - Every seat starts on a themed Random House draft: name and motto, colors, emblem, Seat, element, a valid set of traits, and two Ambitions dealt in secret.
  - The moves are `design` (change any parts, checked against every rule), `random_house` (reroll a step, or the whole House) and `swear` (keep Ambition 0 or 1). `unseal` takes an oath back until the last House swears.
  - When every House has sworn, its starting Scions and recruits are born with its blood, Debt-Ridden takes its debt, and Year 1's Omens open.
  - Bots swear the draft they were dealt and keep the first Ambition; if another House has sworn under their primary color, they reroll their colors first.
- **Trait rules** [DECIDED §5.7]: 2 Majors, 2 Minors, a Major Flaw and a Minor Flaw; or a Bloodline in place of one Major and the Major Flaw. No duplicates. Elemental Bane must name an element, and no other trait may.
  - A Random House takes a Bloodline 25% of the time (`tuning.founding.bloodlinePct`, PROPOSED). Its traits are drawn evenly within each kind; theming traits by element is left for later.
- **Readings:**
  - The ten §5.1 steps are one screen each in the client (Milestone 8). The rules take a whole or partial design in one move, so Back is only the client's.
  - Only sworn Houses reserve a primary color (later pickers see it greyed). A Random House avoids every other draft's color.
  - The profanity filter is Vibe Pulse's, applied at the port (Milestone 9).
  - The look of the line (§5.8) waits on the sprite generator.
  - The theme is a free id of up to 40 letters until the music list exists.
- **Tests:** `calm()` now also strips the Houses' traits and starting debt, so exact-amount tests keep the plain rules' numbers.
- The standalone client shows the draft's traits (Flavor or Crunch), Random House, Reroll traits, and one Swear button per dealt Ambition. Save version stays 10: saves are only taken in the Settlement Phase.

## 2026-11-01 (implementation, Milestone 5b: House traits in the economy) — implementer
- **What the economy reads now** (`econ`, `byPct` in `houses.ts`):
  - Income % moves the House's Gold income only (Deep Coffers +20, Poor Lands −20). Grain income stays as it is, so a poor House is not also starved.
  - Upkeep % moves the Gold upkeep (Thrifty, Gluttonous, Wyrm-Blooded's Treasury upkeep). The bot's upkeep reserve uses the same `upkeepDue`.
  - Debt-Ridden starts with 60 Gold of Debt and pays 10% interest on Debt each Year.
  - Light-Fingered Servants take 5% (rounded up) of every store each Reckoning.
  - Barren rolls for arrivals only in even Years. Many-Branched Tree gets a second roll in even Years. The recruit pool cap moves by `pool` (Old Blood of Kings +1, Bad Blood −1).
  - Haunted Halls raises the House-event chance by 25 points.
  - Patrons of the Guilds pays 10% less at the shops' list price; sealed bids are unchanged.
  - Scholarly pays 20% less for the Scriptorium.
  - Fond of Wine adds 10 points to Sanity recovery in town.
  - Score % moves a category's total, earned and held alike (Old Blood's Lineage, Silver Tongues' Intrigue, Craven Legacy's Valor).
  - Job XP % moves the JP a Scion earns in that Job from training, study and the University ("Job XP" read as JP, since XP is not per Job).
  - Effects on a person (Sanity, JP) follow their birth House. Effects on the treasury follow the House itself.
- **Debts are repaid** (§8.10 step 1, "debts and interest"): after upkeep, the Year's Gold pays down whatever Debt it can, including Debt from unpaid upkeep. Reading: the spec has Debt but no way to clear it, and a House should not carry a debt it could pay.
- **Still waiting:** crafting costs (Forge-Born) until crafting exists; the earlier shop tier, Debt-Ridden's default and the Creditors Call event, Superstitious' reversed Tarot, and innate Fleet, with promotion and individual traits. Save version stays 10.

## 2026-11-01 (implementation, Q89: private House events) — implementer
- **A House event is its House's own** (Josh, Q89: private, with a hint). Only that House sees it among the pending events, and its title and outcome go to the House's own notes (`state.notes`, the viewer's `mine.notes`), not the public log. Everyone else reads "House X has troubles at home." in the log, and on the timeline a House event to come shows its Year and House with "?" for the event. Spectators see only the hints. Readings: what the event does that is public anyway (a damaged building on the Town Map, Accord, Doom) stays visible; a Watchtower or the Observatory does not reveal another House's events, since privacy is a different thing from a hidden entry. Notes, like the log, are not saved; save version stays 10.

## 2026-11-01 (implementation, Milestone 5a: House traits) — implementer
- **The trait set** (`content/house_traits.json`, `schemas/house_traits.schema.json`): 20 Majors, 24 Minors, 15 Major Flaws, 14 Minor Flaws and 10 Bloodlines, each with §5.2's `flavor` and `crunch` lines and §5.3's effect kinds as data: battle `mods`, recruit `growth` (% of the rolled rate; `all` is every stat but Speed), `jobXp`, `economy`, `score`, `innate` (individual-trait odds), event `tags` and `look` weights. §5.7's lists are the source, with new traits in the same pattern; Minors and Minor Flaws are still short of §5.7's targets (30 and 20), content to add later. Effects a later system owns (events, injuries' tables, sprites, individual traits) are tags or knobs nobody reads yet.
- **`houseEffects`** (`houses.ts`) sums a House's traits and element into one record. Battle mods ride with every person **born** to the House (`person.house`), wherever they are hosted: a Ward fights with their own blood. §5.6 numbers in `tuning.houses.element`: aligned +25 to its element and −25 to the opposite, its spells −10% MP; Unaligned +5 to physical and mental resistance, which every ailment's resistance adds. Elemental Bane stores its named element on the House (`house.bane`), −50.
- **New battle keys:** `restCt` (Wait and Defend both: Iron Discipline's 60 → 50), `ctStart` (Slow to Wake's −20 CT; a battle's start may go below 0), `rangedAccuracy`, `meleeDrainPct` (on a melee weapon's hit), `maxMpPct`, `spellMp.<element>`. Readings: "Wait/Defend costs 50 CT" is −10 on each; "bow and thrown accuracy +10%" is +10 to the hit chance, like every accuracy mod.
- **Recruits:** a House's growth % scales each rolled growth rate after the roll, so seeds draw the same people as before.
- **Town ceilings** (`caps`): the Year's MP refill, the Chapel's and the rest's Sanity and Sanity events now fill to the ceiling a battle sets (injuries, passives, birth House, worn gear), not the bare formula, so no Scion starts a battle short of a full bar.
- **Not yet read:** economy, score and Job XP knobs (5b), individual traits such as innate Fleet, and the Tarot's reversal odds (with promotion). Battles in the campaign arrive in Milestone 6 and pass the birth House then; the simulator's `realParty` takes one now.

## 2026-11-01 (implementation, Milestone 4i: scoring, the timeline, Devastation) — implementer
- **Scoring** (`score.ts`, first pass in `tuning.scoring`): the four categories a House *holds* are counted live; the four it *earns* add up in `house.score` as they happen. Lineage: 2 per Scion or Retired, 1 per recruit, +1 per 5 levels, +0/1/2/4 by potential, +2 per Ward hosted (the host House scores the Ward; heirs come with Milestone 5). Treasury: a point per 10 Gold of Gold − Debt + stores (a material 1 Gold a unit, a rare material 10), times the Vault. Holdings: building levels. Relics: 10 per Relic-tier item and 5 per named item the House owns, worn or stashed. Renown (projects, Crises, votes won, public deals) and Intrigue (deals honored) are in; Valor and Lore come with expeditions and the bestiary (Milestone 6–7). Standing still follows Q85's default.
- **The timeline** (`timeline.ts`): an event's `timeline` effect queues a town event N Years out, for the House it touched, optionally `hidden`. When its Year comes it fires in the Omens and takes the draw it stands in for: a settlement event replaces that Year's settlement draw, a House event that House's roll; a second one due for the same slot waits a Year. Hidden entries show as "?" (their Year only); a House with a Watchtower sees them, and the Rift Observatory shows them to everyone. Reading: §8.7 says a Watchtower "reveals" hidden entries without a level, so any level does. The Observatory foreshadows mandatory expeditions 3 Years ahead instead of 2.
- **Devastation** (`devastate`, §3.3 PROPOSED numbers in `tuning.devastation`): 1–3 House building levels ruined at random across the whole settlement, every store (each House's and the Commons') loses 25%, the next recruit arrivals are cancelled, Accord (or Unrest) −20, Doom +25. A failed forced expedition (§3.2): one level, Accord −10, Doom +10, the stores kept. Walls ruin one level fewer and take 5 off the Doom per level, for both. Reading: Walls soften forced failures too, since the spec counts a forced expedition as mandatory for its Year. Nothing calls it yet: the Expedition Phase (Milestone 6) does when a mandatory or forced expedition fails or retreats; Year 20's failure ends the campaign there.
- **Not in Milestone 4:** forced expeditions themselves (an event that forces one, the two-per-campaign limit, the Watchtower's one-Year warning) and the Watchtower's preview of next Year's event, both with the Rift Gate in Milestone 6. No state change; save version stays 10.

## 2026-11-01 (implementation, Milestone 4h: shops and auctions) — implementer
- **Shops** (`market.ts`): the Armorer (armor and shields), Weaponsmith (weapons and thrown) and Curio Dealer (accessories, plus one magic item a Year of Fine or better) stock lots each Year once built, seeded, replacing last Year's. Stock tier 1 when built; expedition finds raise it to 2 and 3 (Milestone 6, `commons.shopTiers`). The Apothecary, Beastmonger and Fence wait for consumables, summon upgrades and loot.
- **First-pass numbers** (`tuning.shops`): 3/4/5 lots by stock tier; quality odds by tier (tier 1: 70% Common, 30% Fine; tier 2: 30/55/15 with Masterwork; tier 3: 50% Fine, 40% Masterwork, 10% Relic); item level ⌈Year ÷ 2⌉ of a 20-Year campaign; list price 10/20/45/100/220 by tier × (1 + 0.2 per item level above 1).
- **Auctions** [DECIDED]: Masterwork, Relic and Quickening / Multi-hit / Massive-crits goods take sealed bids (`bid`, at least the list price, replaceable); at the seal one bidder pays the list price, several pay the highest bid, a tie costs Accord −3 and goes to the higher Renown. A bid the House can no longer cover at the seal is void. Bids are private; the winner and price are public in the log.
- **A House's own lot** (`auction`, a stashed item and a reserve): it leaves the stash until the seal; the highest bid at or above the reserve buys it and pays the seller (even a lone bidder pays the bid); unsold, it comes home. The Commons' auctions of items won by vote, and the Watchtower L3's look at the second bidder, come when items can fall to the Commons and a private log exists.
- **The bot** neither buys nor bids yet; it will once it can judge gear (Milestone 5/6 outfitting). Save version 10.

## 2026-11-01 (implementation, Milestone 4g: deals) — implementer
- **Deals** (`deals.ts`) [DECIDED: instant]: a House offers (`offer`: what it gives and what it asks, Gold, materials and stashed items), the other accepts or declines, the maker may withdraw (`decline` either way). An accepted deal executes at once; both sides are checked again at acceptance, and offers that can no longer be paid fall away. Offers lapse at the seal. Wards, Mentor loans and facility use join with Milestone 5.
- **Readings:** only stashed (unworn) items can be traded; a House may have 6 offers out at once (implementation default). Private deals are seen only by the two Houses; a public deal is logged and seen by all.
- **Score, first pass:** every deal honored is +1 Intrigue to each side (§3.4 "deals honored"); a public deal is also +1 Renown to each (§8.9).
- **Solo:** no deals (§8.9: NPC dealings come through events).
- **The bot** never offers; it accepts a trade when it gets at least as much as it gives (a unit of Gold or material each 1, an item 20) and can pay, and declines otherwise. Save version 9.

## 2026-11-01 (implementation, Milestone 4f: the Omens and town events) — implementer
- **The Omens** draw one settlement event every Year from all eligible settlement events by weight; the six Crises carry about 40% of that weight (§8.8). Each House draws a House event at 50% (`tuning.omens.houseEventPct`). The Watchtower, Haunted Halls and the like will move these odds when their systems exist.
- **Sixteen events to start**, from §8.8's tables where the systems exist: the Plague Cart, A Stranger at the Gate, the Eclipse, Bread and Circuses, the Debt Collector, the Night of Open Doors, A Saint's Bones, the Mold in the Granary, the Rebellious Commons and the Market Caravan; House events the Cousin's Claim, Portrait Gallery, the Forge Sings, Feast of the Dead, the Suitor and the Locked Wing. Events that need Tarots, traits, Wards or items (the Rift Whispers, Tithe of the Pale Saint, the Ward's Request…) come with Milestones 5–7. Every option is tagged (§9.5).
- **Rules** (`omens.ts`): `vote` (the vote engine; solo, the House decides), `most_gold`, `least_gold`, `least_grain` (added for the Mold in the Granary, as §8.8 words it), `most_scions`, `random_house`, `led_last` (random until expeditions name a Leader), `tarot:<card>` (the bearer's House, else random), `house:trait:<tag>` (else a vote), `each_house` and `secret`. A single chooser's outcome falls on its House; a vote's on the settlement (an effect with no target hits a random House).
- **Readings:** choices are made during the Settlement Phase; a House that has not chosen when the Year is sealed takes the cautious option (the first tagged cautious, else the last). Choices are open except under `secret`, where other Houses see only that a House has chosen; all are revealed together in the log, and an event can say what follows when no House, or every House, picks an option (Bread and Circuses).
- **House events are public**, like everything the spec does not mark hidden. Asked as Q89; since answered: private, with a hint (see the Q89 entry above).
- **The bot** takes a kind option it can afford (it is co-operative), else the cautious one, and votes the same way.
- **Test switch:** the campaign flag `calm` stills the Omens, for tests and tuning runs that measure exact amounts. Save version 8.

## 2026-11-01 (implementation, Milestone 4e: Crises) — implementer
- **Town events are content** (`content/town/<id>.json`, `schemas/town.schema.json`, indexed by `npm run gen:content`), in one format for settlement and House events: scope, weight, Years (of a 20-Year campaign; Short doubles the Year), `requires` predicates, a resolution `rule`, and for a Crisis its Need, optional temptation and four bands. Effects so far: Accord, Doom, resources (a House, each, a random one, or the Commons), ruined building levels, lost recruits, Sanity %, score, flags and timeline entries.
- **Six Crises:** the Hungry Winter and the Breach in the Wall from §8.8, plus the Fever Wards, Raiders at the Ford, the Bridge Gives Way and Fire in the Lower Town. Their Needs use only what Houses can make before expeditions (no Essence).
- **Resolution** [DECIDED, numbers first pass]: result = pledged ÷ Need, each resource counting up to its own Need, ± a hidden swing of 20 points, less each temptation's penalty (15–20 points per House that gave in); Triumph ≥100, Holds 75–99, Falters 50–74, Calamity <50. A full pledge therefore always Holds at least; a Triumph needs luck or over-giving. Pledges are spent whatever the result.
- **The Need scales** with the Year band (×1 to Year 6, ×1.5 to 13, ×2 after) and with the kingdom's income against four Houses' (§4.3), so a solo House faces about half the Need.
- **Hidden information:** each House sees only its own pledge and whether it gave in; everyone sees the Need, and afterwards the totals and the band in the log. The swing is never shown. Renown is granted by each House's pledge (1 per 10 units), privately.
- **Until the other town events exist**, a Crisis is drawn 40% of Years (§8.8's share), as `tuning.crises.pct`.
- **The bot** pledges its fair share of each resource (Need ÷ Houses) while keeping a Year's upkeep, and never gives in to a temptation. Bot campaigns can now be lost to Crises (one seed in six with two Houses breaks Accord by Year 12). Save version 7.

## 2026-11-01 (implementation, Milestone 4d: votes on the Commons) — implementer
- **Votes** (`votes.ts`): a House proposes spending the Commons' stock on a shared project (`propose`), and every House votes (`vote`). The most votes win. A tie costs Accord −3 (softened by the Court of Peers) and goes to the highest-Renown House among those who voted for a tied option, seat order breaking a Renown tie [DECIDED tie rule; the among-voters part is the reading].
- **Readings:** votes are cast in the open (the view shows each House's choice); one vote is open at a time; each House may propose once a Year (implementation default, so a refused proposal is not repeated every move); an open vote settles when all have voted or when the Year is sealed, those who did not vote abstaining; nobody voting means no. A sealed House may still vote. Solo, a proposal is the House's own decision.
- **Renown:** +1 for each House on the winning side (§3.4 "votes won"), first pass.
- **The bot** proposes the first project on its list the Commons can help, and votes yes on its list's projects. In a bot campaign the tithe now raises 2–3 shared projects over 20 Years before expeditions bring materials. Save version 6.

## 2026-11-01 (implementation, Milestone 4c: shared projects) — implementer
- **Shared projects are content** (`content/projects.json`, schema): §8.5's twelve plus §8.6's six shops, which need the Great Market first. Each level is priced as a House building of a tier (Walls: tiers 1, 2, 3) × 1.3 (`tuning.commons.costMult`, §8.5 PROPOSED).
- **Pledges** (`pledge` move) are public and final: they take only what the project still needs, by resource, and a project's level stands at the Reckoning of the Year it is fully paid. Renown: 1 point per 10 units pledged (Gold and materials alike), first pass.
- **Effects in now:** Great Market +10 Gold per House per Year (tithed like income); Granary Grain upkeep −20%; Cathedral Sanity +25% in town and +2 Chapel slots for every House (reading: a House without a Chapel worships in the Cathedral); Aqueduct raises every House's Infirmary a level; Beacon and Hall of Petitions L1 each raise the arrival chance by 25%; University: unlimited Study and 100 JP a Year for every Scion in town; Court of Peers cuts Accord losses by 25% and, solo, raises the track by 10 when it stands (reading: §8.5's "Unrest −10" means ten points less unrest). Walls, the Observatory, Arena, Bastion and Mausoleum wait for the systems they touch (Devastation, expeditions, Sorties, Lore).
- **The bot** pledges what it has beyond two Years of upkeep and a stock for its own buildings, to the first open project on its list, up to twice its fair share. Without expeditions Timber is scarce, so bot projects are slow until the tithe can be spent by vote (next step). Save version 5.

## 2026-11-01 (implementation, Milestone 4b: Year assignments) — implementer
- **Assignments** (§8.3): Rest, Chapel, Infirmary, Train, Teach, Study, Work and Guard, with §8.3's slots (`tuning.assignments`). Expedition, Sortie and Special arrive with Milestone 6 and the events. An assignment **carries over from Year to Year** until changed (reading: the screen keeps the cards where they were).
- **Who may take what:** recruits may Rest, Train or Work; Scions and the Retired anything; only the Retired or a Scion who has mastered a Job may Teach. A Mentor teaches 2 students a mastered Job; a Mentor who stops teaching leaves the students training alone.
- **At the Reckoning:** injuries tick down; an Infirmary slot takes one more Year off the longest Moderate injury; a Chapel slot restores Sanity fully and ends Moderate results of the Sanity table. Sanity: idle +10%, Rest +25%, and Chapel L1 adds +25% for everyone of the House in town (reading: §8.4's "Sanity +25% per Year in town" is the building's own effect, like the Cathedral's).
- **Training numbers, first pass:** a normal expedition's XP is taken as 135 (the finish plus about five battles). Under a Mentor: 60% of it, below the Mentor's level, and 300 JP in the Mentor's Job. Alone: 30%, at most 3 levels below the House's best Scion, and 150 JP in the current Job. Never past level 20. Study: 150 JP. Training Ground L2: students +50% JP.
- **Work** adds 4 to a producer's output (one worker each); the tithe applies to it.
- **Hidden information:** a House sees only its own assignments (`view().mine.assign`). Reading: recruits are private (§6.9) and the spec does not say others' Scion assignments are public, so none are shown until Josh says otherwise.
- **The bot** plans from who its people are, not what they are doing, so its plan holds still: the hurt to the Infirmary, Sanity under half to the Chapel, those who can teach to the Training Ground, recruits to producers, the rest training or resting. Save version 4.

## 2026-11-01 (implementation, Milestone 4a: House buildings) — implementer
- **Buildings are content** (`content/buildings.json`, `schemas/buildings.schema.json`): the 16 House buildings of §8.4 with their level texts, each in a cost class. The rare materials of §8.1 live there too.
- **Costs by class, first pass** (`tuning.town.costs`): the standard row is §8.4's example (L1 20 Timber + 20 Gold; L2 30 Timber + 20 Stone + 40 Gold; L3 40 Stone + 20 Iron + 80 Gold). Producers are "cheap" at about half; the Vault, Shrine and Crypt are "expensive", and L3 of those also takes 10 Essence.
- **Reading:** a build is paid when started and stands at the Reckoning (step 2), so producers pay out from the next Reckoning. A build can be taken back the same Year for a full refund. One build a Year; Masons' Guild (2) waits for traits in Milestone 5.
- **Producer output, the Shrine's Essence and the Mine's rare materials are income**, so the Commons takes its 10% tithe from them (§8.1 "every House's income"). The Vault's interest (L2) is on Gold held before the Year's income.
- **Implementation default:** each House starts with 30 Timber and 10 Stone (scaled like income), so Year 1 can start a building before expeditions bring materials (Milestone 6).
- **Holdings** score 3 points a building level; the Vault adds its 10/20/30% to Treasury. Both are first pass.
- **Other buildings' effects** are read by their own systems by level (Insight already reads the Scriptorium); they come with assignments (4b), events (4d) and later milestones.
- **The settlement bot** keeps a reserve of a Year's Gold upkeep and builds along a fixed plan (materials, then the Infirmary, Chapel, Training Ground and Scriptorium), a Farm first when the House cannot feed itself. Save version 3 (Houses' `works`).

## 2026-11-01 (implementation, Milestone 3x: the Overlord; Q87 answered) — implementer
- **Q87 answered by Josh (decision card, 2026-11-01): Durability does not grow with level, as specified.** `formulas.durabilityPerLevel` is back to 0. To make up for it, `combat.enemyLevelFactor` drops from 0.03 to 0.015: enemy damage grows ×1.15 by L10, where §14.2's formula had ×1.8. The other pass-1 knobs and the pass-2 boss stats stay.
- **Encounters after this** (every pool, 40 fights a template; win / HP lost / injury rolls):
  - L1 Warband: 100% / 30% / 0.1.
  - L4 Warband 100% / 28% / 0.9; Elite patrol 97% / 35% / 2.8.
  - L7 Warband 100% / 23% / 1.4; Elite patrol 97% / 33% / 5.4.
  - L10 Warband 100% / 26% / 3.3; Stalkers 93% / 42% / 5.7; Elite patrol 88% / 37% / 7.9.
  - Injury rolls still climb with level, now from Durability alone, as Josh chose to keep it.
- **Bosses after this** (60 fights, baseline party):
  - Arc: Siege Beast 100%, Cursed King 77%, Unknown Mother 75%, End Ruler 48%.
  - Hunts: Scylla 77%, Fusion 77%, Dark General 58%, Vampire Queen 58%, Orochi 57%; the early Hunts 97–100%.
- **The Overlord** (`overlord.json` → `overlord_ascendant.json` → `overlord_final.json`, L9–10, the Pit), the optional superboss and the fourteenth scripted boss. Three forms, 1×1 → 2×2 → 3×3, each `rise` at 30%.
  - The dispel now runs before a `rise`, so every form change strips the party's buffs (§14.6).
  - Form 1 is a swordsman with a dark bolt and a row of fire. Form 2 claws (Bleed), with alternating telegraphed hellfire bands and brimstone bursts. Form 3 crushes, rains fire on four random cells, and charges a telegraphed Doom Pulse (`all`, Sanity 6) every fourth turn, every third in Despair.
  - Readiness damage half-works on him, like any boss.
  - Simulator at L9: the baseline party wins 31%; a Ravager, Knight, Conjurer and Soothsayer party wins 95%.
- **Milestone 3 is complete:** 12 pool rosters, hazards, variants, and all 14 scripted bosses from §14.6's table.

## 2026-11-01 (implementation, Milestone 3w: tuning pass 2, the bosses) — implementer
- **Targets taken:** mandatory-arc bosses about 60–85% for the baseline party at their level (do-or-die, but a well-built party should usually live); Hunt bosses about 50–70% (optional, and real parties with advanced Jobs and better gear do better); the final boss below half for the baseline, well above for a stronger party.
- **Boss stats changed** (hp and atk are multipliers on the level block, replacing the boss role's 15 and 1.6):
  - Vampire Queen: Speed 15 → 13, hp 6, atk 1.2; Beguile's Charm 60% → 40%.
  - Dark General: hp 8 → 5, atk 1.3.
  - Cursed King: Form 1 hp 4 → 3, atk 1.2; Second Form hp 7 → 5, atk 1.3.
  - Divine Beast Fusion: hp 10 → 7, atk 1.2.
  - End Ruler: hp 12 → 6, atk 1.2.
  - Its champions, the Outer Dark's Unknown Satan and Unknown Princess, take hp 2.0 and atk 1.0 of their own, everywhere they appear, since they were the main thing killing the party. They keep the strongest kits and the Sanity touch.
- **After** (60 fights at each boss's first level, baseline party; win / HP lost / injury rolls):
  - Arc bosses: Siege Beast 100% / 35% / 1.5; Cursed King 83% / 62% / 13.5; Unknown Mother 77% / 44% / 15.6; End Ruler 45% / 80% / 15.8. A Ravager, Knight, Conjurer and Soothsayer party beats the End Ruler 88% of the time.
  - Hunts: Goblin Lord 100%, Tree King 100%, Stone Colossus 100%, Village Evil God 97%, Scylla 67%, Fusion 67%, Vampire Queen 52%, Orochi 50%, Dark General 47%.
- **Left for play:** boss fights still cost the party 10–20 injury rolls, far above encounters. Long fights against fast bosses wear Durability down; the early Hunts are easy at their first level. The bot party also plays the Queen badly (the Knight answers every telegraph with En Garde), so part of her number is the bots, not her.

## 2026-11-01 (implementation, Milestone 3v: tuning pass 1, the enemy curve) — implementer
- **Why:** with every pool and boss in, the baseline party (Soldier, Knight, Vagabond, Soothsayer at level 3L) fell off with level. Averaged over every pool at each level (40 fights a template): Warbands went from 100% and 35% HP lost at L1 to 38% and 84% at L10; Elite patrols from 96% (L2) to 8%; injury rolls from 0.2 to 10–15 a fight. Enemy damage grew about 8× from L1 to L10 while Scion HP grew about 4× and Durability barely at all.
- **Knobs turned (`tuning.ts`):**
  - `combat.enemyLevelFactor` 2/25 → 0.03 (enemy damage × 1.3 at L10 instead of × 1.8).
  - `formulas.durabilityPerLevel` 0 → 2 (Q87, recommended to Josh on a decision card; this is the default until he answers).
  - Role atk about −10% (fodder 0.7, swarm 0.55, bruiser 1.1, caster 1.15, support 0.55, lurker 1.15, artillery 1.0, horror 0.7).
  - Elite 2.5 HP / 1.4 atk → 2.2 / 1.2.
  - The formulas themselves and the boss role are unchanged.
- **After** (win / HP lost / injury rolls):

  | | Warband | Coven | Stalkers | Behemoth | Elite patrol |
  |---|---|---|---|---|---|
  | L1 | 100% / 31% / 0.1 | 100% / 34% / 1.8 | | | |
  | L4 | 100% / 29% / 0.3 | 100% / 31% / 0.7 | 99% / 30% / 1.9 | 99% / 36% / 0.6 | 98% / 34% / 1.2 |
  | L7 | 100% / 25% / 0.4 | 100% / 29% / 0.5 | 97% / 29% / 2.0 | 94% / 38% / 1.8 | 93% / 39% / 5.4 |
  | L10 | 98% / 31% / 1.2 | 90% / 34% / 1.5 | 83% / 48% / 2.8 | 85% / 51% / 3.0 | 73% / 48% / 5.4 |

  The curve is flat now. Normal fights cost 25–35% HP, above §14.2's 10–20%, and Elite patrols still roll several injuries; both are left for play, since bot parties play worse than people.
- **Bosses after this pass** (60 fights at each boss's first level): Goblin Lord, Tree King, Siege Beast and Stone Colossus 100%; Village Evil God 97%; Unknown Mother 77%; Scylla 67%; Orochi 50%. Still near-unwinnable: Dark General and Cursed King 22%, Vampire Queen 17%, Divine Beast Fusion 3%, End Ruler 0%. Pass 2 takes those on one by one.

## 2026-11-01 (implementation, Milestone 3u: the End Ruler, Year 20) — implementer
- **The End Ruler** (`content/bosses/end_ruler.json`, L10, Outer Dark, tagged `arc`), the final boss. **Reading taken: 2×8 (E2–E3), like the Mother**, so its Unknown Satan and Princess have the front column to fight from.
- **The Throne:** it starts Guarded (nothing can target or reach it) and only Decrees (Mark, Sanity 4, a chance of Fear) or waits. **Reading taken:** it stands when both its champions have fallen (`adds==0`), not at an HP mark, since it cannot be hurt while it sits.
- **The Ruler:** Speed 12; a dread pulse to `all` (Readiness 40, Sanity 4), a `band:3` of dark ruin, a `column:B` strike, and a reaching hand on the Marked. **The Pact** at 25%: `burst:5x5` from the Aspects every other turn.
- **Left for later:** "every Divine Beast or Idol Relic in the party removes one of its immunities" waits for those Relics (loot, Milestone 6); its immunity list is written in the order they would come off. The Dark Bargains resolving at *The Pact* belong to the campaign layer.
- **Simulator:** L10 baseline party 0%: the Satan and Princess (L10 elites) end it in about four turns. This and the other late fights are the next step, the tuning pass.

## 2026-11-01 (implementation, Milestone 3t: the Unknown Mother, Year 15) — implementer
- **The Unknown Mother** (`content/bosses/unknown_mother.json`, L8, Outer Dark, tagged `arc`). **Reading taken: she is 2×8 (E2–E3), not 3×8.** The spec has her brood three Seeds at E1, and a 3×8 body leaves no cell for them; so the front column is her brood's. The Unknown Core is a Part on her front middle cells (Fire ×1.5 and Holy); breaking it stops Brood and Lullaby, and it **regrows once** at half HP (the `regrow` phase). Two Unknown Colonies open the fight; three more wake at a fifth.
- **New enemy abilities:** `call` (Brood: calls adds onto its grid like a phase does; bots only use it when there is room) and `sanityResists` (Lullaby: each Scion resists its statuses on d100 under their Sanity %, so a calm Scion stays awake and a frayed one sleeps). Consume is `devour` with `all`: every Seed, 10% each. Rupture is `checker:a` then `checker:b` on her consecutive turns.
- **Fix: on-hit statuses lasted the whole battle.** Weapon crit statuses (a mace's Stun), `onHit.*` mods, Envenom and the Marsh Thing's poison passed 0 ticks, which means "the whole battle"; a single Stun froze a boss for good. They now take the status's own default (Stun 100 ticks, Poison 300). Boss win rates barely moved (re-run below), so it was not what made the late fights hard.
- **Simulator** (baseline party, after the fix): Unknown Mother L8 47%. Others: Goblin Lord L2 94%, Siege Beast L3 100%, Vampire Queen L4 10%, Tree King L4 83%, Scylla L5 42%, Stone Colossus L6 62%, Cursed King L6 0%, Village Evil God L6 40%, Dark General L7 7%, Orochi L7 5%, Divine Beast Fusion L10 0%.

## 2026-11-01 (implementation, Milestone 3s: the Cursed King, Year 10) — implementer
- **The Cursed King** (`content/bosses/cursed_king.json`, L6, Barrows, tagged `arc`): Form 1 is a 1×1 duelist at E2 with two Fallen Kingdom Knights. Decree Marks the strongest Scion (the Knights and Hollow Soldiers already hunt a Marked Scion); **Royal Parry** puts on a new status, `parry`, that answers the next melee blow with a counter and then ends; Kingsblade reaches two columns.
- **His Second Form** (`cursed_king_risen.json`, 3×3, `addOnly`): a new phase field, **`rise`**, takes the first form off the field (no death line) and brings the named boss on at full HP where it fits, middle rows first. The Crown is a Part on the top middle cell: Holy −100 (twice the damage), and breaking it puts out Crown Fire (`band:4`, dark, telegraphed) and takes 15% off his damage. He calls two Hollow Soldiers at 75% and two more at 50%.
- **Abdication**: a new phase field, **`kneel`**, ends the fight as won with the boss alive and flagged `knelt`. The crown's Dark Bargain (§14.7a) comes with the campaign layer and reads that flag.
- **Reading taken:** Form 1 rises at 40% of its own HP, not at 0, so the duel is the shorter half.
- **Simulator** (baseline party): L6 wins 0%. The two elite Knights alone take the party down before the first form breaks (with one Knight: 10%, and the Second Form and its Court work as written). Like the other late fights this waits for the tuning pass; the spec's two Knights stay.

## 2026-11-01 (implementation, Milestone 3r: the Siege Beast, Year 5) — implementer
- **The Siege Beast** (`content/bosses/siege_beast.json`, L3, 3×4 across all three enemy columns, filed under the Pit, tagged `arc`): the first boss of the mandatory arc (§14.7). Gore (`single`, reach), Trample (`band:3`, telegraphed, may Knock Down), Howl (`all`, Sanity 6, telegraphed), and **Devour**, a new enemy ability that eats a living ally among listed ids and heals a % of max HP for each (`devour: {of, healPct, all?}`; the Unknown Mother's Consume will use `all`). Weakness Holy (−50) and Head ×1.5.
- **Reading taken: "Demon Recruits in two Reinforcement waves"** is two Recruits at the start and three more at each of two phases (two thirds and one third HP); the last wave also speeds it up and lets it devour at any HP. The Recruits are the Pit's own (`pit_demon_recruit`), at the boss's level.
- **How the campaign finds the arc bosses:** for now by the `arc` tag; the Year, the stakes (Devastation on a loss; the Bastion and a Relic on a win) and the gate background come with the campaign layer (Milestone 4) and the screens.
- **Simulator** (baseline party, 200 fights): L3 wins 100%, 45% HP lost, 0.48 Scion deaths per fight; the Goblin Lord at L2 is 95% and 0.36. A first wall that is won but costs a Scion half the time; tune in play.

## 2026-11-01 (implementation, Milestone 3q: the Outer Dark) — implementer
- **The Outer Dark roster** (`content/enemies/outer_dark/`, ids `void_*`, 25 enemies, L6–10): the Unknown kin, the Void Demon and Rift Varga, the Shoggoth, the Mi-Go, the Lloigor, the Meteoros and the watchers. Every Outer Dark enemy takes −50% from Holy and resists the four base elements by 25 and Dark by 50; most touch Sanity. Enemies tagged `unknown` are immune to Charm and Sleep (nothing there thinks like a mind).
- **Reading taken: the Unknown Grappler's drag** pulls a Scion to the party's Front, like a Kelpie's; dragging across into the enemy grid is not modeled.
- **Left out for now:** the Void Egg (hatch on hit), the Godblight Parasite, the Sphere-Neck Titan and the Amorphous and Sludge Horrors; the Nightmare is already the Beast Lands'. No boss in this PR: the Unknown Mother (Year 15) and the End Ruler (Year 20) come with the mandatory arc.
- **Simulator** (soldier/knight/vagabond/soothsayer, 200 battles): L6 warband 74%, battery 100%, behemoth 48%, elite patrol 11%; L10 warband 39%, behemoth 24%, elite patrol 1%. Like the other late pools this is too hard for the baseline party; the tuning pass after the mandatory-arc bosses takes it on.

## 2026-11-01 (implementation, Milestone 3p: the Dragon Reaches and Yamata no Orochi) — implementer
- **The Dragon Reaches roster** (`content/enemies/dragon_reaches/`, ids `reach_*`, 16 enemies, L5–10, elements by dragon): everything §14.5 lists except the named dragons, which are Hunt quarries (Tiamat, Apep, the God Dragon and the rest come with the Hunt bosses). The Mini Dragon is the artillery (its breath sweeps the Back); "dragon breath" is the drakes' and dragons' own. The Dark Dragon and the Ice Dragon are already the Pit's and the Deep Cold's. §14.5 names no support or horror here, so those slots fill from the stand-in chain (`SPARSE`). Petrify is Stop, as in the Court, at 20–25% for 200 ticks: at 35–40% for 300 the Stalkers won 83% of fights at L5.
- **Yamata no Orochi** (L7–8, 3×8: the whole enemy grid), a Hunt: eight head Parts down the Front (Fire, Water, Wind, Earth, Light, Dark, Ember, Venom), each breathing its element down a row and each immune to its element and ×2 weak to the opposite. **The body starts Guarded** (new status, like Submerged: nothing can target or reach it; boss files can now `start` with statuses) and **The Body Rises** when four heads are down (phases can `clear` statuses): Speed 11 and Eight-Fold Fury on everyone every third turn. **Last Head** at one head: fury every other turn.
- **Reading taken: "when a head dies two others rage (+Speed)"** is one body taking turns for all its heads, so a fallen head makes the body angrier instead: +10% damage per head down (Part `mods`). The Speed comes with the phases.
- **Simulator:** the baseline party beats Orochi 8% at L7 and 5% at L8; Dragon Reaches Coven and Stalkers fights are 40% at L5 and 14% at L8. Late content stays out of reach until the tuning pass.

## 2026-11-01 (implementation, Milestone 3o: the Shrine of Six and Divine Beast Fusion) — implementer
- **The Shrine of Six roster** (`content/enemies/shrine_of_six/`, ids `shrine_*`, 24 enemies, L4–10). One element per shrine: the Element and the Elemental Slime take their shrine's color through the four elemental variants; the spirits (Salamander, Gnome, Sylph) are immune to their element and doubly weak to its opposite; everything else leans to one element. No swarm is named, so Swarms fill from fodder (`SPARSE`). The Undine is the Drowned Marches' already. Left for later: Earth Slug, the elemental men, Charm Nymph, Double Eagle, Giant Insect, the Clay, Ice and Wind Armors (Clay and Ice exist in other pools), Qilin, the Four Symbols, Yinglong and Zhulong.
- **The six Divine Beasts are the colossi** (3×3, each immune to its element and ×2 weak to the opposite; Water and Earth from L4, the rest from L6). They are each shrine's Pilgrimage guardian too (§9.7, Milestone 6). First pass at the full colossus 6× HP they won the Behemoth template 89% of the time at L4; they are 4× HP and 1.2× attack.
- **Divine Beast Fusion** (L10, 3×3 Hunt boss) cycles elements with its phases (phases can now set `affinity`): Fire, then Earth at two thirds, then Dark at a third; immune to its current element, ×2 weak to the opposite. **Reading taken:** §10.10 allows three forms, so it shows three of the six, chosen so the party's answers are Water, Wind and Holy in turn. "The matching shrine's Relic nullifies its current element" waits for Relics (Milestone 6).
- **Simulator: L10 is out of reach for now.** The Fusion wins 99% of the time in four turns: at L10 enemy hits do 120–230 against Scions with about 200 HP. Every pool shows it (Shrine of Six at L10: Warband 25%, Elite patrol 3%). This is Q87 and Milestone 2n's late-level problem, and the tuning pass after the pools is where it gets fixed.

## 2026-11-01 (implementation, Milestone 3n: the Apostate Court) — implementer
- **The Apostate Court roster** (`content/enemies/apostate_court/`, ids `court_*`, 25 enemies, L2–9, mixed elements: each enemy has its own leanings, the pool none). §14.5 names no swarm here, so its Swarm Encounters fill from fodder (`SPARSE`, as in the Deep Cold). The Fallen Kingdom Knight and the Cursed Archer are already Barrows enemies; the Dark Necromancer too. Left for later: Pirate Lackey, Trooper, Power Fighter, the Noble, Fallen Noble and Jade sorcerers, Calamity Priest, Dagger Witch, Claw Assassin, Head Hunter, Blue Elite Soldier, most of the officers, the Vampire, the Pirate Captain and Crime Don, and the Gun-Tank Fortress.
- **Human tactics** (§14.5): captains (the Guard Captain, the Bandit Boss) Mark a Scion for the others (Bandit Thugs gang up on the Marked) and **fall back to E3 when hurt** (new gambit `retreat`: move to the back column of its row and Defend; passes to the next rule if it is already there or cannot move). Formations: the Red Dread Guard's phalanx (Guard on every ally), the Enemy Soldier's pike (`reach`), the Whip Commander driving the levy (Haste). The Political Merchant's bribe costs the strongest Scion a turn (Skip Turn); the Medusa Assassin's petrifying gaze is Stop, until a Petrify status exists; the Fanatic blows itself up when nearly dead.
- **No scripted boss in this PR:** the §14.6 first-pass table has none for the Court; the Cursed King (Year 10) comes with the mandatory arc.
- **Content lint:** every enemy gambit's `do` must be one of its abilities, `wait`, `defend` or `retreat`.
- **Simulator:** 93–100% at L2; at L9 Behemoth 63%, Elite patrol 20%.

## 2026-11-01 (implementation, Milestone 3m: the Faceless City and the Village Evil God) — implementer
- **The Faceless City roster** (`content/enemies/faceless_city/`, ids `city_*`, 25 enemies, L3–9, resisting Dark). "Sanity damage everywhere" (§14.5): every enemy here touches Sanity on its hits (`sanityTouch` at least 1) and most have a Sanity ability. From the long list, the Faceless Young Man, Cult Follower, turned Citizens, Iron Stake Executioner (the Executioner carries the stake), Possessed Priest, the four other crawlers, the Door Bearer (its summoning door needs a summon ability for enemies), most of the horrors and three elites wait for later. The Flesh Mass (2×2) and the Wheeled Flesh Mass (2×3) are the colossi; the Hallway Giant (3×8) waits.
- **The Village Evil God** (L6–7, 3×3 on E1, four Fanatical Villagers): every hit costs a Sanity more for each villager still standing (`sanityPerAdd`, new); its tendrils sweep the Front, its gaze finds the most shaken Scion, and every fourth turn Eyes Open (`all`, 10 Sanity and more, 200 ticks' warning). **Many Eyes** at 60%: two more villagers, the eyes every third turn. **The Feast** at 30%: one villager becomes a Flesh Mass where it stood (phases can now `transform` an add), the eyes every other turn.
- **Reading taken: "a Charmed villager"** is one of the god's own villagers (they are its thralls); a Scion it Charms is not turned.
- **Simulator:** the baseline party beats it 40% at L6 and 26% at L7, with about 40 injury rolls a fight; Sanity is the threat it was meant to be. Faceless City Encounters: 91–100% at L3; at L9 the elite patrol 30%.

## 2026-11-01 (implementation, Milestone 3l: the Forge Ruins and the Stone Colossus) — implementer
- **The Forge Ruins roster** (`content/enemies/forge_ruins/`, ids `forge_*`, 25 enemies, L3–9, resisting Earth, weak to Water, rust, and Wind). Since Lightning is Wind (Q86), the pool's "Earth, Lightning" attacks are Earth and Wind and its old Wind resistance is dropped (`pools.json` had it both resisting and weak to Wind). Constructs are immune to poison, sleep, fear, charm and bleed. Holy Armor waits for later (budget). The Guardian (2×3), the Gear Giant (3×3, a flywheel Part) and the Death Machine (3×3, L7–9) are the colossi.
- **New enemy ability fields:** `tpSteal` (the Gremlin takes 20 TP from whoever it hits), `selfDestruct` (the Bomb is destroyed by its own telegraphed 3×3 burst, so killing it first stops the burst), `flee` (the Gem Thief leaves the field alive on her fourth turn), `constructHpPct` (the Repair Construct mends machines).
- **Reading taken: the Gem Thief "steals an item"** waits for the Expedition's Satchel (Milestone 6), as the Barrows' Grave Robber does; for now she hits and runs, and an Encounter she flees is still won.
- **The Stone Colossus** (L5–6, 3×4 on E1), the interrupt boss: two fist Parts (each powers one `band:4` slam; they alternate) and a core Part between them that powers Earthquake (`all`, 300 ticks' warning, every fourth turn while both fists live). **A destroyed Part now cancels a charge it powered**, so breaking the core mid-charge stops the quake. **One Knee** when a fist breaks: Speed 5 and a Head weak point (aimed blows ×1.5; phases can now set `weak`). **Crumbling** at a quarter: Speed 8. New condition `lost.<ability>` (what its destroyed Parts took). It speaks only in stage directions.
- **First-pass numbers:** at slam power 1.1 the party lost 92% of the time in ten turns (half the grid struck every turn); the slams are 0.7 and Earthquake 1.2.
- **Simulator:** the baseline party beats the Stone Colossus 74% at L5 and 62% at L6. The bots never aim at the core during the charge (their gambits have no rule for it); players will. Forge Ruins Encounters: 72–100% at L3; at L9 Coven 65%, Behemoth 55%, Elite patrol 51%.

## 2026-11-01 (implementation, Milestone 3k: the Pit and the Dark General) — implementer
- **The Pit roster** (`content/enemies/pit/`, ids `pit_*`, 25 enemies, L4–10, resisting Fire and Dark, weak to Holy and Water). Trimmed to the budget from §14.5's long list: Imp Child, Fire Slime, Horned Demon, Giant Red Demon, Flame Gator, Melt Boar, Fat Evil, Old Demon Mage, the elemental demons, the Curse Priest (a Barrows enemy already), Incubus, Hellfire Brazier, Eye-Hand Demon, Armored Cursed Demon, Flame Beastman and the Demon Prince wait for later. The Demon Recruit is in (the Siege Beast's waves, Year 5). The Walking Brazier's "fire ground on a band" is a telegraphed Burn across three rows until ground effects exist. The colossi: Dark Beast (2×2), Great Demon (2×3, its horns a Part), Dark Dragon (3×3, L8–10).
- **The Dark General** (L7–8, on E2 with an Elite Demon before him on E1 and a Demon Gunner behind on E3, all in one row): he Marks the strongest Scion and duels the Marked two columns deep; the Elite takes Guard and Provoke every other turn, so the party's blows go to it; the Gunner lobs and sweeps the Middle; his banner raises their Might. **Infernal Order** at half: Speed 14 and, while either of them stands, his allies are **Quickened** (new status: an action costs half its CT, so they act twice as often, §14.6's "adds act twice") and he volleys hellfire on the densest cluster.
- **Reading taken: "Marks the Leader"** is the strongest Scion (`highest_might`) until an Expedition has a Leader the battle knows of (Milestone 6); then the target becomes the Leader.
- **Simulator: the hardest fight so far.** The baseline party wins about 8% at L7 and 3–5% at L8–9, losing in about 12 turns, mostly to the Elite and the Gunner, which the party's melee cannot reach past the Elite's Provoke. The Elite Demon's execution blade came down from 1.5 to 1.2 after the first run. Pit Encounters at L4: Warband 60%, Stalkers 73%; at L10 Warband 40%, Coven 30%, Behemoth 22%. This is Milestone 2n's late-level shortfall in the party's damage again; the tuning pass takes it on once the pools are in.

## 2026-11-01 (implementation, Milestone 3j: the Deep Cold) — implementer
- **The Deep Cold roster** (`content/enemies/deep_cold/`, ids `cold_*`, 17 enemies, L3–8, resisting Water and weak to Fire): everything §14.5 lists. Ice is Water (§7.4 has six elements), so every Deep Cold enemy is immune to Frozen and many of their blows Freeze. The Ice Lizard is the artillery (its spit is a `lob`); the Wendigo is the lurker (it hunts a shaken Scion first, then the weakest); the wind-walkers of Ithaqua are the horror (Wind-Walker). The Woolly Mammoth (2×2, tusks a Part) and the Ice Dragon (3×3, L6–8) are the colossi.
- **Reading taken: the Deep Cold is sparse.** §14.5 names no swarm and no support there, so a Swarm or a support slot in its Encounters fills from the stand-in chain (fodder; casters), and the content lint allows exactly those two roles for this pool (`SPARSE` in `tools/content.test.ts`). I did not invent creatures to fill them.
- **No scripted boss yet:** the §14.6 first-pass table has none for the Deep Cold. The Ice Dragon, the Ice Queen, Ithaqua and the Glacial Beast come with the Hunt bosses (two phases each, §14.9) after the scripted ones.
- **Part ids are unique across all content**, so the Woolly Mammoth's tusks are `frost_tusks`.
- **Simulator:** Deep Cold Encounters are 88–100% at L3; at L8 they are the hardest yet: Behemoth 13% (the Ice Dragon), Elite patrol 45%, Stalkers 51%.

## 2026-11-01 (implementation, Milestone 3i: the Drowned Marches and Scylla) — implementer
- **The Drowned Marches roster** (`content/enemies/drowned_marches/`, ids `marsh_*`, 25 enemies, L2–7, resisting Water and weak to Wind, which holds Lightning since Q86). Trimmed to the budget: Water Lizard, Earth Frog, Bunyip and the Abyss Kragen (3×8) wait for later. The Octopus and the Giant Squid (2×2) carry `reach`, two columns deep. The Kraken (3×4, its tentacles a Part that powers the coils) and the Hydra (2×3, a water head and a venom head as Parts) are the colossi.
- **Pulling Scions forward:** enemy abilities can `pull` (1–2 columns toward the Front, the Grapple Line rule turned around). The Kelpie drags a Back Scion to the Front; the Giant Frog's tongue pulls one column.
- **Submerged** (new status, 200 ticks, not dispellable): nothing can pick a submerged combatant, and areas, lines and the Front-of-each-row pass over it. It still acts. A Hidden one could still be caught by an area; a Submerged one cannot.
- **Scylla** (L4–5, 2×3 on E1, two Kelpies beside her, also on E1 so the Front can reach them): she lashes two hits, drags a Back Scion forward every third turn, and wards herself with a Shield (5% of her HP) only while a Kelpie lives (§14.6's "the Kelpies feed her shield"). **The Deep**, at half: she dives at once and every fourth turn, Speed 14, another Kelpie comes, and while under she sends the undertow up through the Back, Middle and Front columns in turn.
- **First-pass numbers:** with her Kelpies placed behind her on E3 and at full lurker damage the party lost 86% of the time in about 11 turns, nearly all of it to Kelpie bites; Kelpies now bite at 0.9 and drag at 0.6, and Scylla has 8× HP.
- **Simulator:** the baseline party beats Scylla about half the time at L4–6 (52/45/45%, 17 turns). Drowned Marches Encounters: 98–100% at L2; at L7 the elite patrol (37%) bites.

## 2026-11-01 (implementation, Milestone 3h: the Hollow Wood and the Ancient Tree King) — implementer
- **The Hollow Wood roster** (`content/enemies/hollow_wood/`, 25 enemies, L1–7, resisting Earth and Water, weak to Fire) from §14.5's list, trimmed to the 25 budget: Mushroom Baby, Paper Swarm, Dragonfly, Giant Weta, Nymph, Pitcher Plant, Devil Flower, Devil Pine and Emperor Cicada are left for later variety. The Tree King is a boss only, not a drawn colossus; the Sunflower Giant (its flower head a Part that powers the solar beam) and Tsuchigumo are the colossi.
- **The Ancient Tree King** (L2–3, 3×4 on E1–E3, Fire ×2): roots the Front every third turn and brings the canopy down on three rows with 200 ticks' warning (§14.6's "telegraph 2"). **Seedfall** at two thirds (Sprouts, sap drinking) and **Old Growth** at a third (Speed 9, limbs regrow, Regen, more Sprouts, the canopy every other turn).
- **Reading taken: "a destroyed limb halves its damage"** is a quarter per limb, so both limbs down halves it (each limb at −50% would leave nothing at two). Parts can now carry `mods` the body takes while the Part is destroyed (`damagePct`, a new mod on every blow), given back when it regrows.
- **Sprouts are their own add** (`hollow_sprout`, `addOnly`, 0.4× HP, no healing): with the pool's Sprout Sprites as adds the party spent half its actions on seven healers whose HP outweighed the King's, and fights ran 40–80 turns.
- **Boss HP:** a boss file's `stats.hp` replaces the role's 15× (as every enemy's `stats` do). The Goblin Lord has 6×, the Tree King 8×, the Vampire Queen the full 15×; that is where the coming tuning pass starts.
- **Content lint:** every gambit condition and target in enemy and boss files must be one the engine knows (unknown ones were silently false or fell back to the column rule). New condition `foe.<status>` / `ally.<status>`, new target `rooted`. `npm run sim -- --boss <id> --log` prints one boss fight.
- **Simulator:** the baseline party beats the Tree King 98% at L2, 95% at L3, 83% at L4 (about 29 turns). Hollow Wood Encounters: 100% at L1; at L7 the stalkers (69%) and elite patrol (29%) bite.

## 2026-11-01 (implementation, Milestone 3g: the Beast Lands and the Goblin Lord) — implementer
- **The Beast Lands roster** (`content/enemies/beast_lands/`, 23 enemies, L1–6): goblins, giant rats, wild boars and bugbears as fodder; bats and killer bees as flying swarms; orcs, ogres and trolls as bruisers; evil and crow shamans as casters; goblin shamans and the fox white mage as supports; the weasel ninja, the redcap and the werewolf as lurkers; the beehive (a spawner) and the charging rhino as artillery; the nightmare as the horror; the orc king and the tiger swordsman as elites; the mammoth (2×2, its tusks a Part that disables Tusk Sweep) and the behemoth (3×3) as colossi. Every template fills at L1–6 and a third of the roster threatens the back line (the content test now lints the Beast Lands too).
- **The Goblin Lord** (`content/bosses/goblin_lord.json`, L1–2), the first boss most Houses meet: he stands on E3 behind four goblins on E1, piles on the Front every third turn and lobs crossbow bolts otherwise; **Cornered** (Speed 16, war drum, a crown chop) once his goblins are down to one *or* he is at half health; **Flight** at 30% unless rooted. Reading taken: a cowardly lord should be beatable by a fresh party and should teach that roots stop a flight.
- **Boss conditions now take `||`** (looser than `&&`), and a boss file may set its starting column (`at`: E1–E3).
- **Simulator:** the baseline party beats the Goblin Lord about 95–97% at L1–3 (17 turns, ~60% HP lost). Beast Lands Encounters are easier than the Barrows: 95–100% at L1–3; at L6 the warband (74%) and the elite patrol (48%) bite. Not tuned yet.

## 2026-11-01 (implementation, Milestone 3f: hazards) — implementer
- **The battle hazards of §14.8 are content** (`content/hazards.json`): Explosive Barrel, Poison Gas Crate, Alarm Bell and Rotating Saw stand on the enemy grid as combatants that take no turns, take no statuses and do not hold the field; Rockfall and Bear Trap lie on the party's grid (`Battle.field`). The Mimic, Iron Maiden and Cage, Hidden Trapdoor and cursed objects belong to Cache and event nodes (Milestone 6); the Demon Wall to boss arenas; Binding Chains to a lurker's ability.
- **Odds:** a drawn Encounter carries a hazard at its pool's `hazardPct` (3a), one at most, chosen by weight among those not yet met this expedition (`hazards` in the encounter spec; the expedition passes what it has seen, Milestone 6).
- **Readings taken:** the barrel's 3×3 is centred on it and catches its own side too (and the party's Front beside it on E1), so shooting it is a real choice. The crate vents a poison cloud on the Front of its row's column every 200 ticks. The bell rings once, when struck or after 300 ticks, calls two of the pool's fodder at E3 (Reinforcements, §14.4) and falls silent; bots leave it alone (`bait`). The saw bites the Arms of whoever stands at the Front of its row every 100 ticks, and blocks that row's melee like any front-most enemy. The rockfall is announced on the band where most Scions stand and falls 300 ticks later (§14.8's "3-turn timer"). The trap springs when a Scion who moved onto it acts. Hazards' blows always land (`tuning.encounters.hazards.accuracy`).
- **Hidden information:** a Bear Trap's cell is `hidden`. The battle view (Milestone 8) must never send a hidden field hazard's place to the players; it is added to the hidden-info test's forbidden list then.

## 2026-11-01 (implementation, Milestone 3e: variants) — implementer
- **Variants are content** (`content/variants.json`, §14.10): the four elemental ones (Ashen, Drowned, Storm, Stone), Hollow and Unknown-touched. Each adds its leanings to the enemy's (clamped to ±100), its tags and immunities, Sanity touch, an element for damaging abilities that have none, and levels; the name takes the prefix and the combatant carries the variant id for its tint (Milestone 8).
- **Readings taken:** elemental variants follow the opposed pairs (§7.4): Ashen resists Fire and fears Water, Drowned the reverse, Storm resists Wind and fears Earth, Stone the reverse. An enemy names the elemental variants that suit it (`variants` in its file). **Hollow fits any living fodder or bruiser** (not the undead or constructs) and adds Dark +50, Holy −50, Sanity touch 2 and poison and fear immunity. **Unknown-touched** fits anyone but bosses and adds, from Year 10: +1 level, +25 to every leaning but Holy, which takes −25 ("void resist").
- **Odds, first pass** (`tuning.encounters.variants`): each enemy in a drawn Encounter is Unknown-touched 30% of the time from Year 10, otherwise one of its other variants 20% of the time. Encounters take the campaign Year for this.

## 2026-11-01 (implementation, Milestone 3d: scripted bosses) — implementer
- **A boss is content** (`content/bosses/<id>.json`, `schemas/bosses.schema.json`): an enemy plus opening `adds`, up to three `phases` (two to three in all with the opening, §10.10), `say` lines (`open`, `death`, one per phase) and a bestiary `pattern`. A phase is entered once, in order, the moment its `at` condition holds (checked after every action and clock step): it swaps the gambit list, may set Speed, strip the party's buffs (`dispel`), regrow destroyed Parts, put statuses on the boss, call adds onto E1–E3, or make it flee (the fight is won; the boss is not killed and says no death line). Several phases passed at once are entered in order. Phase conditions are the gambit conditions, now joinable with `&&`, negated with `!`, and able to test the boss's own statuses (`hp<=0.3 && !self.rooted`). The boss fight deploys everyone at CT 30 (§14.6).
- **Reading taken: a phase's abilities are the ones its gambits name.** §14.6 gives each phase "its own ability set, gambit list"; the boss file lists every ability once and each phase's gambits choose among them, so nothing is duplicated.
- **Adds**: enemies a boss brings carry the `add` tag (Banish takes them, §12.15) and may be `addOnly` (never drawn for an Encounter, not counted in the pool's roster budget). They are not immune to anything (§10.10).
- **The first scripted boss is the Vampire Queen** (Barrows, L4–5) with two Brides: Charms the highest-Might Scion, heals on every bite, turns to mist only while a Bride stands, a telegraphed waltz every third turn; The Thirst at 60% (Speed 16, dispels the party's buffs, blood rain on the densest cluster); The Last Dance at 25% (three bites a turn). New gambit target `highest_might`.
- **Simulator** (`npm run sim -- --boss vampire_queen`): the baseline real party wins **about 10%** at L4–6 (26 turns, 91% HP lost). The Queen's 15× HP (the §14.2 boss multiplier) outlasts the party's damage, about 9 HP per Scion action: the same shortfall Milestone 2n found. Not tuned yet; the role and boss multipliers get one pass once every pool and the scripted bosses exist, and Josh wants to see fights before numbers are fixed.

## 2026-11-01 (implementation, Milestone 3c: Parts) — implementer
- **Parts are combatants of their own** (`combat/enemyparts.ts`): each sits on its rectangle of the body's cells (relative to its top-left), with its own HP (a share of the body's max), the body's defenses, Evasion and leanings plus its own `affinity`, `immune` and `weak`. On a Part's cell a single strike or an area hits the Part; the body is struck through its other cells. In melee a body and its Parts in the same front column are one front: either can be struck. Parts take no turns, die with the body, and do not hold the field once the body falls.
- **Reading taken: a blow on a Part also hurts the body**, at 50% (`tuning.enemies.parts.bodySharePct`), so breaking a Part is never wasted time; §14.1 gives each Part its own HP but is silent on whether that damage carries. Destroying a Part loses the body the abilities in its `disables` and staggers it (Readiness −50, §14.1). An enemy with Parts does not move (they would come apart).
- Gambits gain the `part` target (the most hurt Part) and the `parts<N` condition (the body's living Parts). The content test checks each Part sits on its enemy's cells, is a rectangle, and disables abilities the enemy has.
- **The Barrows' Dragon Zombie** has the first Part: its Rotting Skull (20% HP, Holy −100) powers Rot Breath.

## 2026-11-01 (implementation, Milestone 3b: the Barrows roster and role behaviors) — implementer
- **The Barrows is the first full pool**: 25 enemies (L2–8) covering every role at every level, 11 of them back-line threats (lurkers, artillery, horrors, flyers and the reach-armed Dead Soldier). The content lint (every template fillable at every level from the pool's own roster; 15–25 enemies; a third back-line) now runs for it. Of §14.5's list, the Mini-Mummy, Gravekeeper, Lingering Thought, Weeping Madonna and Royal Tomb Guardian were left out to keep within the 25 budget (they make good variants or event enemies later); Gashadokuro and the Lich-as-boss wait for the boss step.
- **Sprites are not referenced yet.** The pack file names are on Josh's PC; each enemy's `sprite` is filled in with the sprite manifest (Milestone 8).
- **Lurker leap, reading taken:** §14.3's lurker "jumps onto an empty player cell next to the Back". The grids stay separate (one side per grid keeps every targeting rule simple), so a leap is an ability flag: it reaches any standing Scion, then the lurker is **Exposed** until its next turn, and every Scion's melee reaches it from any column ("it can be surrounded there"). The `empty_cell` gambit target aims at the Back. If Josh wants lurkers to stand on the party's grid for real, that is a larger change to the grid model.
- **Swarm overrun** is a content ability on each swarm (`band:3`, every other turn) behind a new gambit condition, `swarm>=5` (living swarm on its side, itself included).
- **Raise** (the Dark Necromancer): a support ability that lifts the first fallen fodder or swarm ally whose cell is free at 50% HP, its statuses cleared; gambit condition `fallen>=1`. It charges and telegraphs, so it can be interrupted.
- New gambit targets: `lowest_durability` (bruisers, §14.3), `densest_row` and `densest_cluster` for single-target abilities (area abilities already aim at the densest cell), `empty_cell`.
- **Simulator, Barrows, baseline real party** (100 battles, win % / HP lost): L2 every template 98–100% and 14–48%; L5 Warband 93%/44%, Behemoth 79%/60%, Elite patrol 78%/59%; L8 Warband 71%/59%, Battery 100%/26%, Behemoth 13%/93%, Elite patrol 22%/89%. Elites and colossi are far too strong for the party at L8 (they take the role multiplier on top of an L8 block the party's gear does not keep pace with). Not tuned yet: the bosses and the other pools come first, then one tuning pass over the role multipliers.

## 2026-11-01 (implementation, Milestone 3a: pools, group templates and the encounter builder) — implementer
- **Pools and templates are content**: `content/pools.json` (the 12 regions of §14.5: levels, card types, element leanings, hazard odds) and `content/templates.json` (§14.4's eight templates with their 4- and 8-party role counts, weights and level gates). Lightning leanings are written as Wind (Q86). Hazard odds per pool are first pass: 30% in the Forge Ruins, Faceless City and Apostate Court, 10% in the wilds (Beast Lands, Hollow Wood, Deep Cold, Dragon Reaches), 20% elsewhere.
- **Enemy files are listed by a generated index** (`content/enemies/index.gen.ts`, `npm run gen:content`) so a pool's 15–25 files need no hand-written imports; the content test fails while the index is stale.
- **The encounter builder** (`combat/encounter.ts`) draws a template by weight among those allowed at the level, draws ranged counts (a Swarm's 4–6), fills each role from the pool's entries whose `levels` span L (different entries before repeats), and places the group: fodder, bruisers, swarms and elites on E1, lurkers E2 then E1, horrors E2, casters, supports and artillery E3, each on the free cells nearest the middle rows, big enemies first. Where §14.4 is silent: **horrors stand on E2** (they seek the Back's Sanity from the middle), and **elites on E1**.
- **Reading taken while pools are thin:** a role the pool has nothing for at the level is filled from the next role in `tuning.encounters.stand` (support → caster → fodder, horror → caster → lurker, and so on), then from anything in the pool at the level. The content lint for "every level fillable for every template" (HANDOFF §6) is switched on per pool as each roster is completed.
- **Openings, first pass:** Ambush and Surprise are each rolled at 10% (`tuning.encounters`; events, traits and the Stalkers template's ×2 move them). Ambush puts the party at CT 0 and the enemy at 50, and gives every lurker a full first turn (CT 100); Surprise is the reverse. Ambushed parties deploy at random (§10.12): that belongs to the expedition's deploy step (Milestone 6).
- **The simulator plays every template** (`npm run sim -- --templates [--pool P] [--levels …]`); `--template any` draws by weight and `--openings` rolls Ambush and Surprise.

## 2026-11-01 (implementation, Milestone 2n: real parties and the balance re-run) — implementer
- **The simulator fights with real Scions** (`combat/roster.ts`): rolled recruits promoted into the Job (advanced Jobs through their prerequisites, with the first prerequisite as the secondary set), levelled through the growth accumulator, `tuning.sim.jpPerLevel` (300) JP per level spent on the Job's actives then passives in content order, passives equipped to the budget, and real items from `items.json` at the level's tier (Common, Fine from Scion level 6, Masterwork from 15) and item level L. Each Job has a sim loadout and column (`LOADOUTS`, a first guess). `npm run sim -- --jobs a,b,c,d` fights with one; `npm run sim -- --sweep` puts each Job in place of the baseline member of its column (Soldier, Knight, Vagabond, Soothsayer) at each level. The stand-in party stays the default so earlier numbers compare.
- **Balance re-run** (Barrows warband, 100 battles each, win % / party HP lost):

| Party | L1 (Scion 3) | L3 (9) | L6 (18) | L10 (30) |
|---|---|---|---|---|
| Baseline | 99% / 36% | 98% / 46% | 75% / 63% | 51% / 79% |
| Magus | 100% / 30% | 100% / 32% | 98% / 38% | 82% / 58% |
| Soothsayer | 100% / 42% | 100% / 34% | 99% / 34% | 92% / 48% |
| Pugilist | 95% / 58% | 64% / 75% | 36% / 86% | 15% / 93% |
| Minstrel | 100% / 37% | 99% / 47% | 85% / 62% | 56% / 75% |
| Gambler | 100% / 39% | 100% / 41% | 86% / 56% | 51% / 78% |
| Ravager | 100% / 38% | 100% / 38% | 99% / 38% | 81% / 60% |
| Sword Saint | 99% / 33% | 100% / 28% | 100% / 30% | 99% / 36% |
| Abjurer | 100% / 36% | 100% / 36% | 90% / 42% | 55% / 71% |
| Conjurer | 100% / 24% | 100% / 25% | 100% / 24% | 98% / 33% |
| Tinkerer | 100% / 30% | 99% / 35% | 99% / 41% | 86% / 57% |
| Alterer | 90% / 63% | 98% / 45% | 82% / 57% | 49% / 77% |

- **What it shows** (nothing retuned yet; Milestone 3 rebuilds enemy scaling and rosters):
  1. Real parties fall behind as levels climb (the baseline wins 99% at L1 but 51% at L10, losing four-fifths of its HP), where the stand-in party with placeholder gear did not; the gap is armor and weapon power from items against the enemy blocks, and injury rolls climbing with Durability that does not grow with level (Q87).
  2. A second healer (Soothsayer in the Back) or a Conjurer's summons carry the party at every level: sustain and soaking hits are worth more than damage right now.
  3. The Sword Saint is far ahead (99% at L10, 3 turns a fight): Thousand Cuts' 150% to a 3×3 burst with a greatsword clears a warband. It and the Ravager's two-handed power are the first knobs to look at.
  4. The Pugilist and the Alterer fall off in the Front in light armor; the Pugilist is understated because the bots do not chain combos or play finishers yet, and the Alterer's Form abilities are placeholders.
  5. The Gambler fights from the Back with a crossbow in the sim; in the Front with two knives it lost most fights past L3, which says light-armored dual wielders need protecting.

## 2026-11-01 (implementation, Milestone 2m: dual wield) — implementer
- **Who may dual wield**: the spec says "a Scion whose Job allows dual wield" but the Job table has no such column, so the reading is that any Job may pair two one-hand weapons it is allowed to wield (a Soldier a sword and an axe, a Vagabond two knives; a Magus can hold a knife but not a sword in the off hand). Two-handers still clear the off hand.
- **In battle**: the off hand strikes after every basic Attack (not after abilities), with its own weapon's power, accuracy, crit, reach and on-crit status, at 50% power (80% with Dual Wield Mastery, now live). Properties of every worn item already add up into the Scion's mods, so both weapons' properties apply to both hands. Ambidextrous and Clumsy will be `offHandPct` mods when individual traits arrive (Milestone 5); Twinned still waits.
- **New knob**: `tuning.combat.dualWield` (50 / 80).

## 2026-11-01 (implementation, Milestone 2l: the Alterer's Forms) — implementer
- **Forms are content** (`content/forms.json`, schema `forms.schema.json`): the six drafted Forms with their duration, control, mods while shifted, statuses held for the Form's length, size and HP changes, what Graft lends, and the Revert price. The six Shifts, Revert, Graft and Molt and four passives are in `content/abilities/alterer.json`.
- **Rules as built** (§12.2): a Shift replaces the Alterer's abilities with the Form's (the tools and other Shifts stay available), puts the Form's mods on a status that cannot be Dispelled or cured, and ends on Revert, on its own time (Long Shift +150 ticks), or when another Shift replaces it (paying the old Form's price). Revert restores abilities, size, max HP and Guard; Stable Flesh halves Revert prices (durations and amounts). A feral Form picks one of its abilities at the start of each turn and nothing else may be used, Attack included; Wild Blood's 50% lets the Alterer choose instead. Bots shift when they have no Form and never Revert on their own.
- **Placeholder Form abilities**: the spec gives each Form's effects but not its ability list (only Rift Spawn's Nova, Swarm and Tempest), so each controlled Form has two plain ones (Werewolf Claw and Pounce, Ember Lash and Flare, Marsh Grasp and Mire, Colossus Crush and Quake, Shrike Talons and Dive). Josh said ability lists are to be iterated after the build (batch 9).
- **Readings**: the Werewolf's "attacks cost 70 CT" applies to its Form abilities; the Stone Colossus grows into the cell below, or above if that one is taken (no room: no Shift); "cannot be healed" holds HP where it is; the Shrike's HP ×0.7 lowers max HP and caps current HP, and Revert gives back only the max; Graft lends each Form's single listed passive (Werewolf: the drain; Ember: Burn immunity; Marsh: Poison immunity; Colossus: Readiness immunity; Shrike: Speed +1; Rift: Fear immunity). The Ember Elemental's ally aura, Hybrid and Chimera need a choice of Form passive and wait for a later pass.

## 2026-11-01 (implementation, Milestone 2k: the Tinkerer) — implementer
- **Components** (§12.2): at the start of each Tinkerer turn (Scavenge: 3, Tinker's Eye 4) distinct Components are offered; the action names the one kept (two with Scavenger), and a kept Component can be used that same turn. With none named, the bots' pick applies: the Component that brings the nearest recipe closest to done. The rest of the offer is lost; held Components last the battle.
- **Constructs are summons** (`summons.json`: Turret, Shield Drone) on the same engine and the same binding cap of 2 as the Conjurer's. The Turret stands still and only follows hits: every ally's physical hit on a Marked target draws a 50% shot from it (a follow-up sets off no other, and counters do not trigger it). The Shield Drone acts every 150 CT and tops the weakest ally's Shield up to 15% of their max HP rather than stacking. Field Engineer applies to any construct-tagged summon, the Stone Sentinel included.
- **Readings**: Bolt uses a held Lens automatically to never miss (Precision adds +10% crit to it); Grapple Line pulls one column toward the gap if the cell is free; Overclock gives 30 CT and the existing instant-charge flag; Repair restores 30% Durability on the target's worst location, or 40% HP on a construct; Flashbang's Readiness damage applies without a damage roll. Shrapnel Mine (traps), Jury-Rig (needs consumables) and Pack Rat (Components carried between battles) wait for later passes.

## 2026-11-01 (implementation, Milestone 2j: the Conjurer's summons) — implementer
- **Summons are content** (`content/summons.json`, schema `summons.schema.json`): the eight drafted summons, each with a column, a size, a duration, HP as a % of the Conjurer's max HP, attack as a multiple of the spell power block at the Conjurer's level (scaled by the Conjurer's Acuity), Speed relative to the Conjurer's, and abilities from its own point of view. The twelve Summoning actives and four passives are in `content/abilities/conjurer.json`; Legion is `bindingCap +1`.
- **Rules as built** (§12.2): a summon is a combatant on the party's grid with `owner`, acting on its own CT through the bots' default gambits; it dies at 0 HP (no Down, no injury rolls) and vanishes at battle end; the party is defeated when no Scion stands, whatever summons remain. The binding cap counts calls, not bodies (two Carrion Crows are one binding), and a binding frees when the last body of its call falls.
- **Readings**: a summon appears in its column (Front, Back, or the Conjurer's own for "any") on the free row nearest the Conjurer — the cell picker can come with the battle screen; summoning with no free cell is refused. Carrion Crows start Provoked to draw fire; the Drowned Choir's −10% accuracy is a status on every enemy present when it arrives, ending with it; the Ember Imp's death burst lands on the enemy grid across from it (burst:3x3 centred on the enemy Front in its row), only when it dies to a blow; the Hollow Host arrives with 100 CT so it strikes at once; Sacrifice heals every non-summon ally in the 3×3 around the summon; Banish kills any non-boss summon or `add`-tagged enemy and does nothing else; Familiar's Crow is one body and takes a binding; summons' own abilities cost no MP for now (the shared MP pool matters once a summon has an MP ability).
- **New knob**: `tuning.combat.summons` (cap 2, accuracy 90).

## 2026-11-01 (implementation, Milestone 2i: the Abjurer) — implementer
- **The Abjurer's full drafted set** (§12.14): fifteen actives (the six Brands counted singly) and four passives, plus Warded and Aegis (+25% on Shields cast).
- **Readings**: Barrier and Bulwark add to any Shield already up (Shields stack, §10.8); Dispel removes every buff and Purge the most recent one, songs included; Reflect turns back hostile spells only (heals and support are not reflected, and a reflected spell cannot bounce again); a Brand replaces the weapon's element on every physical hit and a new Brand replaces the old; Null Zone is its own status (no resist roll, unlike Silence) that blocks spells and ends a spell being charged; Silence is 85% before the target's mental resist; Counterspell rolls once per Abjurer beside any target of a hostile spell, and on a success the whole spell is cancelled; Thick Skin is a `start.shell` mod, so any passive can now start a battle with a status. Ward-Sense is a display rule and waits for the battle screen.

## 2026-11-01 (implementation, Milestone 2h: the Ravager and the Sword Saint) — implementer
- **Both advanced melee Jobs have their full drafted sets** (§12.12–12.13): ten actives and four passives each, with JP prices, plus Ironhide, Deathless, Focus and Iaijutsu. Taking the Job already needs its prerequisite JP (Soldier 400; Soldier 400 + Knight 400).
- **Effects as statuses with mods**: Steal Strength (Might ±10% as `mightPct`), Frenzy (attacks −30 CT, accuracy −15, no Defend), Unstoppable (immune to Knockdown, Stun, Fear; +1 step on every injury roll). Any status can now carry mods, and `immune.<status>` mods block a status (Thick Blood is `immune.bleed`).
- **Readings**: Whirl hits the enemy's whole front column ("every enemy in reach"); Reckless Swing's Evasion −20 lasts until the Ravager's next turn; Blood Price costs 15% of max HP and cannot be used at or below that; Hold Together caps all healing (spells, restores, Regen, drains) at 50% of max HP for the rest of the battle; Draw Cut's "+crit" is +50% crit chance on the user's first turn; Executioner always crits a Marked target; Zenith Strike cancels any charge, bosses' included, before its Stun; Mirror Stance counters every melee hit (ranged and spells are not countered) while the Sword Saint has 20 TP, ending at their next turn; Sheathe's "20 CT sooner" is 20 CT off its own 60; Still Water's +20% goes to the next ability that deals damage; Iaijutsu frees the first TP-costing ability used with a sword; Breath of Steel (+100 ticks) applies to every timed buff the Scion casts with MP, the same mod Lasting Wards will use.
- **New knobs** in `tuning.combat.jobs`: Hold Together's cap, Iron Will's 30% threshold, Mirror Stance's 20 TP, One Cut's ×2, Still Water's 20%.

## 2026-11-01 (implementation, Milestone 2g: the Pugilist) — implementer
- **A combo is one action**: a list of moves on one target, each paying its TP (+5 for every earlier use of the same move in the sequence), ended by a finisher or by the list. The whole costs 100 CT +10 per move past the third (§12.2). A lone move is a sequence of one, so a finisher can never open a turn; bots do not use finishers yet.
- **Patterns**: a finisher's pattern must be the tags of the moves just before it (Flurry: jab, jab, jab); Hundred Fists needs five different moves before it. Hook and Palm Strike are tagged jab, Low and High Kick kick, Grapple and Throw grapple, Breath breath (§12.10).
- **Readings**: Grapple Roots the target for 100 ticks (the "cannot counter" part waits); Throw deals its 80% but moving the target waits for forced movement; Hundred Fists' 300% is shared equally among everyone in the burst; Iron Fists sets bare-hand power to level × 2 when that is higher; Counterpunch adds its 25% only bare-handed. Flow (the innate) and Second Breath wait for a later pass.

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

Batches 1–12 (answered 2026-10-31 / 2026-11-01): Q1–Q84 closed, see above. Q86 and Q88 answered 2026-11-01; Q90 (who picks an expedition event's option) answered 2026-11-02. The design is handed off; see HANDOFF.md.

- **Q85 (asked 2026-11-01, Milestone 0): how is a House's Standing tier worked out?** §3.4 names the four tiers (Waning / Steady / Rising / Ascendant) but not the rule, and it decides how much the other Houses can read. Built as the default, PROPOSED: a House's Ascendancy divided by the kingdom's mean, Waning below 0.75, Steady 0.75–1, Rising 1–1.25, Ascendant 1.25 and up; Steady when solo or before anyone scores. Alternatives: tiers by rank (the leader is always Ascendant, which tells everyone who leads), or fixed Ascendancy thresholds that rise with the Year (tiers say how well a House does, not how it compares).
- **Q89 (asked 2026-11-01, Milestone 4f): should a House event be private to its House?** §8.8 gives each House its own events (the Cousin's Claim, the Locked Wing…) but does not say whether rivals see them. Built as public (the Town Map's log shows them, and their choices) until Josh decides. Private would make them like the recruit pool: the House sees the event and its outcome, the others see nothing, or only "House X has troubles at home". **Answered 2026-11-01 by Josh: private, with a hint** (rivals see only that the House has troubles at home).
- **Q92 (asked 2026-11-02, Milestone 7f): what is Piety?** §14.7a and §14.9 use it (Pious Houses lose Piety for a Dark Bargain; kneeling to an Idol loses Piety, killing one gains it), but nothing defines it. Recommended: fold it into Renown, so kneeling or a Pious House's bargain costs Renown and killing an Idol gains it. Alternatives: a hidden 0–100 Piety track per House that the Chapel and holy events read; or drop Piety. **Built meanwhile as the recommendation** (Renown, `tuning.idol.renown`).
- **Q93 (asked 2026-11-02, Milestone 7f): which gods are Idols?** §14.9 names six pantheons, the Hindu, Persian and Chinese among them, and Idols are false gods the Houses may kill. Those pantheons, unlike the Greek, Sumerian and Egyptian, are worshipped today. Recommended: their Idols are the myths' own demons and usurpers (a rakshasa king, a div of Ahriman, a demon king of the western road), not their gods. The first three Idols built are a Greek, a Sumerian and an Egyptian god, given titles rather than names (the Thunderer, the Lord Below, the Weigher of Hearts).
- **Q91 (asked 2026-11-02, Milestone 6g): how does a `secret` expedition event resolve?** §9.4: "each player picks secretly; revealed together", for betrayal-shaped events. The picks stay hidden until all are in. It does not say what the reveal does. Recommended: each House's pick happens to its own Scions, and an outcome may depend on what the others chose ("if anyone else took the bribe…"). Alternatives: each House's pick alone decides its result; or a hidden majority vote for the whole party. **Answered 2026-11-02 by Josh: each House's own pick happens to its own Scions, and others' picks matter** (an outcome may depend on what the other Houses chose).
- **Q87 (asked 2026-11-01, Milestone 1): should Durability grow with level?** The simulator finds injury rolls in an ordinary fight climbing from 0.1 at L1 to about 6 at L10, because §7.3's Durability (10–15 + 1.5–2 × a stat) grows slowly while enemy damage grows about fivefold. A level term (+1 or +2 Durability per level on every location) brings L10 to about 2–3 rolls; heavier armor in Milestone 2 may do the rest. Built as specified (no level term) until Josh decides; `formulas.durabilityPerLevel` is the knob. **Answered 2026-11-01 by Josh: no level term (keep it as specified).** Pass 1 had set it to 2; Milestone 3x puts it back to 0 and lowers `combat.enemyLevelFactor` instead.


Implementation items (not design questions):
- LPC sprite runtime: the folder holds one exported male base; runtime recruit generation needs the generator's full layer set exported with its per-layer `CREDITS.csv`.
- Oryx: confirmed free to use by Josh (2026-11-01); the credit line in CREDITS.md stands.
