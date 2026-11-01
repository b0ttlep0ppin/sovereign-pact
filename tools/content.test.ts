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
import { ABILITY_SETS, ENEMIES, JOBS } from "../src/shared/games/sovereign-pact/content.ts";

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
    // content.ts imports each file by name; a new file must be added there too.
    const files = contentFiles.filter((f) => f.startsWith("enemies/")).map((f) => f.split("/").at(-1)!.replace(/\.json$/, ""));
    expect(ENEMIES.map((e) => e.id).sort()).toEqual(files.sort());
  });

  it("files each Job's abilities as abilities/<job>.json", () => {
    const files = contentFiles.filter((f) => f.startsWith("abilities/")).map((f) => f.split("/").at(-1)!.replace(/\.json$/, ""));
    expect(ABILITY_SETS.map((a) => a.job).sort()).toEqual(files.sort());
    for (const set of ABILITY_SETS) expect(JOBS.map((j) => j.id), set.job).toContain(set.job);
  });
});
