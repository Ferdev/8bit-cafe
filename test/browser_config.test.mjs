import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generator = path.join(projectRoot, "tools", "write-browser-config.sh");

function generateConfig(environment = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), "chipcafe-config-"));
  const output = path.join(directory, "explicit", "browser-config.js");
  const env = { ...process.env };
  delete env.TYPESAFE_API_KEY;
  delete env.TYPESAFE_MODEL;
  Object.assign(env, environment);

  const result = spawnSync("sh", [generator, output], {
    cwd: directory,
    env,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
  assert.equal(existsSync(path.join(directory, "config.js")), false);

  const source = readFileSync(output, "utf8");
  const sandbox = { window: {}, atob };
  vm.runInNewContext(source, sandbox);
  return { config: sandbox.window.CHIPCAFE_CONFIG, output, source };
}

test("runtime config defaults safely when the key is unset", () => {
  const { config } = generateConfig();
  assert.equal(config.typesafeApiKey, "");
  assert.equal(config.typesafeModel, "jev-latest");
});

test("runtime config treats empty values safely", () => {
  const { config } = generateConfig({ TYPESAFE_API_KEY: "", TYPESAFE_MODEL: "" });
  assert.equal(config.typesafeApiKey, "");
  assert.equal(config.typesafeModel, "jev-latest");
});

test("runtime config writes a non-empty key only to the explicit target", () => {
  const syntheticKey = "test-only-browser-key";
  const { config, output, source } = generateConfig({
    TYPESAFE_API_KEY: syntheticKey,
    TYPESAFE_MODEL: "jev-test",
  });
  assert.equal(config.typesafeApiKey, syntheticKey);
  assert.equal(config.typesafeModel, "jev-test");
  assert.match(output, /explicit\/browser-config\.js$/);
  assert.equal(source.includes(syntheticKey), false);
});

test("runtime config preserves shell-sensitive characters without leaking them", () => {
  const syntheticKey = "quote'\"\\backslash\nnext-line\r\$dollar`backtick`";
  const syntheticModel = "model'\"\\name\nnext";
  const { config, source } = generateConfig({
    TYPESAFE_API_KEY: syntheticKey,
    TYPESAFE_MODEL: syntheticModel,
  });
  assert.equal(config.typesafeApiKey, syntheticKey);
  assert.equal(config.typesafeModel, syntheticModel);
  assert.equal(source.includes(syntheticKey), false);
  assert.equal(source.includes(syntheticModel), false);
});
