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
        cubeDash: resolve(root, "games/cube-dash/index.html"),
        main: resolve(root, "index.html"),
        metroRush: resolve(root, "games/metro-rush/index.html"),
        notFound: resolve(root, "404.html"),
        rescueMarksman: resolve(root, "games/rescue-marksman/index.html"),
        skyHopper: resolve(root, "games/sky-hopper/index.html"),
        tetris: resolve(root, "games/tetris/index.html"),
      },
    },
  },
});
