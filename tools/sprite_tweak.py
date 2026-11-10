"""The colour tweak a sprite's manifest entry may carry (the Bestiary's sliders), applied the way a browser
applies the CSS filter `hue-rotate() saturate() brightness() contrast() sepia()`, in that order, in sRGB.

Each value uses the slider's units: hue in degrees, the rest in percent (defaults 0, 100, 100, 100, 0)."""
import math

import numpy as np
from PIL import Image

DEFAULTS = {"hue": 0, "sat": 100, "bright": 100, "contrast": 100, "warmth": 0}


def _hue(deg):
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return np.array([
        [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
        [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283],
        [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072],
    ])


def _saturate(v):
    return np.array([
        [0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v],
        [0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v],
        [0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v],
    ])


def _sepia(v):
    w = 1 - v
    return np.array([
        [0.393 + 0.607 * w, 0.769 - 0.769 * w, 0.189 - 0.189 * w],
        [0.349 - 0.349 * w, 0.686 + 0.314 * w, 0.168 - 0.168 * w],
        [0.272 - 0.272 * w, 0.534 - 0.534 * w, 0.131 + 0.869 * w],
    ])


def tweak(im: Image.Image, t: dict) -> Image.Image:
    t = {**DEFAULTS, **(t or {})}
    if t == DEFAULTS:
        return im
    a = np.asarray(im.convert("RGBA")).astype(np.float64) / 255
    rgb, alpha = a[..., :3], a[..., 3:]
    if t["hue"]:
        rgb = np.clip(rgb @ _hue(t["hue"]).T, 0, 1)
    if t["sat"] != 100:
        rgb = np.clip(rgb @ _saturate(t["sat"] / 100).T, 0, 1)
    if t["bright"] != 100:
        rgb = np.clip(rgb * t["bright"] / 100, 0, 1)
    if t["contrast"] != 100:
        rgb = np.clip((rgb - 0.5) * t["contrast"] / 100 + 0.5, 0, 1)
    if t["warmth"]:
        rgb = np.clip(rgb @ _sepia(min(t["warmth"], 100) / 100).T, 0, 1)
    out = np.concatenate([rgb, alpha], axis=-1)
    return Image.fromarray(np.round(out * 255).astype(np.uint8), "RGBA")
