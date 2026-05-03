import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function waitDinoReady(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForFunction(() => (window as Window & { __dinoReady?: boolean }).__dinoReady === true);
}

async function dismissDinoSetup(page: import("@playwright/test").Page): Promise<void> {
  await page.locator("#setupContinue").click();
}

test("dino run: start, then score a point or reach game over", async ({ page }) => {
  await page.goto("/games/dino-run/");
  await waitDinoReady(page);
  await expect(page).toHaveTitle(/Dino Run/);
  await expect(page.locator("#setupOverlay")).toBeVisible();
  await dismissDinoSetup(page);
  const overlay = page.locator("#overlay");
  const overlayEyebrow = page.locator("#overlayEyebrow");
  await expect(overlay).toBeVisible();
  await page.keyboard.press("Space");
  await expect(overlay).toBeHidden({ timeout: 5000 });
  for (let i = 0; i < 400; i++) {
    if (i % 3 === 0) await page.keyboard.press("Space");
    const raw = await page.locator("#score").textContent();
    const n = raw ? parseInt(raw, 10) : 0;
    if (n > 0) return;
    if (await overlay.isVisible()) {
      const eyebrow = ((await overlayEyebrow.textContent()) ?? "").toLowerCase();
      if (eyebrow.includes("failed") || eyebrow.includes("level cleared") || eyebrow.includes("campaign")) {
        return;
      }
    }
    await page.waitForTimeout(40);
  }
  throw new Error("Timed out without score or game-over overlay");
});

test("dino run: pause, continue, leave link", async ({ page }) => {
  await page.goto("/games/dino-run/");
  await waitDinoReady(page);
  await dismissDinoSetup(page);
  await page.keyboard.press("Space");
  await expect(page.locator("#overlay")).toBeHidden({ timeout: 5000 });
  // Pause immediately so a quick game over does not hide the pause control.
  await page.keyboard.press("p");
  await expect(page.locator("#pauseOverlay")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Paused" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Leave" })).toHaveAttribute("href", "../../");
  await page.locator("#pauseContinue").click();
  await expect(page.locator("#pauseOverlay")).toBeHidden();
  await expect(page.locator("#score")).toBeVisible();
  await expect(page.locator("#pauseBtn")).toBeVisible();
});

test("dino run: level select shows 10 levels and clears via test API", async ({ page }) => {
  await page.goto("/games/dino-run/");
  await waitDinoReady(page);
  await dismissDinoSetup(page);
  await expect(page.locator(".shLevelCard")).toHaveCount(10);

  await page.evaluate(() => {
    const api = (window as unknown as {
      __dinoTest: {
        start(level?: number): void;
        scoreTo(score: number): void;
        state(): { goal: number };
      };
    }).__dinoTest;
    api.start(1);
    api.scoreTo(api.state().goal);
  });

  await expect(page.locator("#overlayEyebrow")).toContainText(/Level cleared|Campaign cleared/);
});
