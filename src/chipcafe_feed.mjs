// Track selection for the auto-DJ feed. Both sources (Audius and Jamendo)
// are filtered to chiptune and ranked by real engagement: plays and
// favourites, on a log scale so the two catalogues can share one ranking.
// Release age plays no part: a track people still play outranks a new
// upload nobody has heard. The feeds ask each source for its most-played
// chiptune now, so the pool itself stays current.

export const CHIP_PATTERN =
  /chip ?tune|chip ?music|\b8[- ]?bit\b|\b16[- ]?bit\b|lsdj|famitracker|famistudio|furnace|deflemask|2a03|game ?boy|\bnes\b|\bc64\b|\bsid\b|vrc6|ym2612|pico-?8|bitpop/i;
const NOT_MUSIC_GENRES = new Set(["Podcasts", "Comedy", "Spoken Word", "Audiobooks", "Kids", "Devotional"]);
// Rap over an 8-bit loop is not chiptune, on either source.
const NOT_CHIP_GENRE = /hip-?hop|\brap\b|\btrap\b/i;
// "16bit master" is an audio-mastering tag, not a 16-bit console track.
const NOT_A_TRACK = /type beat|podcast|episode|\bdj set\b|live set|radio show|sound ?effect|\bsfx\b|ringtone|16[- ]?bit[^a-z0-9]+(master|mstr)|(master|mstr)[^a-z0-9]+16[- ]?bit/i;

// The engagement a track must clear to air while enough proven tracks
// exist: about 3,000 plays on plays alone, or far fewer with favourites
// (90 plays and 11 favourites clears it; 90 plays and none does not).
export const MIN_SCORE = 8;
// Below this many proven tracks the floor lifts, so a thin feed day
// still leaves the station with something to play.
const MIN_PROVEN = 12;

export function audiusIsChiptune(track) {
  if (track.ai_attribution_user_id || NOT_MUSIC_GENRES.has(track.genre)) return false;
  if (NOT_CHIP_GENRE.test(track.genre || "")) return false;
  if (NOT_A_TRACK.test(`${track.title || ""} ${track.tags || ""}`)) return false;
  return track.genre === "Chiptune" || CHIP_PATTERN.test(`${track.title || ""} ${track.tags || ""}`);
}

// Jamendo tags are self-applied, so chiptune or 8-bit must be one of the
// track's genres, and hip-hop beats with an 8-bit tag are left out.
export function jamendoIsChiptune(track) {
  const genres = ((track.musicinfo && track.musicinfo.tags && track.musicinfo.tags.genres) || [])
    .map((genre) => String(genre).toLowerCase());
  if (!genres.some((genre) => genre === "chiptune" || genre === "8bit" || genre === "chipmusic")) return false;
  if (genres.some((genre) => genre === "hiphop" || genre === "rap" || genre === "trap")) return false;
  return !NOT_A_TRACK.test(track.name || "");
}

export function trackScore(track) {
  return Math.log1p(track.plays || 0) + 2 * Math.log1p(track.favs || 0);
}

// Rank normalised tracks ({id, artist, seconds, audio_url, plays, favs})
// for airplay: playable length only, each id once, proven tracks first,
// one track per artist before any artist repeats.
export function rankTracks(tracks) {
  const seen = new Set();
  const ranked = [];
  for (const track of tracks) {
    if (!track.audio_url || seen.has(track.id)) continue;
    if (track.seconds < 60 || track.seconds > 600) continue;
    seen.add(track.id);
    ranked.push({ ...track, score: trackScore(track) });
  }
  ranked.sort((a, b) => b.score - a.score);

  const proven = ranked.filter((track) => track.score >= MIN_SCORE);
  const pool = proven.length >= MIN_PROVEN ? proven : ranked;

  // One track per artist first, so the mix moves between artists.
  const primary = [];
  const extra = [];
  const artists = new Set();
  for (const track of pool) {
    const key = String(track.artist || "").toLowerCase();
    if (artists.has(key)) {
      extra.push(track);
    } else {
      artists.add(key);
      primary.push(track);
    }
  }
  return primary.concat(extra);
}
