import { expect, test } from "@playwright/test";

test("tetris level select renders 10 levels", async ({ page }) => {
  await page.goto("/games/tetris/");
  await expect(page.locator(".shLevelCard")).toHaveCount(10);
  await expect(page.locator(".shLevelCard").first()).toContainText("Plumb Lines");
});

test("tetris completes level 1 via test API", async ({ page }) => {
  await page.goto("/games/tetris/");
  await page.waitForFunction(() => Boolean((window as unknown as { __tetrisTest?: object }).__tetrisTest));
  await page.evaluate(() => {
    const api = (window as unknown as {
      __tetrisTest: {
        start(level?: number): void;
        clearLines(n: number): void;
        state(): { goal: number };
      };
    }).__tetrisTest;
    api.start(1);
    const goal = api.state().goal;
    api.clearLines(goal);
  });
  await expect(page.locator("#overlayEyebrow")).toContainText(/Level cleared|Campaign cleared/);
});
