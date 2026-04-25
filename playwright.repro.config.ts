import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /repro-.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: { baseURL: "http://localhost:3000", trace: "off" },
  projects: [{ name: "iPhone12", use: { ...devices["iPhone 12"] } }],
});
