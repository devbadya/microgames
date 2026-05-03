import { expect, test } from "@playwright/test";

test("mini-chess: lädt, Bauer zieht, Status wechselt", async ({ page }) => {
  await page.goto("/games/mini-chess/");
  await expect(page).toHaveTitle(/Mini-Schach|Mini Chess/i);
  await expect(page.getByRole("heading", { name: /Mini-Schach/i })).toBeVisible();
  await expect(page.locator("#mcStatus")).not.toContainText("Lädt", { timeout: 5000 });
  const board = page.locator("#mcBoard");
  await expect(board).toBeVisible();
  /** e2 (Mitte ~270,390), e4 (270,270) bei 480×480 und Zelle 60 */
  await board.click({ position: { x: 270, y: 390 } });
  await board.click({ position: { x: 270, y: 270 } });
  await expect(page.locator("#mcStatus")).toContainText(/KI|Schwarz|Zug/i, { timeout: 8000 });
});

test("mini-chess: KI-Schwierigkeit (Unmöglich) und Zug", async ({ page }) => {
  await page.goto("/games/mini-chess/");
  await expect(page.locator("#mcStatus")).not.toContainText("Lädt", { timeout: 5000 });
  await expect(page.getByRole("group", { name: /KI-Schwierigkeit/i })).toBeVisible();
  await page.getByRole("radio", { name: /Unmöglich/i }).check();
  const board = page.locator("#mcBoard");
  await board.click({ position: { x: 270, y: 390 } });
  await board.click({ position: { x: 270, y: 270 } });
  await expect(page.locator("#mcStatus")).toContainText(/KI|Schwarz|Zug/i, { timeout: 12_000 });
});
