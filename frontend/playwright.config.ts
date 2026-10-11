import { defineConfig, devices } from "@playwright/test";

const live = process.env.CAKE_E2E_LIVE === "1";
const preview = process.env.CAKE_E2E_PREVIEW === "1";
export default defineConfig({
  testDir: "./e2e",
  testMatch: live ? "live.spec.ts" : "explorer.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000, toHaveScreenshot: { animations: "disabled" } },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 900 },
    locale: "en-GB",
    timezoneId: "Europe/London",
    colorScheme: "light",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "firefox", grep: /@smoke/, use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [...(live ? [{
    command: `${process.env.CAKE_PYTHON ?? ".viewer/bin/python"} -m gunicorn --bind 127.0.0.1:5000 --workers 1 app:app`,
    cwd: "../backend",
    url: "http://127.0.0.1:5000/api/taxonomies",
    reuseExistingServer: false,
  }] : []), {
    command: preview ? "vite preview --config vite.e2e.config.ts" : "vite --config vite.e2e.config.ts",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  }],
});
