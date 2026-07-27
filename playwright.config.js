import {defineConfig, devices} from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:4174",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: "package.spec.js",
      use: {...devices["Desktop Chrome"]},
    },
    {
      name: "firefox",
      testIgnore: "package.spec.js",
      use: {...devices["Desktop Firefox"]},
    },
    {
      name: "webkit",
      testIgnore: "package.spec.js",
      use: {...devices["Desktop Safari"]},
    },
    {
      name: "node",
      testMatch: "package.spec.js",
    },
  ],
  webServer: {
    command: "npm run dev -- --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: true,
  },
});
