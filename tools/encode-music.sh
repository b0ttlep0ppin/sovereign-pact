#!/usr/bin/env bash
# Encodes the Sovereign Pact music folder (Josh's PC: assets\The Soverign Pact music) into the tracks the
# game ships: Opus in Ogg at 48 kb/s, loudness-matched to -16 LUFS, cut to 3 minutes at most with a
# 4-second fade (Vibe Pulse rooms play 1.5-3 minute tracks, SPEC §16.2). The source files never go in
# the repo. Usage: tools/encode-music.sh <source folder>
set -euo pipefail
src=$1
out=$(dirname "$0")/../public/music/sovereign-pact
mkdir -p "$out"
# Shipped name, then the source file's name up to its Pixabay number.
while read -r name file; do
  in=$(ls "$src"/"$file"*.mp3 | head -1)
  len=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")
  cut=$(python3 -c "print(min(180.0, $len))")
  fade=$(python3 -c "print(max(0.0, $cut - 4))")
  ffmpeg -nostdin -v error -y -i "$in" -t "$cut" -af "loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st=$fade:d=4" -ar 48000 -c:a libopus -b:a 48k -vbr on -map_metadata -1 "$out/$name.ogg"
  echo "$name $(du -k "$out/$name.ogg" | cut -f1) KB"
done <<'LIST'
celtic-medieval hitslab-irish-celtic-medieval-music
night-market kang_saif-night-market-in-old-town
dark-fantasy-ambient lux_aeterna_2026-dark-fantasy-ambient
dark-fantasy-music lux-aeterna-dark-fantasy-music
shadows-beneath-the-keep menieldm-shadows-beneath-the-keep
crimson-horizon mroneilovealot-crimson-horizon
kingsfall nakaradaalexander-kingsfall
dark-epic nastelbom-dark-epic
light-blocking nojisuma-light_blocking
on-the-way-home nojisuma-on_the_way_home
winter-sky nojisuma-winter_sky
the-faded-rose ob-lix-the-faded-rose
the-spell ob-lix-the-spell
lost-city-of-atlantis onecinematicstudio-the-lost-city-of-atlantis
boss-battle openmindaudio-japanese-gaming-boss-battle-music
anime-battle phatphrogstudio-phatphrogstudiocom-anime-battle-music
cursed-oni phatphrogstudio-samurai-spirit-cursed-oni
dark-fantasy-lofi welc0mei0-bgm006-dark-fantasy-lo-fi-retro-game
LIST
