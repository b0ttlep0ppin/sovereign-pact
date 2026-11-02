# Glossary — The Sovereign Pact

Canonical terms. Code identifiers, UI text and the spec use these spellings. **Status:** ✅ confirmed by Josh · ❓ proposed, awaiting confirmation.

| Term | Meaning | Status |
|---|---|---|
| Great House (House) | A player-controlled noble family. "Noble House" is a synonym; prefer "Great House" / "House" in UI and code. | ✅ |
| Kingdom / the City | The capital torn into the otherworld with the Houses. Name TBD. | ❓ |
| Year | One campaign turn: Omens → Settlement Phase → Expedition Phase → Reckoning. A full campaign is 20 Years. | ✅ (Year, 20); ❓ (step names) |
| Settlement Phase | Town Map building phase, co-op and solo. | ✅ |
| Expedition Phase | Party departs, events, boss. | ✅ |
| Expedition Leader | Scion chosen at departure; a common event resolution target. | ✅ |
| Recruit | A candidate in a House's pool, not yet usable on expeditions. | ✅ |
| Scion | A promoted recruit; equipped and sent on expeditions. | ✅ |
| Ward | A Scion donated by one House to another; loyalty may be mixed. | ✅ |
| Retired | Scion no longer fielded (maimed or injured); can Mentor; may be pressed back into service. | ✅ |
| Mentor | Retired Scion assigned to train recruits/Scions; can be loaned to other Houses. | ✅ |
| Flavor Mode / Crunch Mode | House-creation display rule: evocative text only / evocative text plus exact effects. | ✅ |
| Major Trait, Minor Trait, Major Flaw, Minor Flaw | House trait categories. | ✅ (structure flexible) |
| Elemental affinity | % resistance or weakness to an element. Elements: Holy, Dark, Fire, Water, Earth, Wind (opposed pairs proposed). Lightning is Wind, not an element of its own. | ✅ / ❓ (pairs) |
| Tarot | Random small innate bonus per Scion; also an event trigger. | ✅ |
| HP, Mana (MP), Tactical Points (TP) | Resource pools. MP persists between combats; TP is per-combat. | ✅ |
| Might, Resilience, Guile, Acuity, Sagacity, Speed | Core stats. | ✅ |
| Hit locations | Head, Body, Arms, Legs. "Hands" = Arms. | ✅ |
| Durability | Per-location pool that absorbs hits before an injury roll. | ✅ |
| Sanity | Mental pool; depletion triggers the sanity table. | ✅ |
| Injury table | Location-specific "death's door" roll when a location (or HP) is depleted. | ✅ |
| CT / Readiness / clock ticks | Synonyms for the value each entity gains equal to its Speed every tick; at 100 it takes a turn. Code: `ct`. UI label: "CT", prose: "Readiness". | ✅ |
| Tick (clock tick) | One clock step. Durations like "500 ticks" are measured in these. | ✅ |
| Charge | Delay between choosing and resolving a charged ability. | ❓ (name) |
| Job | Combat role chosen per expedition. | ✅ |
| Ability set | A Job's named active list (e.g. Warfare). Primary = own Job's; secondary = one other Job's. | ✅ |
| Passive budget | Points for equipping passives across learned Jobs. | ✅ |
| Doom | Shared 0–100 pressure track; rises on failed mandatory expeditions; at 100 the city is overwhelmed (campaign lost). | ✅ |
| Accord | Shared 0–100 track of inter-House trust; at 0 the Houses fall to infighting (campaign lost). | ✅ (to playtest) |
| Ascendancy | A House's hidden total score (8 categories). | ✅ |
| Standing | The rough tier of another House's Ascendancy you can see (Waning/Steady/Rising/Ascendant). | ✅ |
| Ambition | Secret per-House scoring modifier (doubles one category, halves one). | ✅ |
| Sovereign | The House with the highest Ascendancy when the campaign is won. | ✅ |
| Mandatory expedition | Do-or-die expedition at a fixed point in the timeline. | ✅ |
| Resource expedition | Optional expedition for building/crafting materials and shop unlocks. | ✅ |
| Crisis | Settlement event needing private pledges from Houses; withholding is the subtle-sabotage mechanic. | ✅ |
| Unrest | Solo-play replacement for Accord: the common folk's patience; at 0 they revolt. | ✅ |
| Devastation | The settlement-wide consequence of a failed mandatory expedition. | ❓ |
| Bloodline | A macabre House trait that fills one Major Trait slot and the Major Flaw slot (e.g. Demon-Blooded). | ✅ |
| Seat | The House's home on the Town Map (Keep, Chateau, Manor…); purely cosmetic. | ✅ |
| Table option | A host-set campaign setting (Vibe Pulse term), e.g. Flavor/Crunch Mode. | ✅ |
| XP / JP | Experience (levels, stats) and Job Points (buys a Job's abilities and passives). | ✅ |
| Sortie | A gambit-driven auto-battle foray for Scions not on the Year's expedition. | ❓ (name) |
| Gambit | A Scion's priority rule for automated combat ("Heal ally below 50%"). | ✅ (Josh's word) |
| Loyalty | A Ward's hidden 0–100 attachment to its host House. Sworn ≥ 80, Estranged ≤ 10. | ✅ |
| Insight | What a House can see of a recruit; set by Scriptorium level 0–3. | ✅ |
| Chronicle | A House's record of dead Scions. | ❓ |
| Fallen (House) | A House with no Scions, recruits or Retired; still plays, can be rebuilt. | ✅ |
| Reinstate | Fielding a Retired Scion again; always allowed, injuries' penalties apply. | ✅ |
| Broken (location) | A hit location at 0 Durability; every further hit there forces an injury roll. | ✅ |
| Treasury / Stores / Commons | A House's Gold; a House's materials; the settlement's shared stockpile fed by the tithe and pledges, spent by vote. | ✅ |
| Essence | Rift resource from expeditions; fuels enchanting and advanced buildings. | ❓ |
| Shared project | A Commons building funded by public pledges; benefits all Houses, credits Renown. | ✅ (concept) |
| Omens | The event step at the start of each Year. | ❓ |
| Reckoning | The end-of-Year step: upkeep, recovery, score, checkpoint. | ❓ |
| Deal | An instant exchange between two Houses within a Year; nothing about the future is tracked. | ✅ |
| Tithe | The automatic share of income and expedition materials that flows to the Commons. | ✅ |
| Year assignment | What each Scion does this Year: Expedition, Sortie, Rest, Chapel, Infirmary, Train, Teach, Study, Work, Guard, Special. | ✅ (concept) |
| Rift Gate | Where expedition cards are offered and the party departs. | ✅ |
| Expedition card | One offered expedition: type, level, party size, pools, rewards. | ✅ |
| Node | One step of an expedition chain: Encounter, Event, Camp, Cache, Fork, Gate, Boss. | ✅ |
| Subject | The Scion an event's effects apply to, chosen by the resolution rule. | ❓ |
| Change | A Scion's permanent transformation (Barrow Knight, Wyrmling…): the record that replaces their stats, traits and look. "Changed into a Barrow Knight." Form stays the Alterer's word. (Josh, 2026-11-02) | ✅ |
| Regent | A House made temporary ruler by an event: allocates seats, names the Leader, decides votes alone. | ✅ (Josh: "dictator/monarch") |
| Seat (expedition) | One place in the party; divided equally among Houses that field Scions. | ❓ |
| Front / Middle / Back | The three player-grid columns, Front nearest the enemy. Unaimed enemy singles: 45/35/20. | ✅ |
| Band (shape) | A block of rows across all columns (`band:3` = a third of the grid). | ❓ |
| Lob | Single-target shape weighted toward the Back column. | ❓ |
| Step (injury) | 2 points on the d20 injury roll. | ✅ |
| Last Stand | The state of a mortally wounded Scion for the rest of the battle; they die when it ends. | ✅ (concept) |
| Cure item | A Relic that removes a permanent injury (Saint's Hand, Clockwork Leg, Seer's Eye, Lethe Water). | ✅ (concept) |
| Base Job / Advanced Job | Jobs available at promotion / unlocked by JP in prerequisites. | ✅ |
| Carry | Weight a Scion bears without penalty: 10 + Might/2. | ✅ |
| Satchel | The party's shared 12-slot consumable bag on an expedition. | ✅ |
| Quality tier | Crude / Common / Fine / Masterwork / Relic. | ✅ |
| Property | A rolled or crafted bonus on gear (Multi-hit, Massive crits, an element edge, Quickening…); many, unique, per item. | ✅ |
| Reforge | Rerolling one property at Forge L2 for Essence. | ✅ |
| Cursed (gear) | Strong gear with a drawback that cannot be removed without an expensive Chapel rite; travels with a Ward. | ✅ |
| Mastery | All of a Job's abilities bought; grants its mastery passive for free. | ✅ |
| Innate passive | A Job's free passive while it is the primary Job. | ✅ (brief) |
| Combo / sequence / finisher | A Pugilist turn of several TP moves; a finisher needs a pattern. | ✅ (brief) ❓ (terms) |
| Component | Tinkerer resource picked each turn (Spring, Gear, Powder, Lens, Wire, Vial, Plate, Core). | ✅ (brief) |
| Cast Lots / Double Down | The Gambler's innate 2d6 roll / rerolling an ability's 2d6 at risk of a fizzle. | ✅ |
| Melody / Harmony / Chorus | The Minstrel's three song layers. | ✅ (brief) |
| Form / Shift / Revert / feral | Alterer shapes; entering; leaving; uncontrolled. | ✅ |
| Binding cap | How many summons a Conjurer may hold at once. | ✅ |
| Devastating / Moderate / Mild / Shrug | Injury bands: permanent / multi-Year / this battle / nothing or a boon. | ✅ (bands) ❓ (Shrug name) |
| Trauma incident | A hidden timeline event queued by a sanity break; fires if the Scion is in town. | ✅ |
| Grit-Marked | Trait for surviving 3 Devastating results. | ✅ |
| Prosthetic | Workshop L2 partial fix for a severed limb or mangled hand. | ❓ |
| Down | A Scion at 0 HP: not single-targetable, still hit by AoE. | ✅ |
| Telegraph | A shown attack shape with a tick countdown. | ✅ (brief) |
| Turn forecast | The predicted next-10-turns bar. | ✅ |
| Readiness damage | Subtracting CT from a target (delay). | ✅ (brief) |
| Lost | A Scion left behind after a wipe; recoverable by a Rescue card for 2 Years. | ✅ |
| Draft (loot) | The haul goes to one pool of shares (an item, a bundle of materials); Houses claim them in turn, in a random order and then snake order. | ✅ |
| Individual trait | A trait on one Scion (Fleet, Brave…), distinct from House traits. | ❓ |
| Potential tier | A recruit's growth quality: Common / Promising / Gifted / Prodigy. | ❓ |
| Pledge | A House's private contribution to a Crisis. | ✅ |
| Auction | A sealed-bid sale in Gold of a coveted shop item (or a House's own item) when more than one House wants it. | ✅ |
| Identify | Scriptorium L2 service that reveals a found item's properties; unidentified finds are drafted blind. | ✅ |
| Named item | A Fine-or-better item with a name, a line of flavor and a distinct property combination. | ✅ |
| Pool (enemy) | A region of the otherworld and its themed roster of enemies; each expedition card names one. | ✅ |
| Role (enemy) | fodder, swarm, bruiser, caster, support, lurker, artillery, horror, elite, colossus, boss. | ✅ |
| Lurker / Artillery / Horror | The three back-line-threat roles: leapers and assassins / lob, column and band attackers / fear, Sanity and Charm attackers. | ✅ |
| Group template | A recipe of roles an Encounter node fills from the pool (Patrol, Warband, Battery, Coven, Swarm, Stalkers, Behemoth, Elite patrol). | ✅ |
| Weak point | An enemy location whose matching location bias deals bonus damage; enemies have no hit locations otherwise. | ✅ |
| Part | A targetable sub-entity of a boss or colossus with its own HP; destroying it removes an ability. | ✅ |
| Variant | A tinted, renamed, stat-shifted version of an enemy (Ashen, Drowned, Hollow, Unknown-touched). | ✅ |
| Hazard | A trap or object entity on the grid that triggers on a condition (Mimic, Alarm Bell, Rockfall…); occasional, never common. | ✅ |
| Quarry | The named elite or boss a Hunt card targets; its Lair replaces one Encounter. | ✅ |
| Arcana (node) | A mini-boss node inside an expedition for one Major Arcana, once per campaign each, drawn to a Scion of that Tarot. | ✅ |
| Idol | An old god from the pantheon sprites met at the end of a Pilgrimage: bargain first, fight if refused. | ✅ |
| The Unknown | The things beyond the rift that the old King bargained with; the Outer Dark's army; the mandatory arc's enemy. | ✅ (fiction, renamable) |
| End Ruler | The Year 20 final boss at the rift's source. | ✅ |
| Dark Bargain | A private, out-of-combat offer to one House: a boon for it or a bane on a rival, never guaranteed, shaped by House traits. | ✅ |
| Pact mark | The hidden scoring cost a House may carry from a Dark Bargain. | ❓ |
| Bestiary | The Scriptorium's record of enemies met; weaknesses and patterns show after 3 kills or a reveal. | ✅ |
| The Wood Court | The wandering yokai and fey sub-pool any card can draw at 10%. | ✅ |
| Cue | A named sound slot an ability, item or UI action plays; maps to 2–4 processed takes. | ✅ |
| Icon strike | The weapon-icon animation drawn over a target on a weapon attack. | ✅ |
| Hit-stop | The short freeze on a critical hit. | ✅ |
| Chit | A Scion's draggable token on the Town Map. | ✅ |
| Settlement theme | The music a House picks at creation for its view of the Town Map. | ✅ |
| Effect tier | The visual size of a spell by its power: one fireball, a burst, a rain. | ✅ |
| Forced expedition | An expedition a rare settlement event makes mandatory this Year. | ✅ |
| Training XP | XP from the Train assignment; capped one level below the Mentor (or by the Yard without one). | ✅ (cap) |
