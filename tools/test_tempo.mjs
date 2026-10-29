#!/usr/bin/env node
// Unit checks for the auto-DJ tempo engine: beat-grid detection, the
// tempo-match rate between two tracks, and next-track selection by tempo.
// Run with: node tools/test_tempo.mjs
import assert from "node:assert/strict";
import {
  detectKey,
  detectTempo,
  harmonicDistance,
  hasLongMix,
  keyName,
  onsetEnvelope,
  pairCompatibility,
  pickNextByFit,
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

// detectKey: synthetic chord tracks in C major and A minor.
function chordTrack(chords, secondsPerChord = 2, sampleRate = 11025) {
  const samples = new Float32Array(Math.floor(chords.length * secondsPerChord * sampleRate));
  chords.forEach((chord, chordIndex) => {
    const start = Math.floor(chordIndex * secondsPerChord * sampleRate);
    const length = Math.floor(secondsPerChord * sampleRate);
    for (let i = 0; i < length; i += 1) {
      let value = 0;
      for (const midi of chord) {
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        value += Math.sin(2 * Math.PI * freq * (i / sampleRate));
      }
      samples[start + i] = value / chord.length;
    }
  });
  return samples;
}

const cMajor = detectKey(
  chordTrack([
    [36, 48, 60, 64, 67],
    [41, 53, 57, 60, 65],
    [43, 55, 59, 62, 67],
    [36, 48, 60, 64, 67],
    [41, 53, 57, 60, 65],
    [36, 48, 60, 64, 67],
  ]),
  11025,
);
assert.ok(cMajor, "no key detected for the C major track");
assert.equal(cMajor.tonic, 0);
assert.equal(cMajor.mode, "major");
assert.equal(keyName(cMajor), "C MAJOR");

const aMinor = detectKey(
  chordTrack([
    [33, 45, 57, 60, 64],
    [41, 53, 57, 60, 65],
    [40, 52, 56, 59, 64],
    [33, 45, 57, 60, 64],
    [38, 50, 57, 62, 66],
    [33, 45, 57, 60, 64],
  ]),
  11025,
);
assert.ok(aMinor, "no key detected for the A minor track");
assert.equal(aMinor.tonic, 9);
assert.equal(aMinor.mode, "minor");
assert.equal(keyName(aMinor), "A MINOR");

// Harmonic fit: relative keys and fifths can share a long overlap.
assert.equal(harmonicDistance(cMajor, aMinor), 0, "C major and A minor use the same notes");
assert.equal(
  harmonicDistance(cMajor, { tonic: 7, mode: "major", confidence: 0.9 }),
  2,
  "G major is one step on the circle of fifths",
);
assert.ok(
  harmonicDistance(cMajor, { tonic: 6, mode: "major", confidence: 0.9 }) > 4,
  "F sharp major clashes with C major",
);
assert.equal(harmonicDistance(cMajor, null), null);

const fromTrack = { bpm: 120, key: cMajor, energy: 0.2 };
const goodFit = pairCompatibility(fromTrack, {
  bpm: 122,
  key: { tonic: 7, mode: "major", confidence: 0.9 },
  energy: 0.22,
});
assert.ok(goodFit, "a close tempo and fifth key must fit");
assert.equal(goodFit.longMix, true);

const clashFit = pairCompatibility(fromTrack, {
  bpm: 121,
  key: { tonic: 6, mode: "major", confidence: 0.9 },
  energy: 0.2,
});
assert.ok(clashFit, "a close tempo still syncs, even when the key clashes");
assert.equal(clashFit.longMix, false);

assert.equal(
  hasLongMix(
    [{ index: 3, bpm: 121, key: { tonic: 6, mode: "major", confidence: 0.9 }, energy: 0.2 }],
    fromTrack,
  ),
  false,
  "a clashing key cannot take a long overlap",
);
assert.equal(
  hasLongMix(
    [{ index: 4, bpm: 122, key: { tonic: 7, mode: "major", confidence: 0.9 }, energy: 0.21 }],
    fromTrack,
  ),
  true,
);

assert.equal(
  pickNextByFit(
    [
      { index: 1, bpm: 121, key: { tonic: 6, mode: "major", confidence: 0.9 }, energy: 0.2 },
      { index: 2, bpm: 126, key: { tonic: 7, mode: "major", confidence: 0.9 }, energy: 0.21 },
    ],
    fromTrack,
  ),
  2,
  "key fit wins over a small tempo gain",
);

console.log("tempo checks passed");
