import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts", "games/**/*.test.ts", "assets/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "lib/webrtc-p2p.ts",
        "games/dino-run/dino-logic.ts",
        "games/sky-hopper/sky-logic.ts",
        "games/tetris/tetris-logic.ts",
        "games/panic-button/panic-logic.ts",
        "games/tank-artillery/artillery-logic.ts",
        "games/mini-chess/chess-logic.ts",
        "games/mini-chess/chess-bot.ts",
        "assets/i18n.ts",
        "assets/csp-policy.ts",
      ],
      exclude: ["**/*.test.ts"],
    },
  },
});
