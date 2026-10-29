#!/usr/bin/env node
// Unit checks for feed track selection: chiptune filtering, engagement
// ranking with a quality floor, and one-track-per-artist ordering.
// Regression checks for the old selection, which aired unheard new
// uploads: newest-first Jamendo order, a one-year release window, an
// age decay that preferred the newest track, and no minimum plays.
// Run with: node tools/test_feed.mjs
import assert from "node:assert/strict";
import {
  audiusIsChiptune,
  jamendoIsChiptune,
  rankTracks,
  trackScore,
} from "../src/chipcafe_feed.mjs";

function track(id, artist, plays, favs, seconds = 180) {
  return { id, artist, plays, favs, seconds, audio_url: `https://example.com/${id}.mp3` };
}

// Engagement: favourites weigh double, counts are on a log scale.
assert.ok(trackScore({ plays: 90, favs: 11 }) >= 8, "a liked small track clears the floor");
assert.ok(trackScore({ plays: 90, favs: 0 }) < 8, "plays nobody liked stay under the floor");
assert.ok(
  trackScore({ plays: 2499158, favs: 4528 }) > trackScore({ plays: 13, favs: 0 }),
  "a proven classic outscores an unheard upload",
);

// A pool with enough proven tracks: unproven ones never air, however new.
const proven = [];
for (let i = 0; i < 15; i += 1) proven.push(track(`p${i}`, `Artist ${i}`, 5000 + i * 100, 40));
const mixed = rankTracks([
  track("new1", "Fresh Uploader", 8, 0),
  ...proven,
  track("new2", "Fresh Uploader", 0, 0),
]);
assert.equal(mixed.length, 15, "unproven tracks are left out when proven ones exist");
assert.ok(mixed.every((item) => item.score >= 8));
assert.equal(mixed[0].id, "p14", "highest engagement ranks first");

// A thin pool: the floor lifts so the station is never silent.
const thin = rankTracks([track("a", "Solo", 5, 0), track("b", "Duo", 3, 0)]);
assert.equal(thin.length, 2, "a pool under the proven minimum still plays");
assert.equal(thin[0].id, "a");

// One track per artist before any artist repeats.
const crowded = rankTracks([
  track("x1", "Prolific", 900000, 3000),
  track("x2", "Prolific", 800000, 2900),
  track("x3", "Prolific", 700000, 2800),
  track("y1", "Other", 6000, 60),
  track("z1", "Third", 5000, 50),
]);
assert.deepEqual(
  crowded.map((item) => item.id),
  ["x1", "y1", "z1", "x2", "x3"],
  "every artist plays once before the top artist returns",
);

// Playable set only: length bounds, an audio URL, each id once.
const filtered = rankTracks([
  track("short", "A", 100000, 100, 28),
  track("long", "B", 100000, 100, 601),
  { id: "silent", artist: "C", plays: 100000, favs: 100, seconds: 180, audio_url: "" },
  track("dup", "D", 100000, 100),
  track("dup", "D", 100000, 100),
  track("ok", "E", 90000, 90),
]);
assert.deepEqual(
  filtered.map((item) => item.id),
  ["dup", "ok"],
  "short snippets, over-long, unstreamable and duplicate tracks are left out",
);

// Audius chiptune filter.
assert.equal(audiusIsChiptune({ genre: "Chiptune", title: "Anything", tags: "" }), true);
assert.equal(
  audiusIsChiptune({ genre: "Electronic", title: "Crunchy", tags: "lsdj,chiptune" }),
  true,
);
assert.equal(audiusIsChiptune({ genre: "Electronic", title: "Plain Song", tags: "pop" }), false);
assert.equal(
  audiusIsChiptune({ genre: "Hip-Hop/Rap", title: "All Time High (8-Bit Edition)", tags: "8bit" }),
  false,
  "rap with an 8-bit edition tag is not chiptune",
);
assert.equal(
  audiusIsChiptune({ genre: "Hip-Hop/Rap", title: "8BIT Chiptune Trap Type Beat", tags: "chiptune" }),
  false,
);
assert.equal(
  audiusIsChiptune({ genre: "Future Bass", title: "BOM (Radio Edit - Master 16bit)", tags: "" }),
  false,
  "a 16-bit mastering tag is not a 16-bit console",
);
assert.equal(
  audiusIsChiptune({ genre: "Podcasts", title: "Chiptune Talk", tags: "chiptune" }),
  false,
);

// Jamendo chiptune filter: genre tags decide.
const jamendo = (genres, name = "Song") => ({
  name,
  musicinfo: { tags: { genres } },
});
assert.equal(jamendoIsChiptune(jamendo(["pop", "electronic", "8bit"])), true);
assert.equal(jamendoIsChiptune(jamendo(["chiptune"])), true);
assert.equal(jamendoIsChiptune(jamendo(["electronic"])), false);
assert.equal(jamendoIsChiptune(jamendo(["8bit", "hiphop"])), false);
assert.equal(jamendoIsChiptune(jamendo(["8bit"], "Live Set at the Party")), false);

console.log("feed checks passed");
