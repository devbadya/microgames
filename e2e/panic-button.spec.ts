import { expect, test } from "@playwright/test";

test("panic button renders tap zone", async ({ page }) => {
  await page.goto("/games/panic-button/");
  await expect(page.getByRole("heading", { name: /Panic Button/i })).toBeVisible();
  await expect(page.locator("#tap")).toBeVisible();
});
