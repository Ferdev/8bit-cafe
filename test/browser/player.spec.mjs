import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__chipcafeJevDecide = async ({ criteria }) => {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return Object.keys(criteria)[1];
    };
  });
});

test("buffers Jev music, plays, pauses, resumes, and stops on exit", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /insert coin/i }).click();
  await expect(page.locator(".room-card")).toHaveCount(12);

  await page.locator(".room-card").first().click();
  await expect(page.getByRole("status")).toContainText(/COMPOSING|BUFFERING/);
  await expect(page.getByRole("status")).toContainText("JEV GENERATING LIVE");

  const playing = await page.evaluate(() => window.__chipcafePlayerDebug());
  expect(playing.active).toBe(true);
  expect(playing.roomId).toBe("cvgm");
  expect(playing.queuedSeconds).toBeGreaterThan(12);
  expect(playing.provenance).toBe("jev");
  expect(playing.visualStyle).toBe("bars");
  expect(playing.visualFrames).toBeGreaterThan(0);
  await expect(page.locator("canvas.room-visual")).toHaveCount(1);

  await page.getByRole("button", { name: /pause/i }).click();
  await expect(page.getByRole("status")).toHaveText("PAUSED");
  await expect.poll(() => page.evaluate(() => window.__chipcafePlayerDebug().active)).toBe(false);

  await page.getByRole("button", { name: /play/i }).click();
  await expect(page.getByRole("status")).toContainText("JEV GENERATING LIVE");

  await page.getByRole("button", { name: /lobby/i }).click();
  await expect(page.locator(".room-card")).toHaveCount(12);
  await expect.poll(() => page.evaluate(() => window.__chipcafePlayerDebug().active)).toBe(false);
});

test("falls back locally when Jev is not configured", async ({ page }) => {
  await page.addInitScript(() => {
    delete window.__chipcafeJevDecide;
  });
  await page.goto("/");
  await page.getByRole("button", { name: /insert coin/i }).click();
  await page.locator(".room-card").nth(1).click();

  await expect(page.getByRole("status")).toContainText("GENERATIVE FALLBACK");
  const state = await page.evaluate(() => window.__chipcafePlayerDebug());
  expect(state.active).toBe(true);
  expect(state.roomId).toBe("rainwave");
  expect(state.queuedSeconds).toBeGreaterThan(12);
  expect(state.visualStyle).toBeTruthy();
  expect(state.visualFrames).toBeGreaterThan(0);
});

test("sends the SDK request through the same-origin Jev relay", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__chipcafeJevDecide", {
      value: undefined,
      writable: false,
    });
  });
  await page.route("**/config.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `window.CHIPCAFE_CONFIG = Object.freeze({
      typesafeApiKey: "test-only-browser-key",
      typesafeModel: "jev-test",
    });`,
  }));

  let requestMetadata = null;
  await page.route("**/typesafe/v1/systemone", async (route) => {
    const request = route.request();
    requestMetadata = {
      authorizationPresent: request.headers().authorization === "Bearer test-only-browser-key",
      relayKeyPresent: request.headers()["x-chipcafe-jev-key"] === "test-only-browser-key",
      origin: new URL(request.url()).origin,
      path: new URL(request.url()).pathname,
    };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        answers: {
          continuation: {
            type: "choice",
            choice: "option_1",
            probabilities: { option_1: 1 },
            confidence: 1,
          },
        },
        model: "jev-test",
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /insert coin/i }).click();
  await page.locator(".room-card").first().click();
  await expect(page.getByRole("status")).toContainText("JEV GENERATING LIVE");

  expect(requestMetadata).toEqual({
    authorizationPresent: true,
    relayKeyPresent: true,
    origin: "http://127.0.0.1:8123",
    path: "/typesafe/v1/systemone",
  });
  const state = await page.evaluate(() => window.__chipcafePlayerDebug());
  expect(state.provenance).toBe("jev");
  expect(state.visualStyle).toBe("bars");
});
