import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["games/**/*.test.ts", "assets/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "games/dino-run/dino-logic.ts",
        "assets/i18n.ts",
        "assets/csp-policy.ts",
        "games/panic-button/panic-logic.ts",
        "games/tank-wars/tank-logic.ts",
        "games/tank-artillery/artillery-logic.ts",
      ],
      exclude: ["**/*.test.ts"],
    },
  },
});
