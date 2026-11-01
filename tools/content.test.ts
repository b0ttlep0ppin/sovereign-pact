// @vitest-environment node
// Content validation (CLAUDE.md, HANDOFF §7): every JSON file under the game's content/ folder must
// match its schema under schemas/. A top-level file content/<name>.json uses schemas/<name>.schema.json;
// a file in a folder, content/<folder>/…/<id>.json (events, enemies/<pool>, bosses…), uses
// schemas/<folder>.schema.json. Defined ids (an id with a name or text) are unique within a file and across a folder.
// Run alone with `npm run content`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv, type ValidateFunction } from "ajv";
import { describe, expect, it } from "vitest";
import { ABILITY_SETS, BOSSES, ENEMIES, ENEMY_BY_ID, JOBS, POOL_BY_ID, rosterOf, TEMPLATES, VARIANT_BY_ID, type TemplateRole } from "../src/shared/games/sovereign-pact/content.ts";
import { knownCondition } from "../src/shared/games/sovereign-pact/combat/conditions.ts";
import { rosterFor } from "../src/shared/games/sovereign-pact/combat/encounter.ts";
import { partBox } from "../src/shared/games/sovereign-pact/combat/enemyparts.ts";
import { TARGET_RULES } from "../src/shared/games/sovereign-pact/combat/gambits.ts";
import { INDEXED, renderIndex } from "./gen-content.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const CONTENT = join(root, "src/shared/games/sovereign-pact/content");
const SCHEMAS = join(root, "schemas");

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const posix = (p: string) => p.split(sep).join("/");
const contentFiles = walk(CONTENT).filter((f) => f.endsWith(".json")).map((f) => posix(relative(CONTENT, f)));
const schemaFiles = readdirSync(SCHEMAS).filter((f) => f.endsWith(".schema.json"));

const ajv = new Ajv({ allErrors: true, strict: true });
for (const f of schemaFiles) ajv.addSchema(JSON.parse(readFileSync(join(SCHEMAS, f), "utf8")), f);

/** The schema a content file answers to. */
const schemaFor = (file: string): string => `${file.includes("/") ? file.split("/")[0] : file.replace(/\.json$/, "")}.schema.json`;

/** A thing the file defines, rather than a reference to one ({ id, ticks }): it has an id and a name or text. */
const defines = (v: unknown): v is { id: string } =>
  typeof v === "object" && v !== null && "id" in v && typeof v.id === "string" && ("name" in v || "text" in v);

/** Every defined `id` in arrays of objects, wherever they sit in the file. */
function ids(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => (defines(v) ? [v.id, ...ids(v)] : ids(v)));
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(ids);
  return [];
}

describe("content", () => {
  it("has content to check", () => {
    expect(contentFiles.length).toBeGreaterThan(0);
  });

  it.each(contentFiles)("%s matches its schema", (file) => {
    const schema = schemaFor(file);
    expect(schemaFiles, `no schemas/${schema} for content/${file}`).toContain(schema);
    const validate = ajv.getSchema(schema) as ValidateFunction;
    const data: unknown = JSON.parse(readFileSync(join(CONTENT, file), "utf8"));
    const ok = validate(data);
    expect(ok, ajv.errorsText(validate.errors, { dataVar: file, separator: "\n" })).toBe(true);
    const all = ids(data);
    expect(all.filter((id, i) => all.indexOf(id) !== i), "duplicate ids").toEqual([]);
  });

  it("has a use for every schema", () => {
    const used = new Set([...contentFiles.map(schemaFor), "defs.schema.json"]);
    expect(schemaFiles.filter((f) => !used.has(f))).toEqual([]);
  });

  it("keeps ids unique across each content folder", () => {
    const folders = new Map<string, string[]>();
    for (const file of contentFiles.filter((f) => f.includes("/"))) {
      const folder = file.split("/")[0]!;
      const data: unknown = JSON.parse(readFileSync(join(CONTENT, file), "utf8"));
      folders.set(folder, [...(folders.get(folder) ?? []), ...(defines(data) ? [data.id] : []), ...ids(data)]);
    }
    for (const [folder, all] of folders) expect(all.filter((id, i) => all.indexOf(id) !== i), folder).toEqual([]);
  });

  it("files enemies by pool and id", () => {
    for (const file of contentFiles.filter((f) => f.startsWith("enemies/"))) {
      const [, pool, name] = file.split("/");
      const data = JSON.parse(readFileSync(join(CONTENT, file), "utf8")) as { id: string; pool: string };
      expect(`${data.pool}/${data.id}.json`, file).toBe(`${pool}/${name}`);
    }
    // content.ts imports every file through the generated index: `npm run gen:content` after adding one.
    for (const { folder, dir, index } of INDEXED) expect(readFileSync(index, "utf8"), `content/${folder}/index.gen.ts is stale: npm run gen:content`).toBe(renderIndex(folder, dir));
    const files = contentFiles.filter((f) => f.startsWith("enemies/")).map((f) => f.split("/").at(-1)!.replace(/\.json$/, ""));
    expect(ENEMIES.map((e) => e.id).sort()).toEqual(files.sort());
  });

  it("files each Job's abilities as abilities/<job>.json", () => {
    const files = contentFiles.filter((f) => f.startsWith("abilities/")).map((f) => f.split("/").at(-1)!.replace(/\.json$/, ""));
    expect(ABILITY_SETS.map((a) => a.job).sort()).toEqual(files.sort());
    for (const set of ABILITY_SETS) expect(JOBS.map((j) => j.id), set.job).toContain(set.job);
  });

  it("keeps every Part on its enemy's cells, a rectangle, disabling abilities it has", () => {
    for (const e of ENEMIES) {
      for (const p of e.parts ?? []) {
        for (const [c, r] of p.cells) expect(c < e.size[0] && r < e.size[1], `${e.id}.${p.id} off its cells`).toBe(true);
        expect(() => partBox(p), `${e.id}.${p.id}`).not.toThrow();
        for (const a of p.disables ?? []) expect(e.abilities.map((x) => x.id), `${e.id}.${p.id}`).toContain(a);
      }
    }
  });

  it("gives every boss gambits and adds that exist, a weakness and a pattern (§10.10)", () => {
    for (const boss of BOSSES) {
      const abilities = boss.abilities.map((a) => a.id);
      for (const g of [...boss.gambits, ...boss.phases.flatMap((p) => p.gambits)]) if (!["wait", "defend"].includes(g.do)) expect(abilities, `${boss.id}: ${g.do}`).toContain(g.do);
      for (const a of [...(boss.adds ?? []), ...boss.phases.flatMap((p) => (p.adds ? [p.adds] : []))]) for (const id of a.spawn) expect(ENEMY_BY_ID.has(id), `${boss.id}: add ${id}`).toBe(true);
      expect(POOL_BY_ID.has(boss.pool), boss.id).toBe(true);
      expect(boss.bestiary.weakness.length && boss.bestiary.pattern.length, boss.id).toBeTruthy();
    }
  });

  it("files bosses as bosses/<id>.json", () => {
    const files = contentFiles.filter((f) => f.startsWith("bosses/")).map((f) => f.split("/").at(-1)!.replace(/\.json$/, ""));
    expect(BOSSES.map((e) => e.id).sort()).toEqual(files.sort());
  });

  it("names only elemental variants that exist (§14.10)", () => {
    for (const e of ENEMIES) for (const v of e.variants ?? []) expect(VARIANT_BY_ID.get(v)?.family, `${e.id}: ${v}`).toBe("elemental");
  });

  it("gives enemies and bosses only conditions and targets the gambit engine knows (unknown ones fail silently)", () => {
    for (const e of [...ENEMIES, ...BOSSES]) {
      const phases = "phases" in e ? (e as (typeof BOSSES)[number]).phases : [];
      for (const g of [...e.gambits, ...phases.flatMap((p) => p.gambits)]) {
        if (g.if) expect(knownCondition(g.if), `${e.id}: if ${g.if}`).toBe(true);
        if (g.target) expect(TARGET_RULES, `${e.id}: target ${g.target}`).toContain(g.target);
      }
      for (const p of phases) expect(knownCondition(p.at), `${e.id}: phase at ${p.at}`).toBe(true);
    }
  });

  // HANDOFF §6's roster lints, switched on for each pool as its roster is completed (Milestone 3).
  const COMPLETE = ["barrows", "beast_lands", "hollow_wood", "drowned_marches", "deep_cold"];
  // Roles §14.5 gives a pool none of: its Encounters fill them from the stand-in chain (tuning.encounters.stand).
  const SPARSE: Record<string, readonly TemplateRole[]> = { deep_cold: ["swarm", "support"] };
  const BACK_LINE = (e: (typeof ENEMIES)[number]) => ["lurker", "artillery", "horror"].includes(e.role) || e.tags.includes("reach") || e.tags.includes("flyer");

  it.each(COMPLETE)("fills every template at every level of %s from its own roster", (id) => {
    const pool = POOL_BY_ID.get(id)!;
    for (let level = pool.levels[0]; level <= pool.levels[1]; level++) {
      for (const t of TEMPLATES.filter((x) => x.levels[0] <= level && level <= x.levels[1])) {
        for (const role of Object.keys({ ...t.four, ...t.eight }) as TemplateRole[]) {
          const roster = SPARSE[id]?.includes(role) ? rosterFor(id, role, level) : rosterOf(id, role, level);
          expect(roster.length, `${id} L${level} ${t.id}: no ${role}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it.each(COMPLETE)("keeps a third of %s's roster a back-line threat, 15–25 enemies", (id) => {
    const roster = ENEMIES.filter((e) => e.pool === id && e.role !== "boss" && !e.addOnly);
    expect(roster.length).toBeGreaterThanOrEqual(15);
    expect(roster.length).toBeLessThanOrEqual(25);
    expect(roster.filter(BACK_LINE).length * 3).toBeGreaterThanOrEqual(roster.length);
  });
});
