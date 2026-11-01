/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative paths, so the build runs from any folder or host.
  base: "./",
  plugins: [react()],
  resolve: {
    // As Vibe Pulse's shared package exports them: the host's API, and each game's own module.
    alias: [
      { find: /^@vibepulse\/shared\/games\/([^/]+)$/, replacement: fileURLToPath(new URL("./src/shared/games/$1/index.ts", import.meta.url)) },
      { find: /^@vibepulse\/shared$/, replacement: fileURLToPath(new URL("./src/shared/index.ts", import.meta.url)) },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "tools/**/*.test.ts"],
    setupFiles: ["./src/client/test-setup.ts"],
    testTimeout: 30_000,
  },
});
