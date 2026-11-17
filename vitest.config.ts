import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["systems/**/*.test.ts", "site/**/*.test.ts"] },
});
