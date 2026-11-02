#!/usr/bin/env python3
"""Cuts the battle sound cues the game ships from the BOOM Library packs (SPEC §16.1).

Reads content/audio/sfx.json (each cue's id, source file, number of takes and longest length). A BOOM
"Designed" file holds several variations of one sound with silence between them: this finds them, keeps
the first `takes`, trims each to `max` seconds with a short fade, folds it to mono at 44.1 kHz, matches
loudness to -16 LUFS and writes public/sfx/sovereign-pact/<id>-<n>.ogg (Vorbis, q4). The packs
themselves never go in the repo (their license forbids redistributing the sounds as they are).

Usage: tools/cut-sfx.py <the "BoomLibrary Commercial SFX" folder>
"""
import json
import re
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
packs = Path(sys.argv[1])
manifest = json.loads((root / "src/shared/games/sovereign-pact/content/audio/sfx.json").read_text())
out = root / "public/sfx/sovereign-pact"
out.mkdir(parents=True, exist_ok=True)
for old in out.glob("*.ogg"):
    old.unlink()

FADE = 0.12


def duration(path: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def variations(path: Path) -> list[tuple[float, float]]:
    """The sounding stretches of the file, between its silences."""
    r = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", str(path), "-af", "silencedetect=noise=-45dB:d=0.12", "-f", "null", "-"], capture_output=True, text=True)
    marks = [(m.group(1), float(m.group(2))) for m in re.finditer(r"silence_(start|end): ([0-9.]+)", r.stderr)]
    spans, start = [], 0.0
    for kind, t in marks:
        if kind == "start":
            if t - start > 0.08:
                spans.append((start, t))
        else:
            start = t
    end = duration(path)
    if not marks or marks[-1][0] == "end":
        if end - start > 0.08:
            spans.append((start, end))
    return spans


count = 0
for cue in manifest["cues"]:
    src = packs / cue["source"]
    spans = variations(src)[: cue["takes"]]
    for n, (a, b) in enumerate(spans, 1):
        a = max(0.0, a - 0.01)
        length = min(b - a, cue["max"])
        fade = f"afade=t=out:st={max(0.0, length - FADE):.3f}:d={FADE}"
        subprocess.run(
            ["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", f"{a:.3f}", "-t", f"{length:.3f}", "-i", str(src),
             "-af", f"{fade},pan=mono|c0=0.5*c0+0.5*c1,loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100",
             "-c:a", "libvorbis", "-q:a", "4", str(out / f"{cue['id']}-{n}.ogg")],
            check=True,
        )
        count += 1
print(f"{count} takes of {len(manifest['cues'])} cues cut into {out}")
