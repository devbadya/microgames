import { expect, test } from "@playwright/test";

test("dino run: start, then score a point or reach game over", async ({ page }) => {
  await page.goto("/games/dino-run/");
  await expect(page).toHaveTitle(/Dino Run/);
  const overlay = page.locator("#overlay");
  const overlayMsg = page.locator("#overlayMsg");
  await expect(overlay).toBeVisible();
  await page.keyboard.press("Space");
  await expect(overlay).toBeHidden({ timeout: 5000 });
  for (let i = 0; i < 400; i++) {
    if (i % 3 === 0) await page.keyboard.press("Space");
    const raw = await page.locator("#score").textContent();
    const n = raw ? parseInt(raw, 10) : 0;
    if (n > 0) return;
    if (await overlay.isVisible()) {
      const msg = (await overlayMsg.textContent()) ?? "";
      if (msg.toLowerCase().includes("restart")) return;
    }
    await page.waitForTimeout(40);
  }
  throw new Error("Timed out without score or game-over overlay");
});

test("dino run: pause, continue, leave link", async ({ page }) => {
  await page.goto("/games/dino-run/");
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
