import { defineConfig } from "@playwright/test";

// Runs against an already-started production build (npm run build && npm start) on a LOCAL test database.
// Set E2E_CHROME to a local Chrome/Chromium path if Playwright's bundled browser isn't installed.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3200",
    launchOptions: process.env.E2E_CHROME ? { executablePath: process.env.E2E_CHROME } : {},
    trace: "retain-on-failure",
  },
});
