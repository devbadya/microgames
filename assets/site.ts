interface Game {
  slug: string;
  title?: string;
  description?: string;
  tags?: string[];
  minutes?: number;
}

async function loadGames(): Promise<Game[]> {
  const res = await fetch("./games/games.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load games.json (${res.status})`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error("games.json must be an array");
  return data as Game[];
}

function normalize(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}

interface GameCard extends HTMLElement {
  dataset: DOMStringMap & { search: string };
}

function renderCard(game: Game): GameCard {
  const slug = normalize(game.slug).replace(/\s+/g, "-");
  const title = String(game.title ?? (slug || "Untitled"));
  const description = String(game.description ?? "");
  const tags = Array.isArray(game.tags) ? game.tags : [];
  const minutes =
    typeof game.minutes === "number" && Number.isFinite(game.minutes) ? game.minutes : null;
  const href = `./games/${encodeURIComponent(slug)}/`;

  const card = document.createElement("article");
  card.className = "card";

  const h3 = document.createElement("h3");
  h3.className = "cardTitle";
  h3.textContent = title;

  const p = document.createElement("p");
  p.className = "cardDesc";
  p.textContent = description;

  const chipRow = document.createElement("div");
  chipRow.className = "chipRow";
  if (minutes !== null) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = `${minutes} min`;
    chipRow.appendChild(chip);
  }
  for (const t of tags.slice(0, 6)) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = String(t);
    chipRow.appendChild(chip);
  }

  const a = document.createElement("a");
  a.className = "cardLink";
  a.href = href;
  a.setAttribute("aria-label", `Play ${title}`);
  a.textContent = "Play";

  card.append(h3, p, chipRow, a);
  card.dataset.search =
    `${normalize(title)} ${normalize(description)} ${tags.map(normalize).join(" ")}`.trim();
  return card as GameCard;
}

function setStatus(text: string): void {
  const el = document.getElementById("status");
  if (el) el.textContent = text;
}

function main(): void {
  const grid = document.getElementById("grid");
  const search = document.getElementById("search") as HTMLInputElement | null;
  if (!grid || !search) return;

  let cards: GameCard[] = [];

  const applyFilter = (): void => {
    const q = normalize(search.value);
    let visible = 0;
    for (const card of cards) {
      const ok = !q || card.dataset.search.includes(q);
      card.style.display = ok ? "" : "none";
      if (ok) visible += 1;
    }
    setStatus(`${visible} game${visible === 1 ? "" : "s"}`);
  };

  search.addEventListener("input", applyFilter);

  void (async () => {
    setStatus("Loading games…");
    try {
      const games = await loadGames();
      cards = games.map(renderCard);
      grid.replaceChildren(...cards);
      applyFilter();
    } catch (e) {
      grid.replaceChildren();
      setStatus("Failed to load games. Check games/games.json.");
      console.error(e);
    }
  })();
}

document.addEventListener("DOMContentLoaded", main);
