import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createPreviewServer } from "../tools/preview-server.mjs";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

test("preview server serves the bundle and relays only the Jev endpoint", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "chipcafe-preview-"));
  writeFileSync(path.join(root, "index.html"), "preview home");
  const requests = [];
  const messages = [];
  const syntheticKey = "test-only-relay-key";
  const server = createPreviewServer({
    root,
    jevUpstream: "https://jev.invalid/v1/systemone",
    logger: { error: (message) => messages.push(message) },
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({ answers: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const origin = await listen(server);

  try {
    const page = await fetch(`${origin}/`);
    assert.equal(page.status, 200);
    assert.equal(await page.text(), "preview home");

    const payload = JSON.stringify({ state: "test", questions: {} });
    const response = await fetch(`${origin}/typesafe/v1/systemone`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${syntheticKey}`,
        "content-type": "application/json",
        origin: "https://preview.example",
        "x-typesafe-sdk": "typesafe-sdk/test",
      },
      body: payload,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { answers: {} });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://jev.invalid/v1/systemone");
    assert.equal(requests[0].options.headers.authorization, `Bearer ${syntheticKey}`);
    assert.equal(requests[0].options.headers["x-typesafe-sdk"], "typesafe-sdk/test");
    assert.equal("origin" in requests[0].options.headers, false);
    assert.equal(requests[0].options.body.toString(), payload);

    const rejected = await fetch(`${origin}/typesafe/v1/models`, { method: "POST" });
    assert.equal(rejected.status, 405);
    assert.equal(requests.length, 1);
    assert.equal(messages.join("\n").includes(syntheticKey), false);
  } finally {
    await close(server);
  }
});
