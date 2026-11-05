// The music (§16.2): every track ships, small, and every screen and battle has one.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Content, sovereignPact as g } from "@vibepulse/shared/games/sovereign-pact";
import { campaign } from "../../../shared/games/sovereign-pact/testing.ts";
import { CREDITS } from "./credits";
import { battleTrack, sceneTrack, SETTLEMENT_TRACKS, TRACKS, type TrackId } from "./music";

const DIR = join(__dirname, "../../../../public/music/sovereign-pact");

describe("the music", () => {
  it("ships every track, and nothing else, each under 1.5 MB", () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith(".ogg"));
    expect(files.map((f) => f.replace(/\.ogg$/, "")).sort()).toEqual(Object.keys(TRACKS).sort());
    for (const f of files) expect(statSync(join(DIR, f)).size, f).toBeLessThan(1.5 * 1024 * 1024);
  });

  it("credits every track's author", () => {
    const lines = CREDITS.find((c) => c.title === "Music")!.lines.join("\n");
    for (const t of Object.values(TRACKS)) expect(lines).toContain(`“${t.title}” by ${t.author}`);
  });

  it("gives every pool's battles a battle track, and bosses their own", () => {
    const tracks = new Set<TrackId>();
    for (const pool of Content.POOLS) tracks.add(battleTrack({ title: "An Encounter", pool: pool.id, units: [] }));
    expect([...tracks].sort()).toEqual(["anime-battle", "crimson-horizon", "dark-epic"]);
    const boss = (enemy: string) => battleTrack({ title: "x", units: [{ id: 1, side: "enemy", name: "x", enemy, boss: true, size: [1, 1], maxHp: 1, maxMp: 0, maxSanity: 0 }] });
    expect(boss("goblin_lord")).toBe("boss-battle");
    expect(boss("siege_beast")).toBe("the-spell");
    expect(boss("end_ruler")).toBe("dark-fantasy-music");
    expect(boss("arcana_fool")).toBe("cursed-oni");
  });

  it("plays the Settlement music in town, a new track each Year, and the founding theme before", () => {
    const s = campaign(2, 3);
    expect(sceneTrack(g.view(s, "p1"))).toBe(SETTLEMENT_TRACKS[0]);
    // Every House hears the same Settlement music; a House's old theme choice is not played.
    s.houses[1]!.theme = "kingsfall";
    expect(sceneTrack(g.view(s, "p2"))).toBe(SETTLEMENT_TRACKS[0]);
    expect(sceneTrack(g.view({ ...s, year: 2 }, "p1"))).toBe(SETTLEMENT_TRACKS[1]);
    expect(sceneTrack(g.view({ ...s, year: 4 }, "p1"))).toBe(SETTLEMENT_TRACKS[0]);
    expect(sceneTrack(g.view({ ...s, phase: "founding" }, "p2"))).toBe("the-faded-rose");
    for (const id of new Set(Object.keys(TRACKS))) expect(existsSync(join(DIR, `${id}.ogg`))).toBe(true);
  });

});
