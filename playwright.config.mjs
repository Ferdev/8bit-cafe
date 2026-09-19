import { defineConfig } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./test/browser",
  timeout: 20_000,
  use: {
    baseURL: "http://127.0.0.1:8123",
    headless: true,
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: "python3 -m http.server 8123 --directory dist",
    url: "http://127.0.0.1:8123",
    reuseExistingServer: true,
  },
});
