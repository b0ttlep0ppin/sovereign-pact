#!/usr/bin/env python3
"""Cuts the battle backdrops the game ships from the Oryx Design Lab megapack.

The sky is 32 Gothic's moonlit background; each region's ground is one floor strip from Ultimate
Fantasy's terrain sheet. Writes public/sprites/sovereign-pact/backdrops/sky.webp and
ground-<region>.webp. The packs themselves never go in the repo: only these cuts ship.

Usage: tools/cut-backdrops.py <the "oryx_megapack" folder>
"""
import sys
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parent.parent
oryx = Path(sys.argv[1])
out = root / "public/sprites/sovereign-pact/backdrops"
out.mkdir(parents=True, exist_ok=True)

sky = Image.open(oryx / "oryx_32_gothic/crl_background.gif").convert("RGB")
sky.save(out / "sky.webp", "WEBP", quality=72, method=6)

# Each region's floor: the top-left corner of a 192×48 strip (four 48 px tiles) on uf_terrain.png.
GROUND = {
    "beast_lands": (240, 288),  # grass
    "hollow_wood": (48, 336),  # dark earth, roots and stones
    "drowned_marches": (720, 336),  # green swamp water
    "barrows": (48, 240),  # grey grave dirt
    "deep_cold": (240, 384),  # blue-grey flagstones
    "pit": (720, 480),  # lava
    "forge_ruins": (240, 480),  # dark slag stone
    "faceless_city": (240, 432),  # brown paving
    "apostate_court": (240, 240),  # old boards
    "shrine_of_six": (48, 432),  # pale sand
    "dragon_reaches": (240, 336),  # dry grass
    "outer_dark": (720, 384),  # still dark water
}
terrain = Image.open(oryx / "oryx_ultimate_fantasy_1.2/uf_terrain.png").convert("RGB")
for region, (x, y) in GROUND.items():
    terrain.crop((x, y, x + 192, y + 48)).save(out / f"ground-{region}.webp", "WEBP", lossless=True, method=6)
print(f"sky and {len(GROUND)} grounds cut into {out}")
