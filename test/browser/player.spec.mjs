import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__chipcafeJevDecide = async ({ criteria }) => {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return Object.keys(criteria)[0];
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
});
