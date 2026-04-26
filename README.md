# microgames

A growing collection of tiny browser games built with the [PlayCanvas](https://playcanvas.com/) engine, deployed on GitHub Pages.

## Stack

- [pnpm](https://pnpm.io/) for package management
- [TypeScript](https://www.typescriptlang.org/) for all game and site code
- [Vite](https://vitejs.dev/) for dev server + multi-page builds
- [PlayCanvas](https://github.com/playcanvas/engine) (engine-only) for the games
- GitHub Actions for CI/CD to GitHub Pages

## Develop

```bash
pnpm install
pnpm dev        # local dev server
pnpm typecheck  # tsc --noEmit
pnpm build      # typecheck + production build to ./dist
pnpm preview    # preview the production build
```

## Repo layout

```
index.html              # landing page (lists games from games.json)
404.html
assets/                 # shared site styles + landing page logic
  site.ts
  style.css
public/
  .nojekyll
  games/
    games.json          # registry of microgames shown on the landing page
games/
  tetris/               # one folder per microgame
    index.html
    main.ts
    style.css
.github/workflows/
  pages.yml             # builds with pnpm + deploys ./dist to GitHub Pages
tsconfig.json
vite.config.ts
package.json
```

## Add a new microgame

1. Copy `games/tetris/` to `games/<your-game>/`.
2. Update the title/description in your game's `index.html` and write your PlayCanvas code in `main.ts`.
3. Add an entry to `public/games/games.json`.
4. Register the new HTML entry in `vite.config.ts` under `build.rollupOptions.input`.

## GitHub Pages

In your repo settings: **Settings → Pages → Build and deployment → Source: "GitHub Actions"**.

Each push to `main` will run the workflow in `.github/workflows/pages.yml`, build the site with `pnpm build`, and publish `./dist`.
