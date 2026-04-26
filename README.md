# microgames

Microgames collection for GitHub Pages.

## Structure

- `index.html`: homepage that lists all microgames
- `games/games.json`: registry powering the homepage
- `games/<slug>/`: one folder per microgame (each has its own `index.html`)

## Add a new microgame

1. Copy `games/click-countdown/` to `games/<your-game>/`
2. Update the title/description inside `games/<your-game>/index.html`
3. Add an entry to `games/games.json`

## GitHub Pages

In your repo settings: **Settings → Pages → Build and deployment**
- Source: **GitHub Actions**

