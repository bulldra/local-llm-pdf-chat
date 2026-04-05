import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  globalTeardown: "./tests/global-teardown.ts",
  use: {
    baseURL: "http://localhost:5173",
    video: "on",
  },
  webServer: {
    command: "bun dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
});
