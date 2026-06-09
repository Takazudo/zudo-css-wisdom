import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // e2e/ reads built dist/ HTML; scripts/__tests__/ are pure unit tests.
    // The package scripts filter this set: `test:e2e` → `vitest run e2e/`,
    // `test:unit` → `vitest run scripts/`.
    include: ["e2e/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
