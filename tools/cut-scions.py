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

# Every helmet the generator offers under an attribution-only license (two horned ones are share-alike only).
HELMS = ["mail", "nasal", "armet", "armet_simple", "barbarian", "barbarian_nasal", "barbarian_viking", "barbuta", "bascinet", "close", "flattop", "greathelm", "kettle", "legion", "morion", "norman", "pointed", "spangenhelm", "spangenhelm_viking", "sugarloaf"]
# slot -> option -> sheet definition (relative to sheet_definitions/), or several drawn together. A part
# given as {"def": ...} may name the color file to take ("variant") or ask for the House's other color
# ("tone": "accent"). A layer that comes in the generator's cloth colors is cut in white and one in metals
# in steel, so the client can recolor it from the palette; any other takes VARIANT's first match.
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
    "armor": {
        "chainmail": "torso/torso_chainmail.json",
        "plate": "torso/armour/torso_armour_plate.json",
        "legion": "torso/armour/torso_armour_legion.json",
        # Light armor is clothing (Josh 2026-11-03): a buttoned doublet and an open gambeson, dyed leather.
        "doublet": "torso/shirts/longsleeve/torso_clothes_longsleeve2_buttoned.json",
        "gambeson": "torso/shirts/longsleeve/torso_clothes_longsleeve2_cardigan.json",
    },
    "tabard": {"tabard": "torso/jacket/torso_jacket_tabard.json"},
    "belt": {
        **{k: f"torso/waist/belt_{k}.json" for k in ["leather", "double", "sash", "sash_narrow", "robe", "waistband"]},
        "obi": "torso/waist/obi/belt_obi.json",
    },
    "shoulders": {k: f"arms/shoulders/shoulders_{k}.json" for k in ["pauldrons", "legion", "mantal", "epaulets"]},
    "arms": {"plate": "arms/arms_armour.json"},
    "wrists": {"bracers": "arms/wrists/arms_bracers.json", "cuffs": "arms/wrists/wrists_cuffs.json", "lace": "arms/wrists/wrists_cuffs_lace.json"},
    "gloves": {"gloves": "arms/arms_gloves.json"},
    "neck": {
        **{k: f"headwear/neck/neck_{k}.json" for k in ["capeclip", "capetie", "cravat", "jabot", "necklace_beaded_small"]},
        "amulet_cross": {"def": "headwear/neck/charms/neck_amulet_cross.json", "variant": "brass_red"},
        "amulet_star": {"def": "headwear/neck/charms/neck_amulet_star.json", "variant": "brass_blue"},
        "charm_star": "headwear/neck/charms/neck_charm_star.json",
    },
    "face": {
        "eyepatch": {"def": "headwear/accessories/eyepatch/facial_eyepatch_left.json", "variant": "black"},
        "glasses": {"def": "headwear/accessories/glasses/facial_glasses.json", "variant": "black"},
        "halfmoon": {"def": "headwear/accessories/glasses/facial_glasses_halfmoon.json", "variant": "black"},
        "mask": {"def": "headwear/accessories/facial_mask_plain.json", "variant": "black"},
    },
    "cape": {"solid": "torso/cape/cape_solid.json", "tattered": "torso/cape/cape_tattered.json"},
    # Drawn over a solid cape, in the House's second color.
    "capetrim": {"trim": "torso/cape/cape_trim.json"},
    "hat": {
        "wizard": "headwear/hats/magic/hat_magic_celestial.json",
        "wizard_trim": ["headwear/hats/magic/hat_magic_celestial.json", {"def": "headwear/hats/magic/hat_magic_celestial_trim.json", "tone": "accent"}],
        "wizard_moon": ["headwear/hats/magic/hat_magic_celestial_moon.json", {"def": "headwear/hats/magic/hat_magic_celestial_moon_trim.json", "tone": "accent"}],
        "hood": "headwear/coverings/hoods/hat_hood_cloth.json",
        "sack_hood": "headwear/coverings/hoods/hat_hood_sack_cloth.json",
        # The cap and its feather are two definitions; both are drawn.
        "cavalier": ["headwear/hats/caps/hat_cap_cavalier.json", "headwear/hats/caps/hat_cap_cavalier_feather.json"],
        "bonnie": ["headwear/hats/caps/hat_cap_bonnie.json", {"def": "headwear/hats/caps/hat_cap_bonnie_feather.json", "tone": "accent"}],
        "leather_cap": ["headwear/hats/caps/hat_cap_leather.json", {"def": "headwear/hats/caps/hat_cap_leather_feather.json", "tone": "accent"}],
        "bandana": "headwear/coverings/bandana/hat_bandana.json",
        **{k: f"headwear/coverings/headbands/hat_headband_{k}.json" for k in ["kerchief", "thick", "tied", "hairtie", "thick_rune"]},
        "tricorne": "headwear/hats/tricorne/hat_tricorne.json",
        "tricorne_stitched": ["headwear/hats/tricorne/hat_tricorne.json", {"def": "headwear/hats/tricorne/hat_tricorne_stitched.json", "tone": "accent"}],
        "tricorne_captain": ["headwear/hats/tricorne/hat_tricorne_captain.json", {"def": "headwear/hats/tricorne/hat_tricorne_captain_trim.json", "variant": "brass"}],
        "bicorne": "headwear/hats/athwart/hat_bicorne_athwart_captain.json",
        **{k: f"headwear/helmets/helmets/hat_helmet_{k}.json" for k in HELMS},
    },
    # On top of a helmet: plumes in the House's color, crests, horns and wings in metal.
    "crest": {k: f"headwear/helmets/accessories/hat_accessory_{k}.json" for k in ["plumage", "plumage_centurion", "crest_centurion", "horns_short", "horns_upward", "wings"]},
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


def find(base: Path, anim: str, prefer: str | None = None) -> Path | None:
    """The file a layer draws `anim` with: <anim>.png, or <anim>/<variant>.png."""
    for a in [anim, *FALLBACK[anim]]:
        if (base / f"{a}.png").exists():
            return base / f"{a}.png"
        if (base / a).is_dir():
            for v in ([prefer] if prefer else []) + VARIANT:
                if (base / a / f"{v}.png").exists():
                    return base / a / f"{v}.png"
            files = sorted((base / a).glob("*.png"))
            if files:
                return files[0]
    return None


def custom(base: Path, prefer: str | None = None) -> Path | None:
    """An oversized animation's single sheet: <dir>.png or <dir>/<variant>.png."""
    for v in ([prefer] if prefer else []) + VARIANT:
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
        for part, spec in enumerate(rels if isinstance(rels, list) else [rels]):
            spec = spec if isinstance(spec, dict) else {"def": spec}
            rel = spec["def"]
            d = json.loads((gen / "sheet_definitions" / rel).read_text())
            # Only the credits of the files we cut (a definition also credits its child or teen art).
            used = [layer[sex] for k, layer in d.items() if k.startswith("layer_") for sex in ("male", "female") if sex in layer]
            d["credits"] = [c for c in d.get("credits", []) if any(u.startswith(c["file"].rstrip("/") + "/") or u.rstrip("/") == c["file"].rstrip("/") for u in used)]
            if not d["credits"] or not all(any(l.startswith(BY) for l in c.get("licenses", [])) for c in d["credits"]):
                print(f"skipped {slot}:{oid}: no attribution-only license")
                continue
            recolor = d.get("recolors", {})
            material = recolor.get("material") or recolor.get("color_1", {}).get("material")
            variants = d.get("variants") or []
            prefer = spec.get("variant")
            if not prefer and not material and "white" in variants:
                prefer, material = "white", "cloth"
            elif not prefer and not material and "steel" in variants:
                prefer, material = "steel", "metal"
            tone = {"tone": spec["tone"]} if "tone" in spec else {}
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
                            src = custom(path.parent if path.name == "" else path, prefer)
                            tail = layer["custom_animation"].split("_")[-1]
                            size = 192 if tail == "oversize" else int(tail)
                        else:
                            src = find(path, anim, prefer)
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
                    if slot == "weapon":
                        # The idle rows borrow their second frame from the walk, where a weapon swings
                        # level or drops out of the hand (Josh 2026-11-03: a staff "goes from pointed up to
                        # pointed forward"). Hold the first frame's weapon instead, risen 1 px with the body.
                        for r in (0, 1):
                            first = sheet.crop((0, r * CELL, CELL, (r + 1) * CELL))
                            sheet.paste((0, 0, 0, 0), (CELL, r * CELL, 2 * CELL, (r + 1) * CELL))
                            sheet.alpha_composite(first.crop((0, 1, CELL, CELL)), (CELL, r * CELL))
                    tag = f"{lk[6:]}{'abcdefgh'[part] if part else ''}"
                    lid = f"{slot}_{oid}_{tag}_{sex[0]}"
                    # Same art for both bodies: keep one file.
                    other = f"{slot}_{oid}_{tag}_m"
                    if sex == "female" and layer.get("female") == layer.get("male"):
                        manifest["layers"].append({"id": lid, "file": other, "slot": slot, "option": oid, "sex": "f", "z": layer["zPos"], "material": material, **tone})
                        continue
                    sheet.save(out / f"{lid}.webp", "WEBP", lossless=True, method=6)
                    manifest["layers"].append({"id": lid, "file": lid, "slot": slot, "option": oid, "sex": sex[0], "z": layer["zPos"], "material": material, **tone})
            for c in d["credits"]:
                key = c["file"]
                if key in seen_credits:
                    continue
                seen_credits.add(key)
                manifest["credits"].append({"file": key, "authors": c["authors"], "licenses": [l for l in c["licenses"] if l.startswith(BY)], "urls": c.get("urls", [])})


def spearhead(sheet: Image.Image) -> Image.Image:
    """The staff with its crook and gem cut away and a steel spearhead in their place.

    The generator's spears are share-alike only, so the game's spear is its simple staff with a head
    painted on (Josh 2026-11-03: "crude spear very clearly appears to be a staff"). In each frame the
    shaft's line is fitted through its pixels; the end nearer the gem is the head end. Frames that show
    no gem (the staff's far end only) are left as they are.
    """
    out = sheet.copy()
    px = out.load()
    steel = [(0x2a, 0x2c, 0x33, 255), (0x8e, 0x95, 0x9e, 255), (0xd4, 0xd9, 0xde, 255)]
    for r in range(len(ROWS)):
        for c in range(COLS):
            x0, y0 = c * CELL, r * CELL
            pts = [(x, y) for y in range(y0, y0 + CELL) for x in range(x0, x0 + CELL) if px[x, y][3] > 100]
            gem = [(x, y) for x, y in pts if px[x, y][2] > px[x, y][0] + 30]
            if not gem or len(pts) < 10:
                continue
            mx = sum(x for x, _ in pts) / len(pts)
            my = sum(y for _, y in pts) / len(pts)
            sxx = sum((x - mx) ** 2 for x, _ in pts)
            syy = sum((y - my) ** 2 for _, y in pts)
            sxy = sum((x - mx) * (y - my) for x, y in pts)
            # The principal axis of the shaft's pixels.
            import math
            ang = 0.5 * math.atan2(2 * sxy, sxx - syy)
            dx, dy = math.cos(ang), math.sin(ang)
            gx = sum(x for x, _ in gem) / len(gem)
            gy = sum(y for _, y in gem) / len(gem)
            if (gx - mx) * dx + (gy - my) * dy < 0:
                dx, dy = -dx, -dy
            along = lambda x, y: (x - mx) * dx + (y - my) * dy
            across = lambda x, y: -(x - mx) * dy + (y - my) * dx
            # The shaft's own offset from the fitted line, read from its lower half.
            low = [across(x, y) for x, y in pts if along(x, y) < 0]
            mid = sorted(low)[len(low) // 2] if low else 0.0
            end = max(along(x, y) for x, y in pts)
            head = end - 8
            # Cut away the crook and gem: everything near the head end off the shaft's line.
            for x, y in pts:
                if along(x, y) > head and (abs(across(x, y) - mid) > 1.2 or (x, y) in gem):
                    px[x, y] = (0, 0, 0, 0)
            # The shaft runs on to the socket; the blade goes on past the old end.
            base, tip = head, end + 3
            for y in range(y0, y0 + CELL):
                for x in range(x0, x0 + CELL):
                    a, t = along(x, y), across(x, y) - mid
                    if base - 2 <= a < base and abs(t) <= 1.4:
                        px[x, y] = steel[0]
                    elif base <= a <= tip:
                        k = (a - base) / (tip - base)
                        half = 2.3 * (1 - k) + 0.4 if k > 0.3 else 1.2 + 3.7 * k
                        if abs(t) <= half:
                            edge = abs(t) > half - 1.0 or a > tip - 1
                            px[x, y] = steel[0] if edge else (steel[2] if t < 0 else steel[1])
    return out


# The spear (DECISIONS 8bs): the staff with a painted spearhead, credited as the staff.
for layer in [l for l in manifest["layers"] if l["slot"] == "weapon" and l["option"] == "staff"]:
    lid = layer["id"].replace("staff", "spear")
    if layer["file"] == layer["id"]:
        spearhead(Image.open(out / f"{layer['file']}.webp").convert("RGBA")).save(out / f"{lid}.webp", "WEBP", lossless=True, method=6)
    manifest["layers"].append({**layer, "id": lid, "file": layer["file"].replace("staff", "spear"), "option": "spear"})

for material in ["body", "hair", "cloth", "eye", "metal"]:
    meta = json.loads((gen / "palette_definitions" / material / f"meta_{material}.json").read_text())
    colors = json.loads((gen / "palette_definitions" / material / f"{material}_ulpc.json").read_text())
    manifest["palettes"][material] = {"base": meta["base"], "colors": colors}

(root / "src/client/games/sovereign-pact/scion-layers.json").write_text(json.dumps(manifest, indent=1) + "\n")
print(f"{len(manifest['layers'])} layers, {len(list(out.glob('*.webp')))} sheets cut into {out}")
