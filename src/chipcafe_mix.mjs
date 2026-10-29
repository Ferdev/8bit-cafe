// Transition shapes for the auto-DJ. A synced mix is a long performance,
// not a short blend at the end of a track. The next track enters many bars
// before the bass swap. The DJ teases it in and out, rides both tracks,
// trades bars between them, swaps the bass, and then drops the old track
// with a filter, an echo tail, or a beat loop.

export const AUTO_MIX_OUT_BEATS = 56;
export const FREE_MIX_OUT_SECONDS = 3;

function profile(style, exit, punchLevel, stages, performance = false) {
  return { style, exit, punchLevel, stages, performance };
}

// Stage values count beats in a synced mix and seconds in a free mix.
// - in: punch attack length; it ends on the downbeat
// - tease: the next track stops cutting in and out and starts to ride
// - ride: the two tracks start to trade bars
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
    // The next-track button uses a short form of the same performance:
    // two bars of tease, two bars of ride, two bars of trade, then out.
    return profile(
      "beatmatch",
      exit,
      0.88,
      { in: 0.25, tease: 8, ride: 16, swap: 24, drop: 25, out: 32 },
      true,
    );
  }
  return profile(
    "beatmatch",
    exit,
    0.88,
    { in: 0.25, tease: 16, ride: 32, swap: 48, drop: 49, out: AUTO_MIX_OUT_BEATS },
    true,
  );
}

// Fader points for a synced performance. Levels hold inside each bar and
// change in short moves on bar lines. In the tease, the next track cuts
// in and out. In the trade, the two tracks take turns in front.
export function performancePoints(stages) {
  const teaseStep = stages.tease / 4;
  const tradeStep = (stages.swap - stages.ride) / 4;
  return {
    incoming: [
      { at: 0, level: 0.72 },
      { at: teaseStep, level: 0.14 },
      { at: teaseStep * 2, level: 0.86 },
      { at: teaseStep * 3, level: 0.18 },
      { at: stages.tease, level: 0.9 },
      { at: (stages.tease + stages.ride) / 2, level: 0.94 },
      { at: stages.ride, level: 1 },
      { at: stages.ride + tradeStep, level: 0.48 },
      { at: stages.ride + tradeStep * 2, level: 1 },
      { at: stages.ride + tradeStep * 3, level: 0.62 },
      { at: stages.swap, level: 1 },
    ],
    outgoing: [
      { at: 0, level: 1 },
      { at: stages.ride, level: 0.58 },
      { at: stages.ride + tradeStep, level: 1 },
      { at: stages.ride + tradeStep * 2, level: 0.5 },
      { at: stages.ride + tradeStep * 3, level: 0.82 },
    ],
  };
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
