import assert from "node:assert/strict";
import test from "node:test";
import { ART_DIRECTIONS, createVisualProgram, spriteReference, spritesForProgram } from "../src/chipcafe_art.mjs";
import { generateSprite, pixelBatches, PIXELS_PER_REQUEST, spriteSpec, validateSpriteFrame } from "../src/chipcafe_jev_sprites.mjs";
import { readSpriteDesign, spriteDesignQuestions, spriteGuide } from "../src/chipcafe_sprite_design.mjs";

const program = createVisualProgram("cvgm");
const signal = () => new AbortController().signal;
function answerPixels({ state, questions }) {
  if (state.task === "design_sprite") return { answers: Object.fromEntries(Object.entries(questions).map(([key, question]) => [
    key, { choice: Object.keys(question.criteria)[1] },
  ])) };
  return { answers: Object.fromEntries(Object.keys(questions).map((key) => {
    const [, x, y] = key.split("_").map(Number);
    const source = state.reference_grid[y][x];
    const colour = source === "r" && Object.hasOwn(questions[key].criteria, "R") ? "R" : source;
    return [key, { type: "choice", choice: colour }];
  })) };
}

test("all room sprites have bounded pixel questions with explicit coordinates and palette choices", () => {
  const names = new Set();
  for (const room of Object.keys(ART_DIRECTIONS)) for (let variant = 0; variant < 3; variant++) {
    const visual = createVisualProgram(room, 0, variant);
    for (const name of spritesForProgram(visual)) {
      names.add(name);
      const spec = spriteSpec(visual, name);
      const questions = spriteDesignQuestions(name);
      spec.state.reference_grid = spriteGuide(spec, readSpriteDesign(name, answerPixels({ state: { task: "design_sprite" }, questions })));
      assert.ok(validateSpriteFrame(spriteReference(name)[0], spec), `${room}:${name}`);
      const pixels = Array.from({ length: spec.width * spec.height }, (_, i) => [i % spec.width, Math.floor(i / spec.width)]);
      const batches = pixelBatches(spec, pixels);
      assert.ok(batches.length <= 4);
      assert.equal(batches.flatMap(({ cells }) => cells).length, spec.width * spec.height);
      for (const batch of batches) {
        assert.ok(Object.keys(batch.questions).length <= PIXELS_PER_REQUEST);
        assert.ok(JSON.stringify(batch).length < 80_000);
        for (const [x, y] of batch.cells) {
          const question = batch.questions[`pixel_${x}_${y}`];
          assert.equal(question.type, "choice");
          assert.ok(question.instructions.includes(`x=${x}, y=${y}`));
          assert.ok(Object.hasOwn(question.criteria, "."));
          assert.ok(Object.hasOwn(question.criteria, "k"));
        }
      }
    }
  }
  assert.equal(names.size, 8);
  assert.equal(spriteSpec(program, "__proto__"), null);
  assert.equal(spriteSpec({ roomId: "unknown" }, "person"), null);
});

test("Jev's individual choices become sprite pixels and a separate animation pose", async () => {
  const reference = spriteReference("person");
  const calls = [];
  const frames = await generateSprite(program, "person", async (payload) => {
    calls.push(payload);
    return answerPixels(payload);
  }, signal());
  assert.equal(calls.length, 6);
  assert.equal(calls[0].state.task, "design_sprite");
  assert.equal(calls[0].state.reference_grid, undefined, "no finished fallback sprite is sent to Jev");
  assert.equal(calls.filter(({ state }) => state.task === "paint_sprite").length, 4);
  assert.equal(calls.at(-1).state.task, "animate_sprite");
  assert.deepEqual(frames[0], calls[1].state.reference_grid.map((row) => row.replaceAll("r", "R")));
  assert.notDeepEqual(frames[0], reference[0]);
  assert.equal(frames.length, 2);
  assert.notDeepEqual(frames[1], frames[0]);
  assert.ok(Object.isFrozen(frames) && Object.isFrozen(frames[0]));
  assert.deepEqual(spriteReference("person"), reference, "offline reference must stay unchanged");
});

test("missing and unrecognised pixel answers cannot become partial sprites", async () => {
  for (const invalid of [undefined, "__proto__", "#ffffff", "rr", "<script>"]) {
    let calls = 0;
    await assert.rejects(generateSprite(program, "person", async (payload) => {
      calls++;
      const response = answerPixels(payload);
      if (payload.state.task === "design_sprite") return response;
      response.answers[Object.keys(payload.questions)[0]] = { choice: invalid };
      return response;
    }, signal()), { message: "Invalid sprite pixel" });
    assert.equal(calls, 2);
  }
});

test("empty, oversized, malformed and fragmented sheets are rejected", () => {
  const spec = spriteSpec(program, "person");
  const empty = Array(spec.height).fill(".".repeat(spec.width));
  const solid = Array(spec.height).fill("k".repeat(spec.width));
  const fragmented = Array.from({ length: spec.height }, (_, y) =>
    Array.from({ length: spec.width }, (_, x) => y % 3 === 0 && x % 3 === 0 ? x % 2 === 0 ? "k" : "r" : ".").join(""));
  for (const frame of [null, [], empty, solid, fragmented, [...empty, empty[0]], empty.map((row) => row + "."), empty.map(() => "x".repeat(spec.width))]) {
    assert.equal(validateSpriteFrame(frame, spec), false);
  }
});

test("an unavailable motion pass retains only the validated Jev base frame", async () => {
  const frames = await generateSprite(program, "person", async (payload) => {
    if (payload.state.task === "animate_sprite") throw new Error("Unavailable");
    return answerPixels(payload);
  }, signal());
  assert.equal(frames.length, 1);
  assert.ok(validateSpriteFrame(frames[0], spriteSpec(program, "person")));
});

test("cancellation during painting or animation never returns a sheet or starts another request", async () => {
  for (const abortAt of [1, 3, 6]) {
    const controller = new AbortController();
    let calls = 0;
    await assert.rejects(generateSprite(program, "person", async (payload) => {
      if (++calls === abortAt) controller.abort();
      return answerPixels(payload);
    }, controller.signal), { name: "AbortError" });
    assert.equal(calls, abortAt);
  }
});

test("all Jev design choices produce connected, palette-safe guides and malformed designs are rejected", () => {
  for (const name of ["person", "cat", "fox", "robot", "fern", "mushroom", "gull", "crate"]) {
    const questions = spriteDesignQuestions(name);
    const spec = spriteSpec(program, name);
    const variants = new Set();
    for (const shape of Object.keys(questions.shape.criteria))
      for (const detail of Object.keys(questions.detail.criteria))
        for (const marking of Object.keys(questions.marking.criteria)) {
          for (const phase of [0, 1]) {
            const frame = spriteGuide(spec, { shape, detail, marking }, phase);
            assert.ok(validateSpriteFrame(frame, spec), `${name}:${shape}:${detail}:${marking}:${phase}`);
            variants.add(frame.join(""));
          }
        }
    assert.ok(variants.size >= 18, name);
    assert.throws(() => readSpriteDesign(name, { answers: { shape: { choice: "__proto__" } } }), { message: "Invalid sprite design" });
  }
});
