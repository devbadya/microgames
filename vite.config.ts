import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { securityHeadersPlugin } from "./vite-plugin-security-headers";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [securityHeadersPlugin()],
  base: "./",
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
