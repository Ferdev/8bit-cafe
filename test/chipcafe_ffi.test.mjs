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
      assert.ok(candidate.events.length > 200);
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

test("unknown rooms cannot generate candidates", () => {
  assert.deepEqual(buildCandidates("retired-station", 0), []);
});
