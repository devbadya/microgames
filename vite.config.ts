import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { securityHeadersPlugin } from "./vite-plugin-security-headers";

const root = fileURLToPath(new URL(".", import.meta.url));

function normalizeViteBase(raw: string): string {
  const b = raw.trim();
  if (b === "/" || b === "") return "/";
  return b.endsWith("/") ? b : `${b}/`;
}

/**
 * - Local dev: `/` so nested game pages resolve `/games/...` and `/assets/...` from the host root.
 * - CI: optional `VITE_BASE_PATH` (e.g. `/` for a custom domain at site root, e.g. microgames.studio).
 *   If unset in Actions, fall back to `/<repo>/` from `GITHUB_REPOSITORY` for default GitHub Pages
 *   project URLs (`https://<user>.github.io/<repo>/`).
 *
 * A `/microgames/` build on a root-only custom domain breaks absolute asset URLs (CSS, JS, sprites):
 * blank or white lobby and a disabled „Ins Spiel“ button.
 */
function viteBase(): string {
  const explicit = process.env.VITE_BASE_PATH?.trim();
  if (explicit) {
    return normalizeViteBase(explicit);
  }
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
