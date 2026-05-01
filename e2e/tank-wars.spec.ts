import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("tank wars: preload, choose tank, arena runs", async ({ page }) => {
  await page.goto("/games/tank-wars/");
  await expect(page).toHaveTitle(/Tank Wars/);
  await page.waitForFunction(() => (window as Window & { __twReady?: boolean }).__twReady === true);
  await expect(page.locator("#twSelectOverlay")).toBeVisible();
  await page.getByRole("button", { name: /Stürmer/i }).click();
  await expect(page.locator("#twSelectOverlay")).toBeHidden();
  await expect(page.locator("#arena")).toBeVisible();
});
