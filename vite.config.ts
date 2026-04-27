import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "./",
  publicDir: "public",
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
      },
    },
  },
});
