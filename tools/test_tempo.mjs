#!/usr/bin/env node
// Unit checks for the auto-DJ tempo engine: beat-grid detection, the
// tempo-match rate between two tracks, and next-track selection by tempo.
// Run with: node tools/test_tempo.mjs
import assert from "node:assert/strict";
import {
  detectTempo,
  onsetEnvelope,
  pickNextByTempo,
  syncRate,
} from "../src/chipcafe_tempo.mjs";

// A synthetic click track: one short burst on every beat.
function clickTrack(bpm, seconds, sampleRate = 11025) {
  const samples = new Float32Array(Math.floor(seconds * sampleRate));
  const period = 60 / bpm;
  for (let t = 0.25; t < seconds; t += period) {
    const start = Math.floor(t * sampleRate);
    for (let i = 0; i < 40 && start + i < samples.length; i += 1) {
      samples[start + i] = (i % 2 === 0 ? 1 : -1) * (1 - i / 40);
    }
  }
  return samples;
}

for (const bpm of [120, 140]) {
  const tempo = detectTempo(onsetEnvelope(clickTrack(bpm, 30), 11025));
  assert.ok(tempo, `no tempo detected for a ${bpm} BPM click track`);
  assert.ok(
    Math.abs(tempo.bpm - bpm) < 2,
    `expected about ${bpm} BPM, got ${tempo.bpm}`,
  );
}

// syncRate: the playback rate that puts the next track on the current grid.
assert.equal(syncRate(120, 120), 1);
assert.ok(Math.abs(syncRate(120, 126) - 120 / 126) < 1e-9);
assert.equal(syncRate(120, 140), null, "140 BPM is too far from 120 BPM");
assert.ok(Math.abs(syncRate(120, 61) - 120 / 122) < 1e-9, "double-time match");
assert.equal(syncRate(120, 0), null);
assert.equal(syncRate(0, 120), null);

// "No derivatives" tracks keep their own tempo: only near-exact matches sync.
assert.equal(syncRate(120, 120.3, true), 1);
assert.equal(syncRate(120, 124, true), null);

// pickNextByTempo: choose the candidate whose tempo is closest to the deck.
const candidates = [
  { index: 1, bpm: 150 },
  { index: 2, bpm: 0 },
  { index: 3, bpm: 124 },
  { index: 4, bpm: 121 },
];
assert.equal(pickNextByTempo(candidates, 120), 4);
assert.equal(pickNextByTempo(candidates, 96), -1, "no candidate can sync");
assert.equal(pickNextByTempo([], 120), -1);
assert.equal(
  pickNextByTempo([{ index: 7, bpm: 126, lockRate: true }], 120),
  -1,
  "a locked-tempo track outside the exact-match range is skipped",
);

console.log("tempo checks passed");
