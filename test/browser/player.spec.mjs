import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__chipcafeDelayNodes = 0;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const originalCreateDelay = AudioContextClass?.prototype.createDelay;
    if (originalCreateDelay) {
      AudioContextClass.prototype.createDelay = function (...args) {
        window.__chipcafeDelayNodes += 1;
        return originalCreateDelay.apply(this, args);
      };
    }
    window.__chipcafeJevDecide = async ({ criteria, visualCriteria }) => {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return {
        continuation: Object.keys(criteria)[1],
        setting: Object.keys(visualCriteria.setting)[2],
        cast: Object.keys(visualCriteria.cast)[1],
        atmosphere: Object.keys(visualCriteria.atmosphere)[0],
      };
    };
  });
});

test("buffers Jev music, plays, pauses, resumes, and stops on exit", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /insert coin/i }).click();
  await expect(page.locator(".room-card")).toHaveCount(12);
  await expect(page.locator("canvas.room-art")).toHaveCount(12);
  await expect(page.locator("img.room-art")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__chipcafePlayerDebug().lobbyVisualFrames)).toBeGreaterThan(0);
  const thumbnailWidths = await page.locator("canvas.room-art").evaluateAll((canvases) => canvases.map(({ width }) => width));
  expect(thumbnailWidths.every((width) => width === 320)).toBe(true);
  expect(await page.evaluate(() => performance.getEntriesByType("resource")
    .filter(({ name }) => name.endsWith(".gif")).length)).toBe(0);

  await page.locator(".room-card").first().click();
  await expect(page.getByRole("status")).toContainText(/COMPOSING|BUFFERING/);
  await expect(page.getByRole("status")).toContainText("JEV GENERATING LIVE");

  const playing = await page.evaluate(() => window.__chipcafePlayerDebug());
  expect(playing.active).toBe(true);
  expect(playing.roomId).toBe("cvgm");
  expect(playing.queuedSeconds).toBeGreaterThan(12);
  expect(playing.provenance).toBe("jev");
  expect(playing.musicProfile).toBe("night-drive");
  expect(playing.melodyProfile).toBe("neon signal");
  expect(playing.tonalVoices).toBe(8);
  expect(playing.visualScene).toBe("skyline");
  expect(playing.visualSetting).toBe("bookshop");
  expect(playing.visualCast).toBe("friends");
  expect(playing.visualAtmosphere).toBe("rain");
  expect(playing.visualProvenance).toBe("jev");
  expect(playing.visualFrames).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__chipcafeDelayNodes)).toBe(0);
  await expect(page.locator("canvas.room-visual")).toHaveCount(1);
  const canvasPixels = await page.locator("canvas.room-visual").evaluate((canvas) => ({
    width: canvas.width,
    height: canvas.height,
    imageRendering: getComputedStyle(canvas).imageRendering,
  }));
  expect(canvasPixels.width).toBe(320);
  expect(canvasPixels.height).toBeLessThanOrEqual(320);
  expect(canvasPixels.imageRendering).toBe("pixelated");
  await expect(page.locator("img.room-bg")).toHaveCount(0);

  await page.getByRole("button", { name: /pause/i }).click();
  await expect(page.getByRole("status")).toHaveText("PAUSED");
  await expect.poll(() => page.evaluate(() => window.__chipcafePlayerDebug().active)).toBe(false);

  await page.getByRole("button", { name: /play/i }).click();
  await expect(page.getByRole("status")).toContainText("JEV GENERATING LIVE");

  await page.getByRole("button", { name: /lobby/i }).click();
  await expect(page.locator(".room-card")).toHaveCount(12);
  await expect.poll(() => page.evaluate(() => window.__chipcafePlayerDebug().active)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__chipcafePlayerDebug().lobbyVisualFrames)).toBeGreaterThan(0);
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
  expect(state.visualSetting).toBeTruthy();
  expect(state.visualProvenance).toBe("local");
  expect(state.visualFrames).toBeGreaterThan(0);
  expect(state.spriteStatus).toBe("unconfigured");
  expect(state.spriteApiCalls).toBe(0);
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
  const paintRequests = [];
  await page.route("**/typesafe/v1/systemone", async (route) => {
    const request = route.request();
    const payload = request.postDataJSON();
    if (["design_sprite", "paint_sprite", "animate_sprite"].includes(payload.state.task)) {
      paintRequests.push({
        sprite: payload.state.sprite,
        task: payload.state.task,
        pixels: Object.keys(payload.questions).length,
        relayKeyPresent: request.headers()["x-chipcafe-jev-key"] === "test-only-browser-key",
      });
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          answers: Object.fromEntries(Object.keys(payload.questions).map((key) => {
            if (payload.state.task === "design_sprite") {
              const choice = Object.keys(payload.questions[key].criteria)[1];
              return [key, { type: "choice", choice, confidence: 1, probabilities: { [choice]: 1 } }];
            }
            const [, x, y] = key.split("_").map(Number);
            const original = payload.state.reference_grid[y][x];
            const colour = original === "r" && Object.hasOwn(payload.questions[key].criteria, "R") ? "R" : original;
            return [key, { type: "choice", choice: colour, confidence: 1, probabilities: { [colour]: 1 } }];
          })),
          model: "jev-test", usage: { input_tokens: 1, output_tokens: 1 },
        }),
      });
      return;
    }
    requestMetadata = {
      authorizationPresent: request.headers().authorization === "Bearer test-only-browser-key",
      relayKeyPresent: request.headers()["x-chipcafe-jev-key"] === "test-only-browser-key",
      origin: new URL(request.url()).origin,
      path: new URL(request.url()).pathname,
      musicProfile: payload.state.music_profile,
      melodyProfile: payload.state.melody_profile,
      tonalVoices: payload.state.available_voices.length,
      visualScene: payload.state.visual_scene,
      artQuestions: Object.keys(payload.questions).filter((key) => key !== "continuation").sort(),
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
          setting: { type: "choice", choice: "records", confidence: 1, probabilities: { records: 1 } },
          cast: { type: "choice", choice: "courier", confidence: 1, probabilities: { courier: 1 } },
          atmosphere: { type: "choice", choice: "mist", confidence: 1, probabilities: { mist: 1 } },
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
    musicProfile: "night-drive",
    melodyProfile: "neon signal",
    tonalVoices: 8,
    visualScene: "skyline",
    artQuestions: ["atmosphere", "cast", "setting"],
  });
  const state = await page.evaluate(() => window.__chipcafePlayerDebug());
  expect(state.provenance).toBe("jev");
  expect(state.visualSetting).toBe("records");
  expect(state.visualCast).toBe("courier");
  expect(state.visualAtmosphere).toBe("mist");
  expect(state.visualProvenance).toBe("jev");
  await expect.poll(() => page.evaluate(() => window.__chipcafePlayerDebug().spriteStatus)).toBe("ready");
  expect((await page.evaluate(() => window.__chipcafePlayerDebug().generatedSprites)).sort()).toEqual(["fern", "person", "robot"]);
  expect(paintRequests.length).toBe(15);
  expect(paintRequests.every(({ pixels, relayKeyPresent }) => pixels <= 96 && relayKeyPresent)).toBe(true);
  expect(paintRequests.some(({ task }) => task === "animate_sprite")).toBe(true);
});

test("Jev paints pixels during playback, updates thumbnails and reuses sprites on resume", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.__paintCalls = 0;
    window.__allowPaint = false;
    window.__chipcafeJevPaint = async ({ state, questions }) => {
      window.__paintCalls++;
      while (!window.__allowPaint) await new Promise((resolve) => setTimeout(resolve, 25));
      return { answers: Object.fromEntries(Object.keys(questions).map((key) => {
        if (state.task === "design_sprite") return [key, { choice: Object.keys(questions[key].criteria)[1] }];
        const [, x, y] = key.split("_").map(Number);
        const original = state.reference_grid[y][x];
        return [key, { choice: original === "r" ? "R" : original }];
      })) };
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: /insert coin/i }).click();
  expect(await page.evaluate(() => window.__paintCalls)).toBe(0);
  await page.locator(".room-card").first().click();
  await expect(page.getByRole("status")).toContainText("JEV GENERATING LIVE");
  await expect.poll(() => page.evaluate(() => window.__chipcafePlayerDebug().spriteStatus)).toBe("painting");
  expect(await page.evaluate(() => window.__chipcafePlayerDebug().queuedSeconds)).toBeGreaterThan(12);
  const canvas = page.locator("canvas.room-visual");
  const before = await canvas.evaluate((canvas) => canvas.toDataURL());
  await page.evaluate(() => { window.__allowPaint = true; });
  await expect.poll(() => page.evaluate(() => window.__chipcafePlayerDebug().spriteStatus)).toBe("ready");
  const painted = await canvas.evaluate((canvas) => canvas.toDataURL());
  expect(painted).not.toBe(before);
  const state = await page.evaluate(() => window.__chipcafePlayerDebug());
  expect(state.generatedSprites).toEqual(["person", "fern"]);
  expect(state.generatedSpriteFrames).toBe(3);
  expect(state.spriteApiCalls).toBe(10);

  await page.getByRole("button", { name: /pause/i }).click();
  await expect(page.getByRole("status")).toHaveText("PAUSED");
  await page.getByRole("button", { name: /play/i }).click();
  await expect.poll(() => page.evaluate(() => window.__chipcafePlayerDebug().spriteStatus)).toBe("ready");
  expect(await page.evaluate(() => window.__chipcafePlayerDebug().spriteApiCalls)).toBe(0);
  expect(await page.evaluate(() => window.__paintCalls)).toBe(10);
  expect(await canvas.evaluate((canvas) => canvas.toDataURL())).toBe(painted);
  await page.getByRole("button", { name: /lobby/i }).click();
  await expect.poll(() => page.locator("canvas.room-art").first().evaluate((canvas) => canvas.toDataURL())).toBe(painted);
  expect(await page.evaluate(() => window.__paintCalls)).toBe(10);
});

test("leaving a room cancels painting without publishing late pixels or starting more requests", async ({ page }) => {
  await page.addInitScript(() => {
    window.__paintCalls = 0;
    window.__chipcafeJevPaint = async ({ state, questions }) => {
      window.__paintCalls++;
      await new Promise((resolve) => { window.__finishPaint = resolve; });
      return { answers: Object.fromEntries(Object.keys(questions).map((key) => {
        if (state.task === "design_sprite") return [key, { choice: Object.keys(questions[key].criteria)[1] }];
        const [, x, y] = key.split("_").map(Number);
        return [key, { choice: state.reference_grid[y][x] }];
      })) };
    };
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.name));
  await page.goto("/");
  await page.getByRole("button", { name: /insert coin/i }).click();
  await page.locator(".room-card").first().click();
  await expect.poll(() => page.evaluate(() => window.__paintCalls)).toBe(1);
  await page.getByRole("button", { name: /lobby/i }).click();
  await page.evaluate(async () => {
    window.__finishPaint();
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  expect(await page.evaluate(() => window.__paintCalls)).toBe(1);
  await page.locator(".room-card").first().click();
  await expect.poll(() => page.evaluate(() => window.__paintCalls)).toBe(2);
  expect(await page.evaluate(() => window.__chipcafePlayerDebug().generatedSprites)).toEqual([]);
  await page.getByRole("button", { name: /lobby/i }).click();
  expect(errors).toEqual([]);
});

test("invalid sprite pixels retain the authored art while music keeps playing", async ({ page }) => {
  await page.addInitScript(() => {
    window.__chipcafeJevPaint = async ({ state, questions }) => state.task === "design_sprite"
      ? { answers: Object.fromEntries(Object.entries(questions).map(([key, question]) => [key, { choice: Object.keys(question.criteria)[0] }])) }
      : { answers: {} };
  });
  await page.goto("/");
  await page.getByRole("button", { name: /insert coin/i }).click();
  await page.locator(".room-card").first().click();
  await expect(page.getByRole("status")).toContainText("JEV GENERATING LIVE");
  await expect.poll(() => page.evaluate(() => window.__chipcafePlayerDebug().spriteStatus)).toBe("fallback");
  const state = await page.evaluate(() => window.__chipcafePlayerDebug());
  expect(state.generatedSprites).toEqual([]);
  expect(state.spriteApiCalls).toBe(4);
  expect(state.queuedSeconds).toBeGreaterThan(12);
  await page.getByRole("button", { name: /pause/i }).click();
  await page.getByRole("button", { name: /play/i }).click();
  await expect.poll(() => page.evaluate(() => window.__chipcafePlayerDebug().spriteStatus)).toBe("fallback");
  expect(await page.evaluate(() => window.__chipcafePlayerDebug().spriteApiCalls)).toBe(0);
});

test("all sprite settings render distinct art and the lobby remembers Jev's composition", async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.__artVariant = 0;
    window.__chipcafeJevDecide = async ({ criteria, visualCriteria }) => ({
      continuation: Object.keys(criteria)[0],
      ...Object.fromEntries(Object.entries(visualCriteria).map(([key, options]) => [
        key, Object.keys(options)[window.__artVariant],
      ])),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /insert coin/i }).click();
  const scenes = new Set();
  for (let room = 0; room < 12; room++) {
    for (let variant = 0; variant < 3; variant++) {
      await page.evaluate((value) => { window.__artVariant = value; }, variant);
      await page.locator(".room-card").nth(room).click();
      await expect.poll(() => page.evaluate(() => window.__chipcafePlayerDebug().visualProvenance)).toBe("jev");
      const art = await page.locator("canvas.room-visual").evaluate((canvas) => {
        const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
        const colours = new Set();
        for (let index = 0; index < pixels.length; index += 4) {
          colours.add(pixels[index] * 65536 + pixels[index + 1] * 256 + pixels[index + 2]);
        }
        return { pixels: canvas.toDataURL(), colourCount: colours.size };
      });
      const { pixels } = art;
      const roomId = await page.evaluate(() => window.__chipcafePlayerDebug().roomId);
      expect(art.colourCount).toBeGreaterThan(3);
      expect(art.colourCount).toBeLessThanOrEqual(roomId === "kaaos" ? 4 : 16);
      expect(scenes.has(pixels)).toBe(false);
      scenes.add(pixels);
      await page.getByRole("button", { name: /lobby/i }).click();
      await expect.poll(() => page.locator("canvas.room-art").nth(room).evaluate((canvas) => canvas.toDataURL())).toBe(pixels);
    }
  }
  expect(scenes.size).toBe(36);
});

test("sprite animation changes frames and retains proportions on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /insert coin/i }).click();
  await page.locator(".room-card").first().click();
  await expect.poll(() => page.evaluate(() => window.__chipcafePlayerDebug().visualProvenance)).toBe("jev");
  const canvas = page.locator("canvas.room-visual");
  const firstFrame = await canvas.evaluate((element) => element.toDataURL());
  await expect.poll(() => canvas.evaluate((element) => element.toDataURL())).not.toBe(firstFrame);
  expect(await canvas.evaluate((element) => ({
    width: element.width, height: element.height, fit: getComputedStyle(element).objectFit,
  }))).toEqual({ width: 320, height: 180, fit: "contain" });
  const sceneBounds = await canvas.boundingBox();
  const controlsBounds = await page.locator(".room-panel").boundingBox();
  expect(sceneBounds.y + sceneBounds.height).toBeLessThanOrEqual(controlsBounds.y);
});
