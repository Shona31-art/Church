import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The database suite boots Postgres (WASM) and runs every migration.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
