import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { securityHeadersPlugin } from "./vite-plugin-security-headers";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * GitHub Pages project sites are served from https://<user>.github.io/<repo>/.
 * In CI we use `/${repo}/`. Locally we use `/` (not `./`): a relative base breaks nested
 * routes like `/games/tank-artillery/` because `new Image().src = ./games/...` resolves
 * relative to the page URL and duplicates path segments (sprites 404 → empty lobby canvas).
 */
function viteBase(): string {
  if (process.env.GITHUB_ACTIONS === "true") {
    const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
    if (repo) return `/${repo}/`;
  }
  return "/";
}

export default defineConfig({
  plugins: [securityHeadersPlugin()],
  base: viteBase(),
  publicDir: "public",
  server: {
    headers: {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        notFound: resolve(root, "404.html"),
        skyHopper: resolve(root, "games/sky-hopper/index.html"),
        tetris: resolve(root, "games/tetris/index.html"),
        dinoRun: resolve(root, "games/dino-run/index.html"),
        panicButton: resolve(root, "games/panic-button/index.html"),
        tankArtillery: resolve(root, "games/tank-artillery/index.html"),
        miniChess: resolve(root, "games/mini-chess/index.html"),
      },
    },
  },
});
