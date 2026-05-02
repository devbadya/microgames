import { expect, test } from "@playwright/test";

test("panzer-artillerie: loads, hud present, shot reaches flight or settle", async ({ page }) => {
  await page.goto("/games/tank-artillery/");
  await page.evaluate(() => {
    localStorage.setItem("tank-artillery-tanks-owned-v1", JSON.stringify(["silver", "green"]));
    localStorage.setItem("tank-artillery-tank-equipped-v1", "green");
  });
  await expect(page).toHaveTitle(/Panzer-Artillerie/);
  await expect(page.getByRole("heading", { name: "Panzer-Artillerie" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Vollbild" })).toBeVisible();
  await page.getByRole("button", { name: "Shop" }).click();
  await expect(page.getByRole("heading", { name: "Item-Shop" })).toBeVisible();
  await page.getByRole("button", { name: "Schließen" }).click();
  await expect(page.getByRole("heading", { name: "Item-Shop" })).not.toBeVisible();
  await page.getByRole("button", { name: "Locker" }).click();
  await expect(page.getByRole("heading", { name: "Locker" })).toBeVisible();
  await page.getByRole("button", { name: "Locker schließen" }).click();
  await expect(page.getByRole("heading", { name: "Locker" })).not.toBeVisible();

  await expect(page.locator("#taMapDifficulty")).toBeVisible();
  await expect(page.locator('#taMapDifficulty option[value="insane"]')).toHaveAttribute("disabled", "");
  await page.selectOption("#taMapTheme", "moon");
  expect(await page.evaluate(() => localStorage.getItem("tank-artillery-map-theme-v1"))).toBe("moon");

  await expect(page.getByRole("button", { name: "Bereit" })).toBeEnabled({ timeout: 15000 });
  await page.getByRole("button", { name: "Bereit" }).click();
  await expect(page.locator("#taCanvas")).toBeVisible();
  await expect(page.locator("#taHp")).toContainText(/Du \d+/);
  await expect(page.locator("#taWeapon")).toContainText(
    /Granate|Schwer|Streuschuss|Platzpatrone|Einstreu|Leichtkaliber|Raschsatz|Panzerfaust|Nadelwald|Deckgranate|Schiffsartillerie|Granatsalve|Wüsten-HE|Panzerjäger|Sandsturm|Blitz/,
  );
  await page.locator("#taCanvas").click();
  await page.locator("#taCanvas").press("Enter");
  await expect(page.locator("#taPhase")).toContainText(/Zielen/i);
  await page.locator("#taCanvas").press("Space");
  await page.waitForFunction(() => document.getElementById("taPhase")?.textContent?.includes("Flug") ?? false, {
    timeout: 5000,
  });
  await page.waitForFunction(
    () => {
      const t = document.getElementById("taPhase")?.textContent ?? "";
      return !t.includes("Flug") && (!t.includes("Bot") || t.includes("Bot zielt"));
    },
    { timeout: 60_000 },
  );
});

test.describe("Sieg-Menü", () => {
  test("Nochmal spielen und Zurück zur Lobby", async ({ page }) => {
    await page.goto("/games/tank-artillery/");
    await expect(page.getByRole("button", { name: "Bereit" })).toBeEnabled({ timeout: 15_000 });
    await page.waitForFunction(
      (): boolean => typeof (window as unknown as { __TA_DEV_SHOW_WIN_MENU__?: unknown }).__TA_DEV_SHOW_WIN_MENU__ ===
        "function",
      { timeout: 12_000 },
    );

    await page.getByRole("button", { name: "Bereit" }).click();
    await expect(page.locator("#taCanvas")).toBeVisible();

    await page.evaluate(() => {
      (window as unknown as { __TA_DEV_SHOW_WIN_MENU__: () => void }).__TA_DEV_SHOW_WIN_MENU__();
    });

    await expect(page.locator("#taGameOverTitle")).toContainText(/gewonnen/i);
    await expect(page.getByRole("button", { name: "Nochmal spielen" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Zurück zur Lobby" })).toBeVisible();

    await page.getByRole("button", { name: "Zurück zur Lobby" }).click();
    await expect(page.locator("#taGameOver")).toBeHidden();
    await expect(page.locator("#taStage")).toBeHidden();
    await expect(page.getByRole("heading", { name: "Panzer-Artillerie" })).toBeVisible();

    await page.getByRole("button", { name: "Bereit" }).click();
    await expect(page.locator("#taCanvas")).toBeVisible();

    await page.evaluate(() => {
      (window as unknown as { __TA_DEV_SHOW_WIN_MENU__: () => void }).__TA_DEV_SHOW_WIN_MENU__();
    });
    await page.getByRole("button", { name: "Nochmal spielen" }).click();
    await expect(page.locator("#taGameOver")).toBeHidden();
    await expect(page.locator("#taCanvas")).toBeVisible();
  });
});

test("panzer-artillerie: Silber Einstreu (Slot 3) — Flugphase endet", async ({ page }) => {
  await page.goto("/games/tank-artillery/");
  await page.evaluate(() => {
    localStorage.setItem("tank-artillery-tanks-owned-v1", JSON.stringify(["silver"]));
    localStorage.setItem("tank-artillery-tank-equipped-v1", "silver");
  });
  await expect(page.getByRole("button", { name: "Bereit" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Bereit" }).click();
  await expect(page.locator("#taCanvas")).toBeVisible();
  await page.locator("#taCanvas").click();
  await page.locator("#taCanvas").press("Enter");
  await expect(page.locator("#taPhase")).toContainText(/Zielen/i);
  await page.locator("#taCanvas").press("Digit3");
  await page.locator("#taCanvas").press("Space");
  await page.waitForFunction(() => document.getElementById("taPhase")?.textContent?.includes("Flug") ?? false, {
    timeout: 8000,
  });
  await page.waitForFunction(
    () => {
      const t = document.getElementById("taPhase")?.textContent ?? "";
      return !t.includes("Flug") && (!t.includes("Bot") || t.includes("Bot zielt"));
    },
    { timeout: 60_000 },
  );
});
test("panzer-artillerie: Shop-Code — ungültig und gültig (Gems)", async ({ page, request }) => {
  await request.post("http://127.0.0.1:5799/reset");
  await page.goto("/games/tank-artillery/");
  await page.evaluate(() => {
    localStorage.removeItem("tank-artillery-gems");
    localStorage.removeItem("tank-artillery-promos-used-v1");
  });
  await page.getByRole("button", { name: "Shop" }).click();
  await expect(page.getByRole("heading", { name: "Item-Shop" })).toBeVisible();
  await page.getByRole("button", { name: "Code" }).click();
  await page.locator("#taShopCodeInput").fill("definitiv-falsch");
  await page.getByRole("button", { name: "Einlösen" }).click();
  await expect(page.locator("#taShopCodeMsg")).toContainText(/Ungültig/i);
  await page.locator("#taShopCodeInput").fill("Admin1");
  await page.getByRole("button", { name: "Einlösen" }).click();
  await expect(page.locator("#taShopGems")).toHaveText("600", { timeout: 8000 });
  await expect(page.locator("#taShopCodeMsg")).toContainText(/eingelöst/i);
  await page.getByRole("button", { name: "Schließen" }).click();
  await expect(page.getByRole("heading", { name: "Item-Shop" })).not.toBeVisible();
});

test("panzer-artillerie: Seba1 lokal — 10k ohne Promo-Stub", async ({ page }) => {
  await page.goto("/games/tank-artillery/");
  await page.evaluate(() => {
    localStorage.removeItem("tank-artillery-gems");
    localStorage.removeItem("tank-artillery-promos-used-v1");
  });
  await expect(page.getByRole("button", { name: "Bereit" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Shop" }).click();
  await expect(page.getByRole("heading", { name: "Item-Shop" })).toBeVisible();
  await page.getByRole("button", { name: "Code" }).click();
  await page.locator("#taShopCodeInput").fill("Seba1");
  await page.getByRole("button", { name: "Einlösen" }).click();
  await expect(page.locator("#taShopCodeMsg")).toContainText(/eingelöst/i, { timeout: 8000 });
  await expect(page.locator("#taShopGems")).toHaveText("10000");
});

test("panzer-artillerie: Kristallschild im Shop (500 💎, Wüsten-Panzer)", async ({ page }) => {
  await page.goto("/games/tank-artillery/");
  await page.evaluate(() => {
    localStorage.setItem("tank-artillery-gems", "600");
    localStorage.setItem("tank-artillery-tanks-owned-v1", JSON.stringify(["silver", "desert"]));
    localStorage.setItem("tank-artillery-tank-equipped-v1", "desert");
    localStorage.removeItem("tank-artillery-desert-shield-v1");
  });
  await page.getByRole("button", { name: "Shop" }).click();
  await expect(page.getByRole("heading", { name: "Spezial" })).toBeVisible();
  await page.locator('[data-desert-shield-buy="1"]').click();
  await expect(page.locator("#taShopGearMsg")).toContainText(/gekauft|Taste 5/i);
  await expect(page.locator("#taShopGems")).toHaveText("100", { timeout: 5000 });
});

test("panzer-artillerie: Panzer kaufen (100 💎)", async ({ page, request }) => {
  await request.post("http://127.0.0.1:5799/reset");
  await page.goto("/games/tank-artillery/");
  await page.evaluate(() => {
    localStorage.setItem("tank-artillery-gems", "120");
    localStorage.removeItem("tank-artillery-tanks-owned-v1");
    localStorage.removeItem("tank-artillery-tank-equipped-v1");
  });
  await page.getByRole("button", { name: "Shop" }).click();
  await page.locator('[data-tank-purchase="green"]').click();
  await expect(page.locator("#taShopGems")).toHaveText("20", { timeout: 5000 });
  await expect(page.locator("#taShopTankMsg")).toContainText(/gekauft/i);
  await page.locator("#taShopCloseFoot").click();
  await expect(page.getByRole("heading", { name: "Item-Shop" })).not.toBeVisible();

  await page.getByRole("button", { name: "Locker" }).click();
  await expect(page.getByRole("heading", { name: "Locker" })).toBeVisible();
  await expect(page.locator(".taLockerTankRow--active")).toContainText("Feld-Green");
});

test("panzer-artillerie: Blitz ohne eigenen Flug (Slot 4, dann Leertaste)", async ({ page }) => {
  await page.goto("/games/tank-artillery/");
  const playBtnBlitz = page.getByRole("button", { name: "Bereit" });
  await expect(playBtnBlitz).toBeEnabled({ timeout: 15000 });
  await playBtnBlitz.click();
  /** Blitz erst ab Kampf Nr. 3 — zweimal aufgeben erhöht `kampfNr` auf 3 */
  async function surrenderThisMatch(): Promise<void> {
    await page.keyboard.press("KeyR");
    await page.locator("#taSurrenderJa").click();
    await page.locator("#taSurrenderJa").click();
    await expect(page.locator("#taGameOverTitle")).toContainText(/aufgegeben/i);
    await page.getByRole("button", { name: "Weiter zur Lobby" }).click();
    await expect(page.locator("#taGameOver")).toBeHidden();
    await expect(page.locator("#taStage")).toBeHidden();
    await expect(page.getByRole("heading", { name: "Panzer-Artillerie" })).toBeVisible();
    await page.getByRole("button", { name: "Bereit" }).click();
    await expect(page.locator("#taCanvas")).toBeVisible();
  }
  await page.locator("#taCanvas").click();
  await surrenderThisMatch();
  await page.locator("#taCanvas").click();
  await surrenderThisMatch();
  await page.locator("#taCanvas").click();
  await page.locator("#taCanvas").press("Enter");
  await expect(page.locator("#taPhase")).toContainText(/Zielen/i);
  await page.locator("#taCanvas").press("Digit4");
  await expect(page.locator("#taPhase")).toContainText(/Blitz/i);
  await page.locator("#taCanvas").press("Space");
  await expect(page.locator("#taPhase")).toContainText(/Bot zielt/i, { timeout: 6000 });
});

test("panzer-artillerie: Feuerspur-Kosmetik im Shop kaufen", async ({ page }) => {
  await page.goto("/games/tank-artillery/");
  await page.evaluate(() => {
    localStorage.setItem("tank-artillery-gems", "100");
    localStorage.removeItem("tank-artillery-move-trails-owned-v1");
    localStorage.removeItem("tank-artillery-move-trail-equipped-v1");
  });
  await page.getByRole("button", { name: "Shop" }).click();
  await expect(page.getByRole("heading", { name: "Kosmetik" })).toBeVisible();
  await page.locator('[data-move-trail-purchase="fire"]').click();
  await expect(page.locator("#taShopCosmeticMsg")).toContainText(/gekauft|ausgerüstet/i, { timeout: 5000 });
  await expect(page.locator("#taShopGems")).toHaveText("15");
  expect(
    await page.evaluate(() => localStorage.getItem("tank-artillery-move-trails-owned-v1")),
  ).toContain("fire");
});

test("panzer-artillerie: Feuerspur im Shop testen (ohne Kauf)", async ({ page }) => {
  await page.goto("/games/tank-artillery/");
  await expect(page.getByRole("button", { name: "Bereit" })).toBeEnabled({ timeout: 15_000 });
  await page.evaluate(() => {
    localStorage.removeItem("tank-artillery-move-trails-owned-v1");
    localStorage.removeItem("tank-artillery-move-trail-equipped-v1");
  });
  await page.getByRole("button", { name: "Shop" }).click();
  await expect(page.getByRole("heading", { name: "Kosmetik" })).toBeVisible();
  await page.locator('[data-move-trail-test="fire"]').click();
  await expect(page.locator("#taCanvas")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#taPhase")).toContainText(/TEST.*Feuerspur/i);
  await expect(page.getByRole("button", { name: "Test beenden · Lobby" })).toBeVisible();
  await page.getByRole("button", { name: "Test beenden · Lobby" }).click();
  await expect(page.locator("#taStage")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Panzer-Artillerie" })).toBeVisible();
});

test("panzer-artillerie: Testspiel mit Esc verlassen", async ({ page }) => {
  await page.goto("/games/tank-artillery/");
  await expect(page.getByRole("button", { name: "Bereit" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Shop" }).click();
  await page.locator('[data-move-trail-test="lightning"]').click();
  await expect(page.locator("#taCanvas")).toBeVisible({ timeout: 15_000 });
  await page.locator("#taCanvas").press("Escape");
  await expect(page.locator("#taStage")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Panzer-Artillerie" })).toBeVisible();
});
