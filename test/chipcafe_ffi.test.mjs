import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCandidates,
  selectLocalCandidate,
  validateCandidate,
} from "../src/chipcafe_ffi.mjs";

const roomIds = [
  "cvgm",
  "rainwave",
  "nectarine",
  "slay",
  "kaaos",
  "kohina",
  "keygen-fm",
  "sid-station",
  "rpgn",
  "radiosega",
  "gtt-radio",
  "ericade",
];

test("every room produces eight bounded, playable candidates", () => {
  for (const roomId of roomIds) {
    const candidates = buildCandidates(roomId, 0, "opening");
    assert.equal(candidates.length, 8, roomId);
    assert.equal(new Set(candidates.map(({ id }) => id)).size, 8, roomId);
    for (const candidate of candidates) {
      assert.equal(validateCandidate(candidate), true, `${roomId}:${candidate.id}`);
      assert.equal(candidate.totalBeats, 64);
      assert.ok(candidate.events.length > 350);
      assert.deepEqual(
        new Set(candidate.events.map(({ instrument }) => instrument)),
        new Set(["lead", "counter", "arp", "pulse", "pad", "bass", "stab", "texture", "kick", "snare", "hat"]),
      );
      assert.equal(Object.keys(candidate.waves).length, 8);
      assert.deepEqual(candidate.form, ["intro", "theme-a", "lift", "chorus", "finale"]);
      assert.equal(candidate.hook.length, 8 / candidate.melodyStep);
      assert.ok([0.25, 0.5, 1].includes(candidate.melodyStep));
      assert.ok(candidate.melody);
      assert.equal(candidate.visual.schemaVersion, 1);
      assert.ok(candidate.visual.scene);
      assert.equal(candidate.visual.palette.length, 3);
      assert.ok(candidate.visual.density >= 8);
    }
  }
});

test("candidate generation and fallback selection are deterministic", () => {
  const first = buildCandidates("cvgm", 4, "falling answer");
  const second = buildCandidates("cvgm", 4, "falling answer");
  assert.deepEqual(first, second);
  assert.equal(
    selectLocalCandidate(first, "cvgm", 4).id,
    selectLocalCandidate(second, "cvgm", 4).id,
  );
});

test("candidate validation rejects unsafe event data", () => {
  const [candidate] = buildCandidates("rainwave", 0, "opening");
  const invalid = structuredClone(candidate);
  invalid.events[0].velocity = 9;
  assert.equal(validateCandidate(invalid), false);
});

test("candidate validation rejects malformed song structure", () => {
  const [candidate] = buildCandidates("cvgm", 0, "opening");
  const invalidForm = structuredClone(candidate);
  invalidForm.form[2] = "arbitrary-section";
  assert.equal(validateCandidate(invalidForm), false);

  const invalidHook = structuredClone(candidate);
  invalidHook.hook[0] = 99;
  assert.equal(validateCandidate(invalidHook), false);
});

test("each room repeats an identifiable two-bar lead theme", () => {
  const melodies = new Set();
  const melodicSignatures = new Set();
  const rhythmicGrids = new Set();
  for (const roomId of roomIds) {
    for (const candidate of buildCandidates(roomId, 0, "opening")) {
      melodies.add(candidate.melody);
      melodicSignatures.add(`${candidate.melodyStep}:${candidate.hook.map((note) => note ?? "r").join(",")}`);
      rhythmicGrids.add(candidate.melodyStep);
      const lead = candidate.events.filter(({ instrument }) => instrument === "lead");
      for (let index = 1; index < lead.length; index += 1) {
        assert.ok(lead[index - 1].beat + lead[index - 1].duration <= lead[index].beat, `${roomId}:${candidate.id}:lead overlap`);
      }
      const phrase = (startBeat) => candidate.events
        .filter(({ instrument, beat }) => instrument === "lead" && beat >= startBeat && beat < startBeat + 8)
        .map(({ beat, duration, pitch }) => ({
          beat: Number((beat - startBeat).toFixed(3)),
          duration,
          pitch,
        }));
      assert.deepEqual(phrase(0), phrase(8), `${roomId}:${candidate.id}`);
    }
  }
  assert.equal(melodies.size, roomIds.length);
  assert.equal(melodicSignatures.size, roomIds.length);
  assert.deepEqual(rhythmicGrids, new Set([0.5, 1, 0.25]));
});

test("candidate validation rejects unsafe visual programs", () => {
  const [candidate] = buildCandidates("cvgm", 0, "opening");
  const invalidStyle = structuredClone(candidate);
  invalidStyle.visual.style = "arbitrary-script";
  assert.equal(validateCandidate(invalidStyle), false);

  const invalidPalette = structuredClone(candidate);
  invalidPalette.visual.palette[0] = "url(javascript:bad)";
  assert.equal(validateCandidate(invalidPalette), false);

  const invalidScene = structuredClone(candidate);
  invalidScene.visual.scene = "external-video";
  assert.equal(validateCandidate(invalidScene), false);
});

test("every room has a distinct arrangement and generated scene", () => {
  const candidates = roomIds.map((roomId) => buildCandidates(roomId, 0, "opening")[0]);
  assert.equal(new Set(candidates.map(({ profile }) => profile)).size, roomIds.length);
  assert.equal(new Set(candidates.map(({ visual }) => visual.scene)).size, roomIds.length);
  assert.ok(candidates.some(({ events }) => events.length > 700));
});

test("every room has deterministic visual variation", () => {
  for (const roomId of roomIds) {
    const first = buildCandidates(roomId, 2, "previous");
    const second = buildCandidates(roomId, 2, "previous");
    assert.deepEqual(first.map(({ visual }) => visual), second.map(({ visual }) => visual));
    assert.ok(new Set(first.map(({ visual }) => visual.style)).size >= 3, roomId);
  }
});

test("unknown rooms cannot generate candidates", () => {
  assert.deepEqual(buildCandidates("retired-station", 0), []);
});
