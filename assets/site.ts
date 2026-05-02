import "./style.css";

import type { Game } from "./types";
import {
  translate,
  getLang,
  setLang as persistLang,
  SupportedLang,
  applyDataI18n,
  initLang,
  setDocumentTitleFromKey,
  searchResultLine,
} from "./i18n";
import { AuthService } from "./auth";
import { initAuthUi, type AuthUiHandle } from "./auth-ui";

const SETTINGS_OPEN_CLASS = "settingsOpen";

function qs<T extends HTMLElement>(sel: string, root: ParentNode = document): T | null {
  return root.querySelector(sel) as T | null;
}

/**
 * Convert a manifest thumbnail reference to a safe URL.
 *
 * Hardened against javascript:/data: scheme abuse — only relative paths and
 * same-origin absolute paths are honoured. Anything suspicious collapses to
 * a transparent placeholder so a poisoned games.json can't smuggle script.
 */
export function thumbUrl(rel: string): string {
  const trimmed = String(rel ?? "").trim();
  if (!trimmed) return "data:image/svg+xml;utf8,%3Csvg/%3E";
  // Reject any explicit scheme — only local/relative is allowed.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return "data:image/svg+xml;utf8,%3Csvg/%3E";
  }
  if (trimmed.startsWith("//")) return "data:image/svg+xml;utf8,%3Csvg/%3E";
  if (trimmed.startsWith("/")) return trimmed;
  return `/${trimmed.replace(/^\.\//, "")}`;
}

async function fetchGames(): Promise<Game[]> {
  const res = await fetch("/games/games.json", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("games.json fetch failed");
  return res.json();
}

function updateMetaDescription(): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (meta) meta.setAttribute("content", translate("metaDesc"));
}

function updateLangButtons(lang: SupportedLang): void {
  document.querySelectorAll<HTMLButtonElement>("[data-set-lang]").forEach((btn) => {
    const l = btn.getAttribute("data-set-lang") as SupportedLang | null;
    const on = l === lang;
    btn.setAttribute("aria-pressed", String(on));
    btn.classList.toggle("langBtn--active", on);
  });
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function localeTitle(game: Game): string {
  if (getLang() === "de" && game.title_de?.trim()) return game.title_de.trim();
  return game.title.trim();
}

function localeDescription(game: Game): string {
  if (getLang() === "de" && game.description_de?.trim()) return game.description_de.trim();
  return game.description.trim();
}

function tokensFromQuery(raw: string): string[] {
  return raw
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function gameMatches(game: Game, tokens: string[]): boolean {
  const blob = [
    game.title,
    game.description,
    game.title_de ?? "",
    game.description_de ?? "",
    ...game.tags,
  ]
    .join("\n")
    .toLowerCase();
  return tokens.every((t) => blob.includes(t));
}

/** Highlight first occurrence of needle (case-insensitive) in plaintext */
function highlightFirst(text: string, needleRaw: string): string {
  const needle = needleRaw.trim().toLowerCase();
  if (!needle) return escapeHtml(text);
  const hay = text.toLowerCase();
  const idx = hay.indexOf(needle);
  if (idx < 0) return escapeHtml(text);
  const before = escapeHtml(text.slice(0, idx));
  const mid = escapeHtml(text.slice(idx, idx + needle.length));
  const after = escapeHtml(text.slice(idx + needle.length));
  return `${before}<mark>${mid}</mark>${after}`;
}

function renderCard(game: Game, queryTrimmed: string): string {
  const href = `./games/${encodeURIComponent(game.slug)}/`;

  const title = localeTitle(game);
  const description = localeDescription(game);

  const q = queryTrimmed.trim();
  const firstToken = q ? tokensFromQuery(q)[0] ?? q : "";

  const titleHtml = highlightFirst(title, firstToken || "");
  const descHtml = highlightFirst(description, firstToken || "");

  const ariaLabel = translate("ariaPlayGame", { title });
  const thumb = thumbUrl(game.thumbnail);

  const play = translate("playCta");
  const minLabel = `${game.minutes} ${translate("minShort")}`;
  const tagsHtml = game.tags
    .map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`)
    .join("");

  return `
    <a class="card" href="${href}" data-game-slug="${escapeAttr(game.slug)}" aria-label="${escapeAttr(ariaLabel)}">
      <div class="cardThumb">
        <img class="cardImg" src="${escapeAttr(thumb)}" alt="" loading="lazy" decoding="async" />
      </div>
      <div class="cardBody">
        <h3 class="cardTitle">${titleHtml}</h3>
        <p class="cardDesc">${descHtml}</p>
        <div class="chipRow">${tagsHtml}<span class="chip">${escapeHtml(minLabel)}</span></div>
        <span class="cardCta">${escapeHtml(play)}</span>
      </div>
    </a>
  `;
}

function refreshLegalToggleCopy(): void {
  const toggle = qs<HTMLButtonElement>("#legalToggle");
  const content = qs<HTMLElement>("#legalContent");
  const label = toggle?.querySelector<HTMLElement>(".settingsRevealLabel");
  if (!toggle || !content || !label) return;
  const expanded = !content.hidden;
  label.textContent = expanded ? translate("legalToggleHide") : translate("legalToggleShow");
}

function setUiLanguage(lang: SupportedLang): void {
  persistLang(lang);
  updateLangButtons(lang);
  applyDataI18n(document.body);
  setDocumentTitleFromKey("pageTitle");
  updateMetaDescription();
  refreshLegalToggleCopy();
}

function attachSearchHandlers(): () => void {
  const search = qs<HTMLInputElement>("#search");
  const grid = qs<HTMLElement>("#grid");
  const statusEl = qs<HTMLElement>("#status");
  if (!search || !grid || !statusEl) {
    return () => undefined;
  }

  const apply = () => {
    const games = cachedGames;
    const qRaw = search.value;
    const q = qRaw.trim();
    const tokens = tokensFromQuery(qRaw);

    let list = games;
    if (tokens.length) {
      list = games.filter((g) => gameMatches(g, tokens));
    }

    grid.innerHTML = list.map((g) => renderCard(g, q)).join("");
    statusEl.textContent = searchResultLine(list.length, games.length, q);
    grid.setAttribute("aria-busy", "false");
  };

  search.addEventListener("input", apply);

  return apply;
}

function wireLangSwitch(rerenderGames: () => void): void {
  document.querySelectorAll<HTMLButtonElement>("[data-set-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lang = btn.getAttribute("data-set-lang") as SupportedLang | null;
      if (lang !== "en" && lang !== "de") return;
      setUiLanguage(lang);
      rerenderGames();
    });
  });
}

function wireAuthChipMenu(): void {
  const chip = qs<HTMLElement>("#authSignedInChip");
  if (!chip) return;
  const btn = chip.querySelector<HTMLButtonElement>(".authChipBtn");
  const menu = chip.querySelector<HTMLElement>(".authChipMenu");
  if (!btn || !menu) return;
  const setOpen = (open: boolean) => {
    chip.classList.toggle("authChip--open", open);
    btn.setAttribute("aria-expanded", String(open));
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(!chip.classList.contains("authChip--open"));
  });
  document.addEventListener("click", (e) => {
    if (!chip.contains(e.target as Node)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
  menu.addEventListener("click", () => setOpen(false));
}

function wireSettingsPanel(): void {
  const panel = qs<HTMLElement>("#settingsPanel");
  const backdrop = qs<HTMLElement>("#settingsBackdrop");
  const openBtn = qs<HTMLButtonElement>("#settingsBtn");
  const closeBtn = qs<HTMLButtonElement>("#settingsClose");

  if (!panel || !backdrop || !openBtn || !closeBtn) return;

  const setOpen = (open: boolean) => {
    document.body.classList.toggle(SETTINGS_OPEN_CLASS, open);
    panel.hidden = !open;
    backdrop.hidden = !open;
    openBtn.setAttribute("aria-expanded", String(open));
  };

  openBtn.addEventListener("click", () => setOpen(true));
  closeBtn.addEventListener("click", () => setOpen(false));
  backdrop.addEventListener("click", () => setOpen(false));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains(SETTINGS_OPEN_CLASS)) {
      setOpen(false);
    }
  });
}

function wireLegalToggle(): void {
  const toggle = qs<HTMLButtonElement>("#legalToggle");
  const content = qs<HTMLElement>("#legalContent");
  if (!toggle || !content) return;

  toggle.addEventListener("click", () => {
    const opening = content.hidden;
    content.hidden = !opening;
    toggle.setAttribute("aria-expanded", String(!content.hidden));
    refreshLegalToggleCopy();
    toggle.focus();
  });
}

let cachedGames: Game[] = [];
let authUi: AuthUiHandle | null = null;

async function main(): Promise<void> {
  initLang(document.documentElement);

  const lang = getLang();
  updateLangButtons(lang);
  applyDataI18n(document.body);
  setDocumentTitleFromKey("pageTitle");
  updateMetaDescription();
  refreshLegalToggleCopy();

  wireSettingsPanel();
  wireLegalToggle();
  wireAuthChipMenu();

  try {
    const auth = new AuthService();
    authUi = initAuthUi(auth);
  } catch {
    /* Web Crypto missing or storage blocked — auth unavailable, page still works */
  }

  const rerenderGames = attachSearchHandlers();
  wireLangSwitch(() => {
    rerenderGames();
    if (authUi) authUi.refresh();
  });

  const statusEl = qs<HTMLElement>("#status");
  const gridEl = qs<HTMLElement>("#grid");

  try {
    if (statusEl) statusEl.textContent = translate("statusLoading");
    if (gridEl) gridEl.setAttribute("aria-busy", "true");

    cachedGames = await fetchGames();
  } catch {
    cachedGames = [];
    if (statusEl) statusEl.textContent = translate("statusError");
    if (gridEl) gridEl.innerHTML = `<p class="emptyState" role="status">${translate("statusError")}</p>`;
    return;
  }

  rerenderGames();
}

void main();
