# Credits and licenses — The Sovereign Pact

Source folder on Josh's PC: `C:\Users\josh\Desktop\decompilation\assets\`. Every author below must appear in the in-game Credits screen. Survey dates: 2026-10-31 (sprites, music, SFX), 2026-11-01 (monster packs file by file, Oryx sets).

## Enemy sprites — `mega pixel pack\`
- **1000-Monster Mega Pack** and **1000-Monster Mega Pack 2** by **Pixel Material Studio**.
- License: commercial use OK; editing, recoloring, resizing OK; credit not required but appreciated; redistribution or resale of the assets themselves (or edited variants as standalone assets) NOT OK; no hate/harassment use.
- Implication: ship sprites only inside the game build; do not expose a downloadable sprite sheet or asset pack.
- Shipped (2026-11-02, Milestone 8s): 339 cut pictures in `public/sprites/sovereign-pact/enemies/`, one per enemy, boss, summon and hazard, listed with their source files in `src/shared/games/sovereign-pact/content/sprites/manifest.json` and cut by `tools/cut-monsters.py`. The packs themselves are never committed.

## Scion sprites — `universal spritesheet generator\`
- **Universal LPC Spritesheet Character Generator** (Liberated Pixel Cup). https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator
- Exported layers so far (one male base): body by bluecarrot16, JaidynReiman, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sjölund (wulax), Stephen Challener (Redshrike); head by bluecarrot16, BenCreating, Redshrike; face by JaidynReiman, ElizaWy, Redshrike.
- Licenses: OGA-BY 3.0 / CC-BY-SA 3.0 / GPL 3.0 (per layer). Every layer used needs its authors credited; `credits.txt` and `license-detailed.txt` in the folder list them. CC-BY-SA share-alike applies to modified sprite art.
- To do: when the full layer set is chosen, generate the credit list from the generator's per-layer `CREDITS.csv`.

## Music — `The Soverign Pact music\`
Author handle taken from each file name. These are Pixabay uploads (same naming as the Pixabay tracks Hardpoint Contract credits); the Pixabay Content License allows use in a game and does not require credit, but we credit anyway, in the form "\"Title\" by Author (pixabay.com/users/<handle>), used under the Pixabay Content License".

| File | Author | Track |
|---|---|---|
| hitslab-irish-celtic-medieval-music-486074.mp3 | HitsLab | Irish Celtic Medieval Music |
| kang_saif-night-market-in-old-town-488416.mp3 | kang_saif | Night Market in Old Town |
| lux_aeterna_2026-dark-fantasy-ambient-558008.mp3 | lux_aeterna_2026 | Dark Fantasy Ambient |
| lux-aeterna-dark-fantasy-music-567686.mp3 | Lux Aeterna | Dark Fantasy Music |
| menieldm-shadows-beneath-the-keep-495833.mp3 | MenielDM | Shadows Beneath the Keep |
| mroneilovealot-crimson-horizon-…-409985.mp3 | mroneilovealot | Crimson Horizon |
| nakaradaalexander-kingsfall-624173.mp3 | Alexander Nakarada | Kingsfall |
| nastelbom-dark-epic-487720.mp3 | nastelbom | Dark Epic |
| nojisuma-light_blocking-493516.mp3 | nojisuma | Light Blocking |
| nojisuma-on_the_way_home-468318.mp3 | nojisuma | On the Way Home |
| nojisuma-winter_sky-591061.mp3 | nojisuma | Winter Sky |
| ob-lix-the-faded-rose-…-109375.mp3 | Ob-Lix | The Faded Rose |
| ob-lix-the-spell-dark-magic-…-8009.mp3 | Ob-Lix | The Spell |
| onecinematicstudio-the-lost-city-of-atlantis-…-529056.mp3 | OneCinematicStudio | The Lost City of Atlantis |
| openmindaudio-japanese-gaming-boss-battle-music-624650.mp3 | OpenMindAudio | Japanese Gaming Boss Battle Music |
| phatphrogstudio-…-anime-battle-music-478168.mp3 | PhatPhrogStudio | Anime Battle Music |
| phatphrogstudio-samurai-spirit-cursed-oni-…-502868.mp3 | PhatPhrogStudio | Samurai Spirit: Cursed Oni |
| welc0mei0-bgm006-dark-fantasy-lo-fi-retro-game-148338.mp3 | welc0me.i0 | BGM006 Dark Fantasy Lo-fi |

Shipped (2026-11-02, Milestone 8r): all 18, encoded by `tools/encode-music.sh` into `public/music/sovereign-pact/<name>.ogg` (Opus 48 kb/s, −16 LUFS, cut to 3 minutes at most with a 4 s fade). The credit lines are in `src/client/games/sovereign-pact/credits.ts`, shown on the Credits panel.

## Sound effects — `BoomLibrary Commercial SFX\`
- **BOOM Library** (commercial license; the folder zip is ~43 GB). Libraries present: Close Combat (Construction Kit, Designed), Creature Foley (Designed), Free Sounds – Death Whistle, Magic – Arcane Forces (Construction Kit, Designed), Magic (Construction Kit, Designed), Medieval Weapons (Construction Kit, Designed).
- Josh's BOOM Library license covers cuts used inside a game (confirmed for Hardpoint Contract on Vibe Pulse #708). Ship processed cuts only, never the source packs. Credit line, as Hardpoint uses: "Sound effects cut from BOOM Library packs (boomlibrary.com: …), used under its license."
- Shipped (2026-11-02, Milestone 8t): 126 takes of 46 battle cues in `public/sfx/sovereign-pact/`, from Close Combat, Creature Foley, Death Whistle, Magic, Magic – Arcane Forces and Medieval Weapons (all "Designed"), listed with their source files in `src/shared/games/sovereign-pact/content/audio/sfx.json` and cut by `tools/cut-sfx.py`.

## Backgrounds and town tiles — `oryx_megapack8\oryx_megapack\`
- **Oryx Design Lab** megapack (checked 2026-11-01). Sets present: 16-bit Fantasy 1.1 (24×24 tiles: `Sliced\world_24x24`, `creatures_24x24`, `classes_26x28`, `fx_24x24`, `fx_32x32`, `items_16x16`, plus `TMX Source`), Ultimate Fantasy 1.2 (16 px: `uf_terrain.png`, `uf_heroes.png`, `uf_items.png`, `uf_FX.png`, `uf_interface.png`, `uf_portraits.png`, `uf_map.png`, `uf_split\`), 32 Gothic (`crl_*` sheets: terrain, terrain_night, chars, mons32/48, effects, items, interface, portraits, slashes), and sets this game does not use (16-bit Sci-Fi, 8-bit bundle, 8-bit sounds, Classic Roguelike, Roguelike 2.0, Tiny Dungeon, Tiny Galaxy, Wee Dungeon).
- License: no license file sits in the megapack folders. Oryx's product pages state each pack "includes royalty free commercial license and source files" (oryxdesignlab.com/products/p/16-bit-fantasy-tileset, oryxdesignlab.com/ultimatefantasy); credit is not stated as required. Treat it like the monster packs: use inside the game build only, never ship the raw sheets or the TMX/PSD sources, never expose them as a downloadable pack. Credit line to use: "Tiles and backgrounds built from Oryx Design Lab tilesets (oryxdesignlab.com: 16-bit Fantasy, Ultimate Fantasy, 32 Gothic), used under their royalty-free commercial license." Josh confirmed on 2026-11-01 that the packs are free for this use; the license text that came with his purchase is the authority if it says more about attribution.

## Out of scope
`hardpoint music\` (doesn't fit this game).
