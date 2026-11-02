#!/usr/bin/env python3
"""Cuts the Scion sprite layers the game ships from the Universal LPC Spritesheet Character Generator.

Reads the generator's sheet definitions for the layers listed in PICK below and keeps only layers
every one of whose credits offers an attribution-only license (OGA-BY, CC-BY or CC0): nothing
share-alike or GPL-only. For each sub-layer it writes one sheet,
public/sprites/sovereign-pact/scions/<id>.webp (lossless): seven rows of 128 px cells, with
the 64 px frames centred in them and oversized weapon swings filling them. The rows are:

  0 idle facing down (the portrait)   1 idle facing left   2 slash   3 thrust
  4 spellcast   5 shoot   6 hurt (falling)

Rows 1-5 face left, toward the enemy across the field. It also writes
src/client/games/sovereign-pact/scion-layers.json: each layer's slot, draw order, recolor material
and credits, plus the generator's palettes. The client assembles each Scion from these pieces and
recolors them for skin, hair and House colors (ScionSprite.tsx).

The generator itself never goes in the repo; only these cuts do, each with its credit line.

Usage: tools/cut-scions.py <a checkout of LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator>
"""
import json
import sys
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parent.parent
gen = Path(sys.argv[1])
out = root / "public/sprites/sovereign-pact/scions"
out.mkdir(parents=True, exist_ok=True)

# slot -> option -> sheet definition (relative to sheet_definitions/), or several drawn together, and
# the metal or color file to take where a layer comes in several.
PICK = {
    "body": {"body": "body/body.json"},
    "head": {
        "male": "head/heads/human/heads_human_male.json",
        "female": "head/heads/human/heads_human_female.json",
        "male_elderly": "head/heads/human/heads_human_male_elderly.json",
        "female_elderly": "head/heads/human/heads_human_female_elderly.json",
    },
    "hair": {
        **{k: f"hair/short/hair_{k}.json" for k in ["plain", "parted_side_bangs", "page", "swoop_side", "cowlick", "idol", "single", "curtains"]},
        **{k: f"hair/long/hair_{k}.json" for k in ["long_straight", "wavy", "curtains_long", "long_messy"]},
    },
    "beard": {"trimmed": "hair/beards/beards_trimmed.json", "medium": "hair/beards/beards_medium.json"},
    "legs": {"pants": "legs/pants/legs_pants.json"},
    "feet": {"boots": "feet/boots/feet_boots_basic.json"},
    "shirt": {
        "longsleeve": "torso/shirts/longsleeve/torso_clothes_longsleeve.json",
        "tshirt": "torso/shirts/shortsleeve/torso_clothes_tshirt.json",
        "sleeveless": "torso/shirts/sleeveless/torso_clothes_sleeveless2.json",
    },
    "armor": {"chainmail": "torso/torso_chainmail.json", "plate": "torso/armour/torso_armour_plate.json", "leather": "torso/armour/torso_armour_leather.json"},
    "cape": {"solid": "torso/cape/cape_solid.json"},
    "hat": {
        "wizard": "headwear/hats/magic/hat_magic_celestial.json",
        "hood": "headwear/coverings/hoods/hat_hood_cloth.json",
        # The cap and its feather are two definitions; both are drawn.
        "cavalier": ["headwear/hats/caps/hat_cap_cavalier.json", "headwear/hats/caps/hat_cap_cavalier_feather.json"],
        "bandana": "headwear/coverings/bandana/hat_bandana.json",
        "tricorne": "headwear/hats/tricorne/hat_tricorne.json",
        "mail": "headwear/helmets/helmets/hat_helmet_mail.json",
        "nasal": "headwear/helmets/helmets/hat_helmet_nasal.json",
    },
    "weapon": {
        "sword": "weapons/sword/weapon_sword_arming.json",
        "longsword": "weapons/sword/weapon_sword_longsword.json",
        "mace": "weapons/blunt/weapon_blunt_mace.json",
        "dagger": "weapons/sword/weapon_sword_dagger.json",
        "staff": "weapons/magic/weapon_magic_simple.json",
        "bow": "weapons/ranged/bow/weapon_ranged_bow_normal.json",
        "crossbow": "weapons/ranged/weapon_ranged_crossbow.json",
    },
    "shield": {
        "heater": "weapons/shields/heater/shield_heater_paint.json",
        "round": "weapons/shields/shield_round.json",
        "scutum": "weapons/shields/scutum/shield_scutum.json",
    },
}
VARIANT = ["steel", "simple", "dagger", "crossbow", "normal", "mace"]
BY = ("OGA-BY", "CC-BY 3", "CC-BY 4", "CC0")

# Our rows: (generator animation, LPC row: 0 up, 1 left, 2 down, 3 right; frames).
ROWS = [("idle", 2, 2), ("idle", 1, 2), ("slash", 1, 6), ("thrust", 1, 8), ("spellcast", 1, 7), ("shoot", 1, 13), ("hurt", 0, 6)]
# Where a layer lacks an animation, the one whose first frames stand in for it.
FALLBACK = {"idle": ["walk", "combat_idle"], "slash": [], "thrust": [], "spellcast": [], "shoot": [], "hurt": []}
CELL = 128
COLS = max(n for _, _, n in ROWS)


def find(base: Path, anim: str) -> Path | None:
    """The file a layer draws `anim` with: <anim>.png, or <anim>/<variant>.png."""
    for a in [anim, *FALLBACK[anim]]:
        if (base / f"{a}.png").exists():
            return base / f"{a}.png"
        if (base / a).is_dir():
            for v in VARIANT:
                if (base / a / f"{v}.png").exists():
                    return base / a / f"{v}.png"
            files = sorted((base / a).glob("*.png"))
            if files:
                return files[0]
    return None


def custom(base: Path) -> Path | None:
    """An oversized animation's single sheet: <dir>.png or <dir>/<variant>.png."""
    for v in VARIANT:
        if (base / f"{v}.png").exists():
            return base / f"{v}.png"
    if base.with_suffix(".png").exists():
        return base.with_suffix(".png")
    files = sorted(base.glob("*.png")) if base.is_dir() else []
    return files[0] if files else None


manifest = {"rows": [r[0] for r in ROWS], "frames": [r[2] for r in ROWS], "cell": CELL, "layers": [], "palettes": {}, "credits": []}
seen_credits = set()
for slot, opts in PICK.items():
    for oid, rels in opts.items():
        for part, rel in enumerate([rels] if isinstance(rels, str) else rels):
            d = json.loads((gen / "sheet_definitions" / rel).read_text())
            # Only the credits of the files we cut (a definition also credits its child or teen art).
            used = [layer[sex] for k, layer in d.items() if k.startswith("layer_") for sex in ("male", "female") if sex in layer]
            d["credits"] = [c for c in d.get("credits", []) if any(u.startswith(c["file"].rstrip("/") + "/") or u.rstrip("/") == c["file"].rstrip("/") for u in used)]
            if not d["credits"] or not all(any(l.startswith(BY) for l in c.get("licenses", [])) for c in d["credits"]):
                print(f"skipped {slot}:{oid}: no attribution-only license")
                continue
            recolor = d.get("recolors", {})
            material = recolor.get("material") or recolor.get("color_1", {}).get("material")
            for lk in sorted(k for k in d if k.startswith("layer_")):
                layer = d[lk]
                for sex in ("male", "female"):
                    if sex not in layer:
                        continue
                    path = gen / "spritesheets" / layer[sex]
                    sheet = Image.new("RGBA", (CELL * COLS, CELL * len(ROWS)))
                    drawn = False
                    for r, (anim, row, frames) in enumerate(ROWS):
                        if "custom_animation" in layer:
                            # An oversized swing (128 px frames) for one animation only.
                            # Only this row's own swing: "slash_oversize" or "slash_128", not "slash_reverse_oversize".
                            if layer["custom_animation"] not in (f"{anim}_oversize", f"{anim}_128"):
                                continue
                            src = custom(path.parent if path.name == "" else path)
                            tail = layer["custom_animation"].split("_")[-1]
                            size = 192 if tail == "oversize" else int(tail)
                        else:
                            src = find(path, anim)
                            size = 64
                        if src is None:
                            continue
                        im = Image.open(src).convert("RGBA")
                        rows_in = im.height // size
                        srow = min(row, rows_in - 1)
                        for f in range(min(frames, im.width // size)):
                            cut = im.crop((f * size, srow * size, (f + 1) * size, (srow + 1) * size))
                            if size > CELL:
                                # A 192 px swing keeps its middle 128 px: the cell the Scion stands in.
                                m = (size - CELL) // 2
                                cut = cut.crop((m, m, m + CELL, m + CELL))
                            off = max(0, (CELL - size) // 2)
                            sheet.alpha_composite(cut, (f * CELL + off, r * CELL + off))
                        drawn = True
                    if not drawn:
                        continue
                    tag = f"{lk[6:]}{'abcdefgh'[part] if part else ''}"
                    lid = f"{slot}_{oid}_{tag}_{sex[0]}"
                    # Same art for both bodies: keep one file.
                    other = f"{slot}_{oid}_{tag}_m"
                    if sex == "female" and layer.get("female") == layer.get("male"):
                        manifest["layers"].append({"id": lid, "file": other, "slot": slot, "option": oid, "sex": "f", "z": layer["zPos"], "material": material})
                        continue
                    sheet.save(out / f"{lid}.webp", "WEBP", lossless=True, method=6)
                    manifest["layers"].append({"id": lid, "file": lid, "slot": slot, "option": oid, "sex": sex[0], "z": layer["zPos"], "material": material})
            for c in d["credits"]:
                key = c["file"]
                if key in seen_credits:
                    continue
                seen_credits.add(key)
                manifest["credits"].append({"file": key, "authors": c["authors"], "licenses": [l for l in c["licenses"] if l.startswith(BY)], "urls": c.get("urls", [])})

for material in ["body", "hair", "cloth", "eye"]:
    meta = json.loads((gen / "palette_definitions" / material / f"meta_{material}.json").read_text())
    colors = json.loads((gen / "palette_definitions" / material / f"{material}_ulpc.json").read_text())
    manifest["palettes"][material] = {"base": meta["base"], "colors": colors}

(root / "src/client/games/sovereign-pact/scion-layers.json").write_text(json.dumps(manifest, indent=1) + "\n")
print(f"{len(manifest['layers'])} layers, {len(list(out.glob('*.webp')))} sheets cut into {out}")
