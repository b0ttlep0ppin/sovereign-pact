#!/usr/bin/env python3
"""Cuts the enemy sprites the game ships from the Pixel Material Studio 1000-Monster Mega Packs.

Reads content/sprites/manifest.json (each sprite's id, source file and flip), crops each source PNG to
what it draws, mirrors it if flipped, applies its colour tweak if it has one (tools/sprite_tweak.py, the
Bestiary's sliders), and writes public/sprites/sovereign-pact/enemies/<id>.webp
(lossless). The packs themselves never go in the repo (their license forbids redistribution).

Usage: tools/cut-monsters.py <folder holding "Mega Pack 1" and "Mega Pack 2">
(the unzipped "1000-Monster Mega Pack" and "1000-Monster Mega Pack 2" folders, renamed).
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps

from sprite_tweak import tweak

root = Path(__file__).resolve().parent.parent
packs = Path(sys.argv[1])
manifest = json.loads((root / "src/shared/games/sovereign-pact/content/sprites/manifest.json").read_text())
out = root / "public/sprites/sovereign-pact/enemies"
out.mkdir(parents=True, exist_ok=True)
for s in manifest["sprites"]:
    im = Image.open(packs / s["source"]).convert("RGBA")
    im = im.crop(im.getbbox())
    if s["flip"]:
        im = ImageOps.mirror(im)
    im = tweak(im, s.get("tweak"))
    im.save(out / f"{s['id']}.webp", "WEBP", lossless=True, method=6)
print(f"{len(manifest['sprites'])} sprites cut into {out}")
