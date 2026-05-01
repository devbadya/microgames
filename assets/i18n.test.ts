/** @vitest-environment happy-dom */

import { describe, expect, test, beforeEach } from "vitest";
import {
  fillTemplate,
  normalizeLang,
  humanGameCount,
  setLang,
  getLang,
  translate,
  applyDataI18n,
  searchResultLine,
  initLang,
  setDocumentTitleFromKey,
} from "./i18n";

beforeEach(() => {
  initLang(document.documentElement);
  setLang("en");
});

describe("normalizeLang", () => {
  test("maps German variants to de", () => {
    expect(normalizeLang("de")).toBe("de");
    expect(normalizeLang("de-DE")).toBe("de");
  });
  test("defaults unknown to en", () => {
    expect(normalizeLang("fr")).toBe("en");
  });
});

describe("fillTemplate", () => {
  test("substitutes placeholders", () => {
    expect(fillTemplate("{a} — {b}", { a: "1", b: "2" })).toBe("1 — 2");
  });
});

describe("humanGameCount", () => {
  test("en plural", () => {
    expect(humanGameCount("en", 0)).toBe("0 games");
    expect(humanGameCount("en", 1)).toBe("1 game");
    expect(humanGameCount("en", 2)).toBe("2 games");
  });
  test("de plural", () => {
    expect(humanGameCount("de", 1)).toBe("1 Spiel");
    expect(humanGameCount("de", 2)).toBe("2 Spiele");
  });
});

describe("translate + searchResultLine", () => {
  test("translate interpolates aria template", () => {
    expect(translate("ariaPlayGame", { title: "Dino" })).toBe("Play Dino");
    setLang("de");
    expect(translate("ariaPlayGame", { title: "Dino" })).toBe("Dino starten");
  });

  test("searchResultLine reflects filter state", () => {
    expect(searchResultLine(3, 3, "")).toBe("3 games");
    expect(searchResultLine(3, 3, "x")).toBe("3 games");
    expect(searchResultLine(1, 3, "dino")).toBe("1 / 3 games shown");
    setLang("de");
    expect(searchResultLine(1, 3, "dino")).toBe("1 von 3 Spielen angezeigt");
  });
});

describe("applyDataI18n", () => {
  test("updates text and placeholder", () => {
    document.body.innerHTML = `
      <p data-i18n="heroTitle">x</p>
      <input id="q" data-i18n-placeholder="searchPlaceholder" />
    `;
    applyDataI18n(document.body);
    expect(document.querySelector("[data-i18n]")?.textContent).toBe("Tiny games. Big grins.");
    expect((document.getElementById("q") as HTMLInputElement).placeholder).toContain("Search");
    setLang("de");
    applyDataI18n(document.body);
    expect(getLang()).toBe("de");
  });

  test("setzt Meta description und Button aria via data-i18n", () => {
    document.head.innerHTML = `<meta data-i18n-content="metaDesc" name="description" content="" />`;
    document.body.innerHTML = `<button type="button" data-i18n="heroTitle" data-i18n-aria="settingsOpenAria">?</button>`;
    applyDataI18n(document);
    const meta = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    expect(meta.content).toContain("browser");
    const btn = document.querySelector("button")!;
    expect(btn.getAttribute("aria-label")).toBe("Open menu");
  });

  test("Anchor data-i18n setzt Text und aria-label von Key", () => {
    document.body.innerHTML = `<a href="#" id="lnk" data-i18n="playCta" data-i18n-aria-label="settingsOpenAria">x</a>`;
    applyDataI18n(document.body);
    const a = document.getElementById("lnk") as HTMLAnchorElement;
    expect(a.textContent).toContain("Play");
    expect(a.getAttribute("aria-label")).toBe("Open menu");
  });

  test("setDocumentTitleFromKey ändert document.title", () => {
    setDocumentTitleFromKey("pageTitle");
    expect(document.title).toContain("Microgames");
  });
});
