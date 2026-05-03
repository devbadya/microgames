import { expect, test } from "@playwright/test";

test("sky-hopper level select renders 10 levels", async ({ page }) => {
  await page.goto("/games/sky-hopper/");
  await expect(page.locator(".shLevelCard")).toHaveCount(10);
  await expect(page.locator(".shLevelCard").first()).toContainText("First Light");
});

test("sky-hopper completes level 1 via test API", async ({ page }) => {
  await page.goto("/games/sky-hopper/");
  await page.waitForFunction(() => Boolean((window as unknown as { __skyHopperTest?: object }).__skyHopperTest));
  await page.evaluate(() => {
    const api = (window as unknown as {
      __skyHopperTest: {
        start(level?: number): void;
        passNGates(n?: number): void;
        state(): { goal: number; cleared: boolean };
      };
    }).__skyHopperTest;
    api.start(1);
    api.passNGates(api.state().goal);
  });
  await expect(page.locator("#overlayEyebrow")).toContainText(/Level cleared|Campaign cleared/);
});
