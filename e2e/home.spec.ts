import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("microgames.deviceLayout", "desktop");
  });
});

test("home loads and language toggle switches hero copy", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".heroTitle")).toContainText(/Tiny games/i);
  await page.getByRole("button", { name: "DE" }).first().click();
  await expect(page.locator(".heroTitle")).toContainText(/Mini-Games mit Maxi-Spaß/i);
  await page.getByRole("button", { name: "EN" }).first().click();
  await expect(page.locator(".heroTitle")).toContainText(/Tiny games/i);
});

test("home lists game cards linking to game folders", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-game-slug]")).toHaveCount(6);
  const dino = page.locator('[data-game-slug="dino-run"]');
  await expect(dino).toHaveCount(1);
  await expect(dino).toHaveAttribute("href", /dino-run/);
  const ta = page.locator('[data-game-slug="tank-artillery"]');
  await expect(ta).toHaveCount(1);
  await expect(ta).toHaveAttribute("href", /tank-artillery/);
});

test("first visit shows device gate; choice dismisses and sets layout", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: /How are you playing/i })).toBeVisible();
  await page.getByRole("button", { name: "Tablet" }).click();
  await expect(page.locator("#deviceGate")).toBeHidden();
  await expect(page.getByRole("heading", { name: /Tiny games/i })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-device-layout", "tablet");
  await context.close();
});
