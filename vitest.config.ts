import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["games/**/*.test.ts", "assets/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["games/dino-run/dino-logic.ts"],
      exclude: ["**/*.test.ts"],
    },
  },
});
