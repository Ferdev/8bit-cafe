#!/usr/bin/env node
// Unit checks for DJ transition shapes. A beatmatched mix must punch the
// next track in and drop the old track fast. It must not use an eight-beat
// volume fade in and a sixteen-beat volume fade out.
// Run with: node tools/test_mix.mjs
import assert from "node:assert/strict";
import {
  loopOutLevel,
  loopOutSteps,
  transitionProfile,
} from "../src/chipcafe_mix.mjs";

const exits = [];
for (let sequence = 0; sequence < 3; sequence += 1) {
  const profile = transitionProfile({ synced: true, kind: "auto", sequence });
  exits.push(profile.exit);
  assert.ok(profile.stages.in <= 0.25, "the next track punches in within a quarter beat");
  assert.ok(profile.punchLevel >= 0.85, "the next track enters near full level");
  assert.ok(profile.stages.swap <= 8, "the bass swap comes after at most two bars");
  assert.ok(
    profile.stages.drop <= profile.stages.swap + 1,
    "the old track drops within one beat of the bass swap",
  );
  assert.ok(profile.stages.out <= 16, "the whole auto mix fits in four bars");
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
assert.ok(quick.stages.out <= 8, "a quick synced mix fits in two bars");

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
