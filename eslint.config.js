// Mirrors Vibe Pulse's eslint.config.js, so the game's folders pass its lint as they are when synced.
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/", "**/coverage/", ".claude/", "assets-src/", "art-src/"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["tools/**", "*.js", "*.mjs", "vite.config.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["src/client/**"],
    languageOptions: { globals: globals.browser },
    extends: [reactHooks.configs.flat.recommended],
  },
  // The rules are a pure reducer (CLAUDE.md, SPEC §4.2): randomness comes from the seeded Rng only,
  // and nothing reads the clock.
  {
    files: ["src/shared/**"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use the seeded Rng (src/shared/rng.ts)." },
        { object: "Date", property: "now", message: "Rules never read the clock." },
        { object: "performance", property: "now", message: "Rules never read the clock." },
      ],
      "no-restricted-syntax": ["error", { selector: "NewExpression[callee.name='Date']", message: "Rules never read the clock." }],
    },
  },
);
