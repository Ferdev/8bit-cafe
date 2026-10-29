// Transition shapes for the auto-DJ. The shapes use DJ moves with clear
// start points. The next track punches in near full level, the bass swaps
// on a bar line, and the old track leaves by a filter drop, an echo tail,
// or a beat loop. Long linear volume fades are not part of a synced mix.

export const AUTO_MIX_OUT_BEATS = 16;
export const FREE_MIX_OUT_SECONDS = 3;

function profile(style, exit, punchLevel, stages) {
  return { style, exit, punchLevel, stages };
}

// Stage values count beats in a synced mix and seconds in a free mix.
// - in: punch attack length; it ends on the downbeat at punchLevel
// - swap: the bass moves to the next track
// - drop: the old track loses its main level
// - out: the mix is complete
export function transitionProfile({ synced, kind, sequence = 0, lockRate = false }) {
  if (kind === "cut") {
    return profile("cut", "cut", 1, { in: 0.35, swap: 0.2, drop: 0.35, out: 0.45 });
  }

  if (!synced) {
    return kind === "quick"
      ? profile("slam", "punch", 0.9, { in: 0.12, swap: 0.45, drop: 0.8, out: 1.6 })
      : profile("slam", "punch", 0.9, { in: 0.15, swap: 0.9, drop: 1.4, out: FREE_MIX_OUT_SECONDS });
  }

  const exits = lockRate ? ["punch"] : ["punch", "echo", "loop"];
  const exit = exits[Math.abs(Math.floor(sequence)) % exits.length];
  if (kind === "quick") {
    return profile("beatmatch", exit, 0.88, { in: 0.25, swap: 4, drop: 5, out: 8 });
  }
  return profile("beatmatch", exit, 0.88, {
    in: 0.25,
    swap: 8,
    drop: 9,
    out: exit === "loop" ? 14 : AUTO_MIX_OUT_BEATS,
  });
}

// Seek points for a loop-out exit. The first entry captures the beat at the
// bass swap. Later entries repeat that beat, then repeat its second half.
export function loopOutSteps(stages) {
  const steps = [{ at: stages.swap, point: 0, capture: true }];
  for (let at = stages.swap + 1; at < Math.min(stages.out, stages.swap + 3); at += 1) {
    steps.push({ at, point: 0, capture: false });
  }
  for (let at = stages.swap + 3; at < stages.out; at += 0.5) {
    steps.push({ at, point: 0.5, capture: false });
  }
  return steps;
}

// The old deck level during a loop-out exit. The level changes once per
// beat, in steps. It does not move between beats.
export function loopOutLevel(stages, elapsed) {
  if (elapsed < stages.swap) return 1;
  if (elapsed >= stages.out) return 0;
  const beat = Math.floor(elapsed - stages.swap);
  return 0.74 * Math.pow(0.72, beat);
}
