import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: "node games/tank-artillery/promo-slot-stub.mjs",
      url: "http://127.0.0.1:5799/health",
      reuseExistingServer: !process.env.CI,
      name: "promo-stub",
    },
    {
      command: "pnpm exec vite --host 127.0.0.1 --port 5173",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
      name: "vite",
      env: {
        ...process.env,
        VITE_TANK_PROMO_CLAIM_URL: "http://127.0.0.1:5799/claim",
      },
    },
  ],
});
