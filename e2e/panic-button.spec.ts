import { expect, test } from "@playwright/test";

test("panic-button level select renders 10 levels", async ({ page }) => {
  await page.goto("/games/panic-button/");
  await expect(page.getByRole("heading", { name: /Panic Button/i })).toBeVisible();
  await expect(page.locator(".shLevelCard")).toHaveCount(10);
});

test("panic-button completes level 1 via test API", async ({ page }) => {
  await page.goto("/games/panic-button/");
  await page.waitForFunction(() => Boolean((window as unknown as { __panicTest?: object }).__panicTest));
  await page.evaluate(() => {
    const api = (window as unknown as {
      __panicTest: {
        start(level?: number): void;
        cleanGreens(n?: number): { cleared: boolean };
        state(): { goal: number };
      };
    }).__panicTest;
    api.start(1);
    api.cleanGreens(api.state().goal);
  });
  await expect(page.locator("#overlayEyebrow")).toContainText(/Level cleared|Campaign cleared/);
});
