import { defineConfig, devices } from "@playwright/test";
import { clerkSetup } from "@clerk/testing/playwright";

export default defineConfig({
  globalSetup: require.resolve("./e2e/global.setup.ts"),
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "html",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: {
        launchOptions: {
          args: ["--unsafely-treat-insecure-origin-as-secure=http://localhost:3000"],
        },
      },
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
        launchOptions: {
          args: ["--unsafely-treat-insecure-origin-as-secure=http://localhost:3000"],
        },
      },
      dependencies: ["setup"],
    },
  ],
  // Uncomment when dev server is not already running:
  // webServer: {
  //   command: "npm run dev",
  //   url: "http://localhost:3000",
  //   reuseExistingServer: true,
  //   timeout: 120_000,
  // },
});
