#!/usr/bin/env node
// Unit checks for DJ transition shapes. A beatmatched mix is a long
// performance. The next track enters many bars before the swap. The DJ
// teases it, rides both tracks, trades bars, swaps the bass, and then
// drops the old track fast.
// Run with: node tools/test_mix.mjs
import assert from "node:assert/strict";
import {
  loopOutLevel,
  loopOutSteps,
  performancePoints,
  transitionProfile,
} from "../src/chipcafe_mix.mjs";

const exits = [];
for (let sequence = 0; sequence < 3; sequence += 1) {
  const profile = transitionProfile({ synced: true, kind: "auto", sequence });
  exits.push(profile.exit);
  assert.equal(profile.performance, true, "a synced auto mix is a performance");
  assert.ok(profile.stages.in <= 0.25, "the next track punches in within a quarter beat");
  assert.ok(profile.stages.tease >= 16, "the DJ teases the next track for at least four bars");
  assert.ok(profile.stages.ride > profile.stages.tease, "both tracks ride after the tease");
  assert.ok(profile.stages.swap >= 48, "the next track enters at least twelve bars before the bass swap");
  assert.ok(
    profile.stages.drop <= profile.stages.swap + 1,
    "the old track drops within one beat of the bass swap",
  );
  assert.ok(profile.stages.out >= 56, "the whole auto performance lasts at least fourteen bars");

  const points = performancePoints(profile.stages);
  const tease = points.incoming.filter((point) => point.at < profile.stages.tease);
  assert.ok(tease.length >= 4, "the tease cuts the next track in and out");
  assert.ok(tease[0].level > tease[1].level, "the first tease cuts back out");
  assert.ok(tease[2].level > tease[1].level, "the next track cuts back in");
  assert.ok(tease[2].level > tease[3].level, "the second tease cuts back out");

  const trade = points.outgoing.filter((point) => point.at >= profile.stages.ride);
  assert.ok(trade.length >= 4, "the two tracks trade bars before the swap");
  assert.ok(trade[0].level < trade[1].level, "the old track ducks, then comes back");
  assert.ok(trade[2].level < trade[1].level, "the old track ducks again");
}
assert.deepEqual(exits, ["punch", "echo", "loop"], "the DJ rotates exit moves");

const locked = transitionProfile({
  synced: true,
  kind: "auto",
  sequence: 2,
  lockRate: true,
});
assert.equal(locked.exit, "punch", "locked tracks do not use loop or echo moves");

const quick = transitionProfile({ synced: true, kind: "quick", sequence: 1 });
assert.equal(quick.performance, true, "the next-track button also starts a performance");
assert.ok(quick.stages.swap >= 24, "a manual mix gives the next track six bars before the swap");
assert.ok(quick.stages.out >= 32, "a manual performance lasts at least eight bars");

const free = transitionProfile({ synced: false, kind: "auto", sequence: 0 });
assert.equal(free.style, "slam", "an unmatched mix is a short slam, not a long crossfade");
assert.ok(free.stages.in <= 0.2, "the next track enters at once in a slam");
assert.ok(free.stages.drop <= 1.5, "the old track drops fast in a slam");
assert.ok(free.stages.out <= 3, "a slam ends within three seconds");

const loop = transitionProfile({ synced: true, kind: "auto", sequence: 2 });
const steps = loopOutSteps(loop.stages);
assert.ok(steps.length >= 5, "loop out repeats the old beat more than once");
assert.ok(steps.every((step) => step.at >= loop.stages.swap && step.at < loop.stages.out));
const intervals = steps.slice(1).map((step, index) => step.at - steps[index].at);
assert.ok(
  Math.min(...intervals) < intervals[0],
  "loop out repeats get shorter near the end",
);

const level = (beats) => loopOutLevel(loop.stages, beats);
assert.equal(level(loop.stages.swap + 0.2), level(loop.stages.swap + 0.8));
assert.ok(level(loop.stages.swap + 1.2) < level(loop.stages.swap + 0.2));
assert.equal(level(loop.stages.out), 0);

const cut = transitionProfile({ synced: false, kind: "cut", sequence: 0 });
assert.ok(cut.stages.out <= 0.5, "a cut stays a cut");

console.log("mix checks passed");
