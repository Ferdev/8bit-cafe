// 8bit.cafe: one auto-DJ channel fed by the latest chiptune on Audius and Jamendo,
// streamed through two decks with beatmatched punch-in mixes, plus a pixel-art VJ
// (see chipcafe_art.mjs) that dances to the live signal.

import {
  ACCENT_PAIRS as ACCENTS,
  attach as attachArt,
  drawFrame,
  setAccents,
} from "./chipcafe_art.mjs";
import {
  AUTO_MIX_OUT_BEATS,
  FREE_MIX_OUT_SECONDS,
  loopOutLevel,
  loopOutSteps,
  performancePoints,
  transitionProfile,
} from "./chipcafe_mix.mjs";
import { analyseTrack, pickNextByTempo, syncRate, tempoFor } from "./chipcafe_tempo.mjs";

const TICK_MS = 250;
const engine = {
  ctx: null,
  mixBus: null,
  master: null,
  analyser: null,
  freqData: null,
  decks: [],
  active: 0,
  switching: false,
  mix: null,
  playlist: [],
  currentIndex: 0,
  nextIndex: null,
  previousIndex: null,
  played: new Set(),
  broken: new Set(),
  analysisRun: 0,
  mixCount: 0,
  retried: false,
  errorCount: 0,
  recoveryTimer: null,
  onTrack: null,
  onProgress: null,
  onState: null,
  onMix: null,
  lastState: "",
  lastMix: "",
  muted: false,
  timer: null,
  raf: null,
  lastProgressAt: 0,
  canvas: null,
  energy: { bass: 0, mid: 0, high: 0, level: 0 },
  signal: 0,
  bassAverage: 0,
  beats: 0,
  lastBeatAt: 0,
  unlockInstalled: false,
};

// --------------------------------------------------------------- utilities

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code) => {
    if (code[0] === "#") {
      const value = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return ENTITIES[code.toLowerCase()] || match;
  });
}

function cleanTitle(title) {
  return decodeEntities(String(title || "Untitled"))
    .replace(/\.(mp3|wav|ogg|flac)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ----------------------------------------------------------------- status

function emitState(status, playing) {
  const key = status + ":" + (playing ? "1" : "0");
  if (engine.lastState === key) return;
  engine.lastState = key;
  const callback = engine.onState;
  if (typeof callback !== "function") return;
  setTimeout(() => {
    try {
      callback(status, playing);
    } catch (_error) {
      // The UI can be torn down while a callback is in flight.
    }
  }, 0);
}

function emitProgress(position, duration) {
  const callback = engine.onProgress;
  if (typeof callback !== "function") return;
  try {
    callback(position, duration);
  } catch (_error) {
    // Ignore a callback racing with a reload.
  }
}

function emitTrack(index) {
  const track = engine.playlist[index];
  if (!track) return;
  const next = engine.nextIndex != null && engine.playlist[engine.nextIndex]
    ? engine.playlist[engine.nextIndex]
    : engine.playlist[(index + 1) % engine.playlist.length];
  if (index !== engine.currentIndex) engine.previousIndex = engine.currentIndex;
  engine.currentIndex = index;
  engine.played.add(index);
  setPalette(track);
  const callback = engine.onTrack;
  if (typeof callback === "function") {
    setTimeout(() => {
      try {
        callback(
          track.title,
          track.artist,
          track.album,
          track.released,
          track.artist_url,
          track.track_url,
          track.license,
          track.license_url,
          next ? next.title : "",
          next ? next.artist : "",
          track.seconds,
          track.accent,
          track.accent_alt,
          track.source || "",
        );
      } catch (_error) {
        // Ignore a callback racing with a reload.
      }
    }, 0);
  }
  emitProgress(0, track.seconds);
}

function setPalette(track) {
  if (!track) return;
  setAccents(track.accent, track.accent_alt);
}

// ------------------------------------------------------------------- feed

// Both sources are filtered to chiptune and ranked the same way: real
// listens and favourites, decaying with age, so the set leans to recent
// releases that people actually play.
const JAMENDO_CLIENT_ID = "5302eb83";
const FEED_WINDOW_DAYS = 365;
const CHIP_PATTERN =
  /chip ?tune|chip ?music|\b8[- ]?bit\b|\b16[- ]?bit\b|lsdj|famitracker|famistudio|furnace|deflemask|2a03|game ?boy|\bnes\b|\bc64\b|\bsid\b|vrc6|ym2612|pico-?8|bitpop/i;
const NOT_MUSIC_GENRES = new Set(["Podcasts", "Comedy", "Spoken Word", "Audiobooks", "Kids", "Devotional"]);
const NOT_A_TRACK = /type beat|podcast|episode|\bdj set\b|live set|radio show/i;

function isoDate(track) {
  return String(track.release_date || track.created_at || "").slice(0, 10);
}

function ageInDays(date) {
  const time = Date.parse(date);
  return Number.isFinite(time) ? (Date.now() - time) / 86400000 : Infinity;
}

// Creative Commons label, URL and "no derivatives" flag from a license
// name (Audius) or a creativecommons.org URL (Jamendo).
function licenseInfo(license) {
  const text = String(license || "");
  if (!text || /all rights reserved/i.test(text)) return { label: "", url: "", noDerivs: false };
  if (/public ?domain|cc0|publicdomain\/zero/i.test(text)) {
    return { label: "CC0", url: "https://creativecommons.org/publicdomain/zero/1.0/", noDerivs: false };
  }
  const fromUrl = text.match(/licenses\/([a-z-]+)\/([\d.]+)/i);
  let parts;
  let version = "4.0";
  if (fromUrl) {
    parts = fromUrl[1].toLowerCase().split("-").filter((part) => part !== "by");
    version = fromUrl[2];
  } else if (/attribution|cc[- ]by/i.test(text)) {
    parts = [];
    if (/noncommercial|-nc\b/i.test(text)) parts.push("nc");
    if (/noderiv|-nd\b/i.test(text)) parts.push("nd");
    if (/sharealike|-sa\b/i.test(text)) parts.push("sa");
  } else {
    return { label: "", url: "", noDerivs: false };
  }
  const slug = ["by", ...parts].join("-");
  return {
    label: `CC ${slug.toUpperCase()}`,
    url: `https://creativecommons.org/licenses/${slug}/${version}/`,
    noDerivs: parts.includes("nd"),
  };
}

function audiusTrack(track) {
  const user = track.user || {};
  const license = licenseInfo(track.license);
  return {
    id: `audius:${track.id}`,
    source: "Audius",
    title: cleanTitle(track.title),
    artist: user.name || user.handle || "Unknown artist",
    album: "",
    released: isoDate(track),
    artist_url: user.handle ? `https://audius.co/${user.handle}` : "",
    track_url: track.permalink ? `https://audius.co${track.permalink}` : "",
    license: license.label,
    license_url: license.url,
    no_derivs: license.noDerivs,
    seconds: Math.round(track.duration || 0),
    audio_url: track.stream && track.stream.url ? track.stream.url : "",
    plays: track.play_count || 0,
    // Audius favourites and reposts are often farmed: trust them only when
    // the track has at least as many real plays.
    favs: (track.play_count || 0) >= (track.favorite_count || 0) + (track.repost_count || 0)
      ? track.favorite_count || 0
      : 0,
  };
}

function audiusIsChiptune(track) {
  if (track.ai_attribution_user_id || NOT_MUSIC_GENRES.has(track.genre)) return false;
  if (NOT_A_TRACK.test(track.title || "")) return false;
  return track.genre === "Chiptune" || CHIP_PATTERN.test(`${track.title || ""} ${track.tags || ""}`);
}

function jamendoTrack(track) {
  const license = licenseInfo(track.license_ccurl);
  const stats = track.stats || {};
  return {
    id: `jamendo:${track.id}`,
    source: "Jamendo",
    title: cleanTitle(track.name),
    artist: decodeEntities(track.artist_name || "Unknown artist"),
    album: decodeEntities(track.album_name || ""),
    released: String(track.releasedate || "").slice(0, 10),
    artist_url: track.artist_id ? `https://www.jamendo.com/artist/${track.artist_id}` : "",
    track_url: track.shareurl || "",
    license: license.label,
    license_url: license.url,
    no_derivs: license.noDerivs,
    seconds: Math.round(track.duration || 0),
    audio_url: track.audio || "",
    plays: stats.rate_listened_total || 0,
    favs: stats.favorited || 0,
  };
}

// Jamendo tags are self-applied, so chiptune or 8-bit must be one of the
// track's genres, and hip-hop beats with an 8-bit tag are left out.
function jamendoIsChiptune(track) {
  const genres = ((track.musicinfo && track.musicinfo.tags && track.musicinfo.tags.genres) || [])
    .map((genre) => String(genre).toLowerCase());
  if (!genres.some((genre) => genre === "chiptune" || genre === "8bit" || genre === "chipmusic")) return false;
  if (genres.some((genre) => genre === "hiphop" || genre === "rap" || genre === "trap")) return false;
  return !NOT_A_TRACK.test(track.name || "");
}

function trackScore(track) {
  const age = ageInDays(track.released);
  if (age > FEED_WINDOW_DAYS) return -1;
  return (Math.log1p(track.plays) + 2 * Math.log1p(track.favs)) * Math.pow(0.5, Math.max(0, age) / 120);
}

async function preflightTrack(track) {
  if (!track.audio_url) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(track.audio_url, {
      headers: { Range: "bytes=0-1" },
      signal: controller.signal,
    });
    const ok = response.ok;
    try {
      await response.body?.cancel();
    } catch (_error) {
      // The range body is tiny; nothing to clean up.
    }
    return ok;
  } catch (_error) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function buildPlaylist(tracks) {
  const seen = new Set();
  const ranked = [];
  for (const track of tracks) {
    if (!track.audio_url || seen.has(track.id)) continue;
    if (track.seconds < 60 || track.seconds > 600) continue;
    const score = trackScore(track);
    if (score < 0) continue;
    seen.add(track.id);
    ranked.push({ ...track, score });
  }
  ranked.sort((a, b) => b.score - a.score);

  // One track per artist first, so the mix moves between artists.
  const primary = [];
  const extra = [];
  const artists = new Set();
  for (const track of ranked) {
    const key = track.artist.toLowerCase();
    if (artists.has(key)) {
      extra.push(track);
    } else {
      artists.add(key);
      primary.push(track);
    }
  }

  const candidates = primary.concat(extra).slice(0, 30);
  const checks = await Promise.all(candidates.map(preflightTrack));
  let selected = candidates.filter((_track, index) => checks[index]).slice(0, 18);
  if (selected.length < 3) selected = ranked.slice(0, 18);

  return selected.map((track, index) => {
    const accent = ACCENTS[index % ACCENTS.length];
    return { ...track, accent: accent[0], accent_alt: accent[1] };
  });
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`feed ${response.status}`);
  return response.json();
}

async function audiusFeed() {
  const searches = [
    { query: "", genre: "Chiptune", limit: "100" },
    { query: "chiptune", limit: "100" },
    { query: "8bit", limit: "100" },
  ].map((params) => `/api/audius/v1/tracks/search?${new URLSearchParams({ app_name: "8bitcafe", ...params })}`);
  const results = await Promise.all(searches.map((url) => fetchJson(url).catch(() => ({ data: [] }))));
  return results
    .flatMap((result) => (Array.isArray(result.data) ? result.data : []))
    .filter((item) => item && item.is_streamable && !item.is_delete && item.stream && item.stream.url && item.user)
    .filter(audiusIsChiptune)
    .map(audiusTrack);
}

async function jamendoFeed() {
  const today = new Date();
  const from = new Date(today.getTime() - FEED_WINDOW_DAYS * 86400000);
  const day = (date) => date.toISOString().slice(0, 10);
  const searches = ["chiptune", "8bit"].map(
    (tag) =>
      "https://api.jamendo.com/v3.0/tracks/?" +
      new URLSearchParams({
        client_id: JAMENDO_CLIENT_ID,
        format: "json",
        limit: "200",
        tags: tag,
        order: "releasedate_desc",
        include: "musicinfo stats licenses",
        audioformat: "mp32",
        datebetween: `${day(from)}_${day(today)}`,
      }),
  );
  const results = await Promise.all(searches.map((url) => fetchJson(url).catch(() => ({ results: [] }))));
  return results
    .flatMap((result) => (Array.isArray(result.results) ? result.results : []))
    .filter(jamendoIsChiptune)
    .map(jamendoTrack);
}

function scheduleRecovery() {
  if (engine.recoveryTimer) return;
  engine.recoveryTimer = setTimeout(() => {
    engine.recoveryTimer = null;
    engine.errorCount = 0;
    engine.retried = false;
    loadFeed();
  }, 5000);
}

async function loadFeed() {
  emitState("tuning", false);
  try {
    const [audius, jamendo] = await Promise.all([
      audiusFeed().catch(() => []),
      jamendoFeed().catch(() => []),
    ]);
    const items = audius.concat(jamendo);
    const playlist = await buildPlaylist(items);
    if (playlist.length === 0) throw new Error("no playable chiptune tracks");

    engine.playlist = playlist;
    engine.retried = false;
    engine.currentIndex = 0;
    engine.previousIndex = null;
    engine.played = new Set([0]);
    engine.broken = new Set();
    engine.errorCount = 0;
    if (engine.recoveryTimer) {
      clearTimeout(engine.recoveryTimer);
      engine.recoveryTimer = null;
    }

    analysePlaylist();
    engine.nextIndex = chooseNextIndex(0);
    loadDeck(0, 0);
    loadDeck(1, engine.nextIndex);
    engine.decks[0].gain.gain.value = 1;
    engine.decks[1].gain.gain.value = 0;

    emitTrack(0);
    startPlayback();
  } catch (_error) {
    emitState("failed", false);
    if (!engine.retried) {
      engine.retried = true;
      setTimeout(loadFeed, 9000);
    } else {
      scheduleRecovery();
    }
  }
}

// ------------------------------------------------------------------ audio

function ensureAudio() {
  if (engine.ctx) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    emitState("failed", false);
    return;
  }

  const ctx = new AudioContextClass();
  const mixBus = ctx.createGain();
  mixBus.gain.value = 1;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.72;

  const master = ctx.createGain();
  master.gain.value = engine.muted ? 0 : 0.7;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.knee.value = 10;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.2;

  mixBus.connect(analyser);
  analyser.connect(compressor);
  compressor.connect(master);
  master.connect(ctx.destination);

  engine.ctx = ctx;
  engine.mixBus = mixBus;
  engine.analyser = analyser;
  engine.freqData = new Uint8Array(analyser.frequencyBinCount);
  engine.master = master;
}

// Transition shapes live in chipcafe_mix.mjs. Synced mixes count in beats
// of the outgoing deck; free mixes count in seconds.
const BASS_CUT_DB = -26;
const MIX_LEAD = 0.6;
const TONE_OPEN_HZ = 18000;

function ensureDecks() {
  if (engine.decks.length > 0) return;
  const ctx = engine.ctx;
  for (let index = 0; index < 2; index += 1) {
    const element = new Audio();
    element.crossOrigin = "anonymous";
    element.preload = "auto";
    element.preservesPitch = true;
    element.setAttribute("playsinline", "");
    element.style.display = "none";
    document.body.appendChild(element);

    // source -> bass shelf -> low-pass tone -> high-pass sweep -> fader ->
    // mix bus. A pre-fader echo send lets an outgoing deck ring after its
    // fader drops.
    const source = ctx.createMediaElementSource(element);
    const low = ctx.createBiquadFilter();
    low.type = "lowshelf";
    low.frequency.value = 220;
    low.gain.value = 0;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = TONE_OPEN_HZ;
    tone.Q.value = 0.7;
    const sweep = ctx.createBiquadFilter();
    sweep.type = "highpass";
    sweep.frequency.value = 20;
    sweep.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.value = index === 0 ? 1 : 0;
    const echoSend = ctx.createGain();
    echoSend.gain.value = 0;
    const echo = ctx.createDelay(2);
    echo.delayTime.value = 0.375;
    const echoFeedback = ctx.createGain();
    echoFeedback.gain.value = 0.34;
    const echoFilter = ctx.createBiquadFilter();
    echoFilter.type = "lowpass";
    echoFilter.frequency.value = 3200;
    echoFilter.Q.value = 0.7;
    const echoWet = ctx.createGain();
    echoWet.gain.value = 0;
    source.connect(low);
    low.connect(tone);
    tone.connect(sweep);
    sweep.connect(gain);
    gain.connect(engine.mixBus);
    sweep.connect(echoSend);
    echoSend.connect(echo);
    echo.connect(echoFeedback);
    echoFeedback.connect(echo);
    echo.connect(echoFilter);
    echoFilter.connect(echoWet);
    echoWet.connect(engine.mixBus);

    const deck = {
      element,
      gain,
      low,
      tone,
      sweep,
      echoSend,
      echo,
      echoFeedback,
      echoWet,
      index: null,
      rate: 1,
    };
    element.addEventListener("ended", () => {
      const mix = engine.mix;
      if (mix && engine.decks[mix.fromDeck] === deck) {
        finishMix(mix);
      } else if (!mix && engine.decks[engine.active] === deck && !engine.switching) {
        startMix(engine.nextIndex ?? engine.currentIndex + 1, "cut");
      }
    });
    element.addEventListener("error", () => {
      if (deck.index != null) engine.broken.add(deck.index);
      const mix = engine.mix;
      if (mix && engine.decks[mix.toDeck] === deck) {
        abortMix(mix);
        skipBrokenTrack();
      } else if (!mix && engine.decks[engine.active] === deck) {
        skipBrokenTrack();
      }
    });
    engine.decks.push(deck);
  }
}

function loadDeck(deckIndex, trackIndex) {
  const deck = engine.decks[deckIndex];
  const track = engine.playlist[trackIndex];
  if (!deck || !track) return;
  deck.index = trackIndex;
  analyseTrack(track.id, track.audio_url);
  if (deck.element.src !== track.audio_url) {
    deck.element.src = track.audio_url;
    deck.element.load();
  }
}

function playDeck(deckIndex) {
  const deck = engine.decks[deckIndex];
  if (!deck) return Promise.resolve();
  const result = deck.element.play();
  return result && typeof result.then === "function" ? result : Promise.resolve();
}

function contextRunning() {
  return engine.ctx && engine.ctx.state === "running";
}

function startPlayback() {
  const deck = engine.decks[engine.active];
  if (!deck) return;
  playDeck(engine.active)
    .then(() => {
      if (contextRunning()) {
        removeUnlockListeners();
        emitState("live", true);
      } else {
        emitState("blocked", false);
      }
    })
    .catch((error) => {
      if (error && (error.name === "NotAllowedError" || error.name === "AbortError")) {
        emitState("blocked", false);
      } else {
        skipBrokenTrack();
      }
    });
  if (engine.ctx && engine.ctx.state !== "running") {
    engine.ctx
      .resume()
      .then(() => {
        if (contextRunning()) {
          removeUnlockListeners();
          emitState("live", true);
        }
      })
      .catch(() => emitState("blocked", false));
  }
}

function holdParam(param, value) {
  const now = engine.ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(value, now);
}

function resetDeck(deck, level) {
  holdParam(deck.gain.gain, level);
  holdParam(deck.low.gain, 0);
  if (deck.tone) holdParam(deck.tone.frequency, TONE_OPEN_HZ);
  holdParam(deck.sweep.frequency, 20);
  if (deck.echoSend) holdParam(deck.echoSend.gain, 0);
  if (deck.echoWet) holdParam(deck.echoWet.gain, 0);
  if (deck.echoFeedback) holdParam(deck.echoFeedback.gain, 0.34);
}

function trackTempo(trackIndex) {
  const track = engine.playlist[trackIndex];
  return track ? tempoFor(track.id) : undefined;
}

// True when either side of a mix has a "no derivatives" license, so neither
// track may be time-stretched.
function mixLockRate(fromIndex, toIndex) {
  const fromTrack = engine.playlist[fromIndex];
  const toTrack = engine.playlist[toIndex];
  return Boolean((fromTrack && fromTrack.no_derivs) || (toTrack && toTrack.no_derivs));
}

// The track the DJ plays after fromIndex. The set walks the playlist by
// tempo: an unplayed track that can be beatmatched wins, closest tempo
// first, so a synced mix is the normal case and not an accident of feed
// order. Broken tracks are left out. When nothing can sync (or no beat
// grid is ready yet), the next unplayed track in feed order plays and the
// mix falls back to a plain crossfade.
function chooseNextIndex(fromIndex) {
  const length = engine.playlist.length;
  if (length === 0) return 0;
  if (length === 1) return fromIndex;
  const poolFrom = (played) => {
    const pool = [];
    for (let step = 1; step < length; step += 1) {
      const index = (fromIndex + step) % length;
      if (!played.has(index) && !engine.broken.has(index)) pool.push(index);
    }
    return pool;
  };
  let pool = poolFrom(engine.played);
  if (pool.length === 0) {
    // A full cycle is done: start a new one from the current track.
    engine.played = new Set([fromIndex]);
    pool = poolFrom(engine.played);
  }
  if (pool.length === 0) return (fromIndex + 1) % length;

  const fromTempo = trackTempo(fromIndex);
  if (fromTempo) {
    const candidates = pool.map((index) => {
      const tempo = trackTempo(index);
      return {
        index,
        bpm: tempo ? tempo.bpm : 0,
        lockRate: mixLockRate(fromIndex, index),
      };
    });
    const picked = pickNextByTempo(candidates, fromTempo.bpm);
    if (picked >= 0) return picked;
  }
  return pool[0];
}

// Analyse the whole playlist in the background, one track at a time, so
// beat grids are ready long before each mix. loadDeck starts the same
// cached analysis for the two tracks on the decks.
function analysePlaylist() {
  const run = engine.analysisRun + 1;
  engine.analysisRun = run;
  (async () => {
    for (const track of engine.playlist) {
      if (run !== engine.analysisRun) return;
      await analyseTrack(track.id, track.audio_url);
    }
  })();
}

// Works out when and how the incoming deck enters: tempo ratio, cue point
// and the moment of the first shared downbeat.
function planMix(from, targetIndex, kind) {
  const nowCtx = engine.ctx.currentTime;
  const nowPerf = performance.now() / 1000;
  const fromRate = from.element.playbackRate || 1;
  const fromTempo = trackTempo(from.index);
  const toTempo = trackTempo(targetIndex);
  const freeProfile = transitionProfile({
    synced: false,
    kind,
    sequence: engine.mixCount,
  });
  const free = {
    synced: false,
    style: freeProfile.style,
    exit: freeProfile.exit,
    punchLevel: freeProfile.punchLevel,
    performance: freeProfile.performance,
    rate: 1,
    cue: 0,
    beat: 1,
    startCtx: nowCtx + 0.15,
    startPerf: nowPerf + 0.15,
    stages: freeProfile.stages,
    bpm: toTempo ? toTempo.bpm : 0,
  };
  if (kind === "cut" || !fromTempo || !toTempo) return free;

  // "No derivatives" licenses rule out time-stretching either track, so
  // those mixes only sync when the tempos already match.
  const lockRate = mixLockRate(from.index, targetIndex);
  const fromBpm = fromTempo.bpm * fromRate;
  const rate = syncRate(fromBpm, toTempo.bpm, lockRate);
  if (!rate) return free;

  // First bar line on the outgoing deck that leaves time to cue.
  const position = from.element.currentTime;
  let beat = Math.ceil((position - fromTempo.offset) / fromTempo.period);
  while (beat % 4 !== 0 || (fromTempo.offset + beat * fromTempo.period - position) / fromRate < MIX_LEAD) {
    beat += 1;
  }
  const lead = (fromTempo.offset + beat * fromTempo.period - position) / fromRate;

  // The incoming deck must reach its first beat (or a later bar) exactly
  // at that moment.
  let inBeat = toTempo.offset;
  let cue = inBeat - lead * rate;
  while (cue < 0) {
    inBeat += 4 * toTempo.period;
    cue = inBeat - lead * rate;
  }
  const syncedProfile = transitionProfile({
    synced: true,
    kind,
    sequence: engine.mixCount,
    lockRate,
  });
  return {
    synced: true,
    style: syncedProfile.style,
    exit: syncedProfile.exit,
    punchLevel: syncedProfile.punchLevel,
    performance: syncedProfile.performance,
    rate,
    cue,
    inBeat,
    beat: fromTempo.period / fromRate,
    startCtx: nowCtx + lead,
    startPerf: nowPerf + lead,
    stages: syncedProfile.stages,
    bpm: fromBpm,
    fromTempo,
    toTempo,
    lockRate,
  };
}

function mixSeconds(plan) {
  return plan.stages.out * plan.beat;
}

function startMix(targetIndex, kind) {
  if (engine.mix || engine.switching || engine.playlist.length === 0) return;
  const length = engine.playlist.length;
  const target = ((targetIndex % length) + length) % length;
  const fromDeck = engine.active;
  const toDeck = 1 - fromDeck;
  const from = engine.decks[fromDeck];
  const to = engine.decks[toDeck];
  if (!from || !to) return;

  engine.switching = true;
  loadDeck(toDeck, target);
  resetDeck(to, 0);
  const plan = planMix(from, target, kind);
  engine.mixCount += 1;
  to.rate = plan.rate;
  to.element.playbackRate = plan.rate;
  try {
    to.element.currentTime = plan.cue;
  } catch (_error) {
    // Not seekable yet; it starts from the top.
  }

  const mix = { ...plan, kind, target, fromDeck, toDeck, swapped: false, timers: [] };
  playDeck(toDeck)
    .then(() => {
      engine.switching = false;
      engine.errorCount = 0;
      if (plan.synced) {
        // Correct for the time play() took to start.
        const expected = plan.inBeat - (plan.startPerf - performance.now() / 1000) * plan.rate;
        if (Math.abs(to.element.currentTime - expected) > 0.02) to.element.currentTime = Math.max(0, expected);
      }
      engine.mix = mix;
      scheduleMix(mix, from, to);
      if (contextRunning()) emitState("live", true);
      else emitState("blocked", false);
    })
    .catch((error) => {
      engine.switching = false;
      resetDeck(to, 0);
      if (error && (error.name === "NotAllowedError" || error.name === "AbortError")) {
        emitState("blocked", false);
      } else {
        engine.broken.add(target);
        engine.currentIndex = target;
        skipBrokenTrack();
      }
    });
}

function scheduleEchoOut(mix, from, at) {
  if (!from.echoSend || !from.echo || !from.echoFeedback || !from.echoWet) return;
  const { stages } = mix;
  const delaySeconds = mix.synced ? clamp(mix.beat * 0.75, 0.08, 1.5) : 0.375;
  holdParam(from.echo.delayTime, delaySeconds);
  holdParam(from.echoFeedback.gain, 0.36);

  // Capture the final beat before the bass swap. Close the send after the
  // drop, so only the feedback tail remains under the new track.
  holdParam(from.echoSend.gain, 0);
  from.echoSend.gain.setValueAtTime(0, at(Math.max(0, stages.swap - 1)));
  from.echoSend.gain.linearRampToValueAtTime(0.6, at(stages.swap));
  from.echoSend.gain.setValueAtTime(0.6, at(stages.swap + 0.75));
  from.echoSend.gain.linearRampToValueAtTime(0, at(stages.drop));

  holdParam(from.echoWet.gain, 0);
  from.echoWet.gain.setValueAtTime(0, at(Math.max(0, stages.swap - 1)));
  from.echoWet.gain.linearRampToValueAtTime(0.48, at(stages.swap));
  from.echoWet.gain.setValueAtTime(0.48, at(Math.max(stages.swap, stages.out - 1)));
  from.echoWet.gain.linearRampToValueAtTime(0, at(stages.out));
}

function loopOutSeek(mix, step) {
  if (engine.mix !== mix || mix.exit !== "loop" || !mix.fromTempo) return;
  const from = engine.decks[mix.fromDeck];
  if (!from || !Number.isFinite(from.element.currentTime)) return;
  if (step.capture || mix.loopStart == null) {
    const { offset, period } = mix.fromTempo;
    const beatIndex = Math.floor((from.element.currentTime - offset) / period);
    mix.loopStart = Math.max(0, offset + beatIndex * period);
    if (step.capture) return;
  }
  try {
    from.element.currentTime = mix.loopStart + step.point * mix.fromTempo.period;
  } catch (_error) {
    // A seek can fail while the browser swaps buffers. The fader and
    // filters still end the old deck on schedule.
  }
}

function scheduleLoopOut(mix, from, level, at, delay) {
  const { stages } = mix;
  for (let beat = stages.swap; beat < stages.out; beat += 1) {
    from.gain.gain.setValueAtTime(level * loopOutLevel(stages, beat), at(beat));
  }
  from.gain.gain.setValueAtTime(
    level * loopOutLevel(stages, Math.max(stages.swap, stages.out - 0.03)),
    at(Math.max(stages.swap, stages.out - 0.03)),
  );
  from.gain.gain.linearRampToValueAtTime(0, at(stages.out));
  for (const step of loopOutSteps(stages)) {
    mix.timers.push(setTimeout(() => loopOutSeek(mix, step), delay(step.at)));
  }
}

// Hold each fader level inside its bar. Change it in a short move on the
// next bar line. The caller sets the first point.
function scheduleLevelSteps(param, points, scale, at) {
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    param.setValueAtTime(previous.level * scale, at(point.at - 0.04));
    param.linearRampToValueAtTime(point.level * scale, at(point.at + 0.04));
  }
}

function scheduleCutMix(mix, from, to, at) {
  const { stages } = mix;
  holdParam(to.gain.gain, 0);
  to.gain.gain.setValueAtTime(0, at(0));
  to.gain.gain.linearRampToValueAtTime(1, at(stages.in));

  const level = Math.max(from.gain.gain.value, 0.0001);
  holdParam(from.gain.gain, level);
  from.gain.gain.setValueAtTime(level, at(stages.swap));
  from.gain.gain.linearRampToValueAtTime(0, at(stages.out));
}

function scheduleMix(mix, from, to) {
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  const at = (beats) => Math.max(now + (beats + 2) * 0.0005, mix.startCtx + beats * mix.beat);
  const delay = (beats) => Math.max(0, (at(beats) - ctx.currentTime) * 1000);
  const { stages } = mix;

  if (mix.kind === "cut") {
    scheduleCutMix(mix, from, to, at);
  } else {
    const punchLevel = mix.punchLevel ?? 0.88;
    const perform = Boolean(mix.performance);
    const points = perform ? performancePoints(stages) : null;
    const level = Math.max(from.gain.gain.value, 0.0001);
    holdParam(from.gain.gain, level);

    // Incoming: enter on the downbeat, with its bass shelved off. In a
    // performance, bar steps tease it, ride it, and trade it in front.
    // Its low-pass opens by phase until the bass swap.
    const firstLevel = perform ? points.incoming[0].level : punchLevel;
    holdParam(to.gain.gain, 0);
    to.gain.gain.setValueAtTime(0, at(-stages.in));
    to.gain.gain.linearRampToValueAtTime(firstLevel, at(0));
    if (perform) {
      scheduleLevelSteps(to.gain.gain, points.incoming, 1, at);
      from.gain.gain.setValueAtTime(level, at(0));
      scheduleLevelSteps(from.gain.gain, points.outgoing, level, at);
    } else {
      to.gain.gain.setValueAtTime(punchLevel, at(stages.swap));
      to.gain.gain.linearRampToValueAtTime(1, at(Math.min(stages.out, stages.swap + 0.15)));
    }
    if (to.tone) {
      const toneStart = perform ? 2600 : 1400;
      holdParam(to.tone.frequency, toneStart);
      to.tone.frequency.setValueAtTime(toneStart, at(-stages.in));
      if (perform) {
        to.tone.frequency.exponentialRampToValueAtTime(4200, at(stages.tease));
        to.tone.frequency.exponentialRampToValueAtTime(9000, at(stages.ride));
        to.tone.frequency.exponentialRampToValueAtTime(12000, at(stages.swap));
      } else {
        to.tone.frequency.exponentialRampToValueAtTime(7000, at(stages.swap));
      }
      to.tone.frequency.exponentialRampToValueAtTime(
        TONE_OPEN_HZ,
        at(Math.min(stages.out, stages.swap + 1)),
      );
    }

    // Change the bass in a short click-safe move on the bar line.
    const bassEdge = 0.04;
    holdParam(to.low.gain, BASS_CUT_DB);
    to.low.gain.setValueAtTime(BASS_CUT_DB, at(stages.swap - bassEdge));
    to.low.gain.linearRampToValueAtTime(0, at(stages.swap + bassEdge));
    holdParam(from.low.gain, 0);
    from.low.gain.setValueAtTime(0, at(stages.swap - bassEdge));
    from.low.gain.linearRampToValueAtTime(BASS_CUT_DB, at(stages.swap + bassEdge));

    // Outgoing filters move with the chosen exit. The old deck does not
    // sit under the new one as a long, plain crossfade.
    holdParam(from.sweep.frequency, 20);
    from.sweep.frequency.setValueAtTime(20, at(stages.swap));
    if (from.tone) {
      holdParam(from.tone.frequency, TONE_OPEN_HZ);
      from.tone.frequency.setValueAtTime(TONE_OPEN_HZ, at(0));
      if (perform) {
        from.tone.frequency.exponentialRampToValueAtTime(9000, at(stages.swap));
      } else {
        from.tone.frequency.setValueAtTime(TONE_OPEN_HZ, at(stages.swap));
      }
    }
    if (mix.exit === "echo") {
      from.sweep.frequency.exponentialRampToValueAtTime(250, at(stages.drop));
      if (from.tone) from.tone.frequency.exponentialRampToValueAtTime(4200, at(stages.drop));
    } else if (mix.exit === "loop") {
      from.sweep.frequency.exponentialRampToValueAtTime(900, at(stages.out));
      if (from.tone) from.tone.frequency.exponentialRampToValueAtTime(1300, at(stages.out));
    } else {
      from.sweep.frequency.exponentialRampToValueAtTime(650, at(stages.drop));
      from.sweep.frequency.exponentialRampToValueAtTime(1000, at(stages.out));
      if (from.tone) {
        from.tone.frequency.exponentialRampToValueAtTime(1800, at(stages.drop));
        from.tone.frequency.exponentialRampToValueAtTime(900, at(stages.out));
      }
    }

    const exitLevel = level * (perform ? 0.78 : 1);
    if (mix.exit === "loop") {
      scheduleLoopOut(mix, from, level, at, delay);
    } else if (mix.exit === "echo") {
      from.gain.gain.setValueAtTime(exitLevel, at(stages.swap));
      from.gain.gain.exponentialRampToValueAtTime(Math.max(exitLevel * 0.04, 0.0001), at(stages.drop));
      from.gain.gain.linearRampToValueAtTime(0, at(Math.min(stages.out, stages.drop + 0.5)));
      scheduleEchoOut(mix, from, at);
    } else {
      from.gain.gain.setValueAtTime(exitLevel, at(stages.swap));
      from.gain.gain.exponentialRampToValueAtTime(Math.max(exitLevel * 0.08, 0.0001), at(stages.drop));
      from.gain.gain.linearRampToValueAtTime(0, at(Math.min(stages.out, stages.drop + 1)));
    }
  }

  mix.timers.push(setTimeout(() => swapDecks(mix), delay(stages.swap)));
  mix.timers.push(setTimeout(() => finishMix(mix), delay(stages.out) + 120));
}

function swapDecks(mix) {
  if (engine.mix !== mix || mix.swapped) return;
  mix.swapped = true;
  engine.active = mix.toDeck;
  // Choose the following track now, while this one starts, so the "up
  // next" display and the deck that frees up at the end of the mix agree.
  engine.nextIndex = chooseNextIndex(mix.target);
  emitTrack(mix.target);
}

function finishMix(mix) {
  if (engine.mix !== mix) return;
  for (const timer of mix.timers) clearTimeout(timer);
  swapDecks(mix);
  const from = engine.decks[mix.fromDeck];
  const to = engine.decks[mix.toDeck];
  resetDeck(to, 1);
  resetDeck(from, 0);
  from.element.pause();
  from.rate = 1;
  from.element.playbackRate = 1;
  engine.mix = null;
  loadDeck(mix.fromDeck, engine.nextIndex ?? (mix.target + 1) % engine.playlist.length);
  emitMix();
}

function abortMix(mix) {
  if (engine.mix !== mix) return;
  for (const timer of mix.timers) clearTimeout(timer);
  const from = engine.decks[mix.fromDeck];
  const to = engine.decks[mix.toDeck];
  to.element.pause();
  resetDeck(to, 0);
  resetDeck(from, 1);
  engine.active = mix.fromDeck;
  engine.mix = null;
}

// Keeps the incoming deck on the outgoing grid during a synced mix, the way
// a DJ nudges a platter.
function nudgeMix(mix) {
  if (!mix.synced || mix.lockRate || mix.swapped) return;
  const from = engine.decks[mix.fromDeck];
  const to = engine.decks[mix.toDeck];
  const fromRate = from.element.playbackRate || 1;
  const fromBeat = mix.fromTempo.period / fromRate;
  const toBeat = mix.toTempo.period / mix.rate;
  const period = Math.min(fromBeat, toBeat);
  const wrap = (value) => ((value % period) + period) % period;
  const fromPhase = wrap((from.element.currentTime - mix.fromTempo.offset) / fromRate);
  const toPhase = wrap((to.element.currentTime - mix.toTempo.offset) / mix.rate);
  let drift = fromPhase - toPhase;
  if (drift > period / 2) drift -= period;
  if (drift < -period / 2) drift += period;
  mix.drift = drift;
  const factor = Math.abs(drift) < 0.012 ? 1 : 1 + clamp(drift, -0.03, 0.03);
  to.element.playbackRate = mix.rate * factor;
}

function skipBrokenTrack() {
  if (engine.playlist.length === 0) return;
  if (engine.switching || engine.mix) {
    setTimeout(skipBrokenTrack, 300);
    return;
  }
  engine.errorCount += 1;
  if (engine.errorCount > engine.playlist.length) {
    emitState("failed", false);
    scheduleRecovery();
    return;
  }
  // Pick again: the cued track may be the broken one.
  engine.nextIndex = chooseNextIndex(engine.currentIndex);
  startMix(engine.nextIndex, "cut");
}

function doTogglePlayback() {
  if (!engine.ctx || engine.playlist.length === 0) return;
  if (engine.mix) finishMix(engine.mix);
  const deck = engine.decks[engine.active];
  if (!deck) return;
  if (deck.element.paused) {
    engine.ctx
      .resume()
      .then(() => playDeck(engine.active))
      .then(() => {
        removeUnlockListeners();
        emitState(contextRunning() ? "live" : "blocked", contextRunning());
      })
      .catch((error) => {
        if (error && (error.name === "NotAllowedError" || error.name === "AbortError")) {
          emitState("blocked", false);
        } else {
          skipBrokenTrack();
        }
      });
  } else {
    deck.element.pause();
    emitState("paused", false);
  }
}

function doNextTrack() {
  if (engine.playlist.length === 0) return;
  if (engine.mix) {
    finishMix(engine.mix);
    return;
  }
  startMix(engine.nextIndex ?? engine.currentIndex + 1, "quick");
}

function doPreviousTrack() {
  if (engine.playlist.length === 0) return;
  if (engine.mix) finishMix(engine.mix);
  const target = engine.previousIndex != null ? engine.previousIndex : engine.currentIndex - 1;
  startMix(target, "cut");
}

function doSeek(seconds) {
  if (engine.playlist.length === 0) return;
  if (engine.mix) finishMix(engine.mix);
  const deck = engine.decks[engine.active];
  if (!deck) return;
  const duration = deck.element.duration;
  if (!Number.isFinite(duration) || duration <= 0) return;
  deck.element.currentTime = clamp(seconds, 0, Math.max(0, duration - 1));
  emitProgress(Math.floor(deck.element.currentTime), Math.floor(duration));
}

// Seconds the next automatic mix will take, from the current deck's grid.
function autoMixSeconds(deck) {
  const tempo = trackTempo(deck.index);
  if (!tempo) return FREE_MIX_OUT_SECONDS + 0.6;
  const beat = tempo.period / (deck.element.playbackRate || 1);
  return (AUTO_MIX_OUT_BEATS + 4) * beat + MIX_LEAD;
}

// The status line under the track title. progress is how far the current
// mix has run (0 when no mix runs); the text says in plain words what the
// auto-DJ does now and what it does next.
function mixStatus() {
  const mix = engine.mix;
  const deck = engine.decks[engine.active];
  if (!mix) {
    if (!deck || deck.element.paused) return { progress: 0, text: "PAUSED" };
    const element = deck.element;
    const left = Number.isFinite(element.duration)
      ? (element.duration - element.currentTime) / (element.playbackRate || 1) - autoMixSeconds(deck) - 2
      : 0;
    const when = left > 0 ? `NEXT MIX IN ${formatClock(left)}` : "NEXT MIX SOON";
    const tempo = trackTempo(deck.index);
    const nextTempo = engine.nextIndex != null ? trackTempo(engine.nextIndex) : undefined;
    if (tempo === undefined || nextTempo === undefined) {
      return { progress: 0, text: `ANALYSING BEATS FOR THE NEXT MIX · ${when}` };
    }
    if (tempo && nextTempo) {
      const rate = syncRate(
        tempo.bpm * (element.playbackRate || 1),
        nextTempo.bpm,
        mixLockRate(deck.index, engine.nextIndex),
      );
      if (rate) {
        const bpm = Math.round(tempo.bpm * (element.playbackRate || 1));
        return { progress: 0, text: `NEXT TRACK BEATMATCHED AT ${bpm} BPM · ${when}` };
      }
      return { progress: 0, text: `NO BEAT MATCH FOR THE NEXT TRACK · ${when}` };
    }
    return { progress: 0, text: `NO CLEAR BEAT · ${when}` };
  }

  const elapsed = (engine.ctx.currentTime - mix.startCtx) / mix.beat;
  const progress = Math.round(clamp(elapsed / mix.stages.out, 0, 1) * 100);
  const tempoChange = mix.synced && Math.abs(mix.rate - 1) > 0.001
    ? ` · TEMPO ${mix.rate > 1 ? "+" : ""}${((mix.rate - 1) * 100).toFixed(1)}%`
    : "";
  const locked = `BEATS LOCKED AT ${Math.round(mix.bpm)} BPM${tempoChange}`;
  let text;
  if (mix.kind === "cut") text = "MIXING · CUT TO THE NEXT TRACK";
  else if (!mix.synced) text = "MIXING · NO BEAT MATCH · SLAM CUT";
  else if (elapsed < 0) text = `MIXING · NEXT TRACK ENTERS EARLY ON THE BEAT · ${locked}`;
  else if (mix.performance && elapsed < mix.stages.tease) text = `MIXING · TEASING THE NEXT TRACK · CUTS IN AND OUT · ${locked}`;
  else if (mix.performance && elapsed < mix.stages.ride) text = `MIXING · RIDING BOTH TRACKS · NEW TRACK UNDER THE OLD · ${locked}`;
  else if (mix.performance && elapsed < mix.stages.swap - 0.5) text = `MIXING · TRADING BARS · BOTH TRACKS TAKE TURNS · ${locked}`;
  else if (elapsed < mix.stages.swap - 0.5) text = `MIXING · PUNCH IN · NEW BASS HELD BACK · ${locked}`;
  else if (elapsed < mix.stages.swap + 0.5) text = "MIXING · BASS SWAP ON THE BAR";
  else if (mix.exit === "echo") text = "MIXING · ECHO OUT · OLD TRACK TAIL IN TIME";
  else if (mix.exit === "loop") text = "MIXING · LOOP OUT · OLD BEAT REPEATS";
  else text = "MIXING · FILTER DROP · OLD TRACK OUT";
  return { progress, text };
}

function formatClock(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function emitMix() {
  const callback = engine.onMix;
  if (typeof callback !== "function") return;
  const status = mixStatus();
  const deck = engine.decks[engine.active];
  const tempo = deck ? trackTempo(deck.index) : undefined;
  const bpm = tempo ? `${Math.round(tempo.bpm * (deck.element.playbackRate || 1))} BPM` : "";
  const key = `${status.progress}|${status.text}|${bpm}`;
  if (key === engine.lastMix) return;
  engine.lastMix = key;
  try {
    callback(status.progress, status.text, bpm);
  } catch (_error) {
    // Ignore a callback racing with a reload.
  }
}

function tick() {
  if (!engine.ctx) return;
  const deck = engine.decks[engine.active];
  if (!deck) return;
  const element = deck.element;

  const now = performance.now();
  if (now - engine.lastProgressAt > 500) {
    engine.lastProgressAt = now;
    if (Number.isFinite(element.duration) && element.duration > 0) {
      emitProgress(Math.floor(element.currentTime), Math.floor(element.duration));
    }
  }

  if (engine.mix) {
    nudgeMix(engine.mix);
  } else if (Math.abs(deck.rate - 1) > 0.0005 && !element.paused) {
    // After a synced mix, ease the deck back to its own tempo.
    deck.rate += clamp(1 - deck.rate, -0.002, 0.002);
    element.playbackRate = deck.rate;
  }
  emitMix();

  if (
    !engine.mix &&
    !engine.switching &&
    !element.paused &&
    Number.isFinite(element.duration) &&
    element.duration > 0
  ) {
    const remaining = (element.duration - element.currentTime) / (element.playbackRate || 1);
    const lead = autoMixSeconds(deck) + 2;
    if (remaining <= lead) {
      const target = engine.nextIndex ?? (engine.currentIndex + 1) % engine.playlist.length;
      // A beat grid that is still being read is worth a short wait: start
      // the mix only when the analysis is done (match or not) or when the
      // track is too close to its end to wait any longer.
      const pending = trackTempo(deck.index) === undefined || trackTempo(target) === undefined;
      if (!pending || remaining <= 12) {
        let kind = "quick";
        if (remaining >= lead - 2) {
          kind = "auto";
        } else {
          const tempo = trackTempo(deck.index);
          const quickSeconds = tempo
            ? (36 * tempo.period) / (element.playbackRate || 1)
            : 0;
          if (tempo && remaining < quickSeconds) kind = "cut";
        }
        startMix(target, kind);
      }
    }
  }
}

// ------------------------------------------------------------------ unlock

function unlockAudio() {
  if (!engine.ctx) return;
  engine.ctx
    .resume()
    .then(() => {
      if (!contextRunning()) {
        emitState("blocked", false);
        return;
      }
      removeUnlockListeners();
      const deck = engine.decks[engine.active];
      if (deck && deck.element.paused) {
        playDeck(engine.active).catch(() => {});
      }
      emitState("live", true);
    })
    .catch(() => emitState("blocked", false));
}

function unlockEvent() {
  unlockAudio();
}

function installUnlockListeners() {
  if (engine.unlockInstalled) return;
  engine.unlockInstalled = true;
  document.addEventListener("pointerdown", unlockEvent, true);
  document.addEventListener("keydown", unlockEvent, true);
  document.addEventListener("touchstart", unlockEvent, true);
}

function removeUnlockListeners() {
  if (!engine.unlockInstalled) return;
  engine.unlockInstalled = false;
  document.removeEventListener("pointerdown", unlockEvent, true);
  document.removeEventListener("keydown", unlockEvent, true);
  document.removeEventListener("touchstart", unlockEvent, true);
}

// ------------------------------------------------------------------- canvas

function ensureCanvas() {
  if (engine.canvas && engine.canvas.isConnected) return true;
  const canvas = document.getElementById("vj-art");
  if (!canvas) return false;
  engine.canvas = canvas;
  return attachArt(canvas);
}

function readEnergy(time) {
  const target = { bass: 0, mid: 0, high: 0, level: 0 };
  let signalSum = 0;

  if (engine.analyser && contextRunning()) {
    engine.analyser.getByteFrequencyData(engine.freqData);
    const data = engine.freqData;
    for (let index = 1; index < 100; index += 1) signalSum += data[index];
    const average = (from, to) => {
      let total = 0;
      for (let index = from; index < to; index += 1) total += data[index];
      return total / ((to - from) * 255);
    };
    target.bass = Math.pow(average(1, 9), 1.25) * 1.7;
    target.mid = Math.pow(average(9, 34), 1.1) * 1.5;
    target.high = Math.pow(average(34, 92), 0.95) * 1.6;
    target.level = average(1, 100);
  }

  if (signalSum > 120) {
    engine.signal = 1;
  } else {
    engine.signal = Math.max(0, engine.signal - 0.035);
    target.bass = 0.38 + 0.22 * Math.sin(time * 2.3);
    target.mid = 0.3 + 0.18 * Math.sin(time * 3.5 + 1.2);
    target.high = 0.22 + 0.14 * Math.sin(time * 5.1 + 2.1);
    target.level = 0.32 + 0.1 * Math.sin(time * 1.9);
  }

  for (const key of Object.keys(target)) {
    engine.energy[key] += (clamp(target[key], 0, 1) - engine.energy[key]) * 0.22;
  }

  // Kick detection: bass jumping above its running average. Without a
  // signal the scene keeps an idle 100 BPM pulse.
  const sinceBeat = time - engine.lastBeatAt;
  const kick = engine.signal > 0.5
    ? target.bass > engine.bassAverage * 1.18 + 0.04 && sinceBeat > 0.26
    : sinceBeat > 0.6;
  engine.bassAverage += (target.bass - engine.bassAverage) * 0.06;
  if (kick || sinceBeat > 1.2) {
    engine.beats += 1;
    engine.lastBeatAt = time;
  }
}

// What the pixel booth shows: which platters spin and where the fader sits.
function deckView() {
  const mix = engine.mix;
  let fader = engine.active;
  if (mix) {
    const elapsed = (engine.ctx.currentTime - mix.startCtx) / mix.beat;
    fader = mix.fromDeck + (mix.toDeck - mix.fromDeck) * clamp(elapsed / mix.stages.out, 0, 1);
  }
  const spinning = engine.decks.map((deck) => Boolean(deck && !deck.element.paused));
  return { fader, a: spinning[0] || false, b: spinning[1] || false };
}

function frame(timestamp) {
  engine.raf = requestAnimationFrame(frame);
  const time = timestamp / 1000;
  if (!ensureCanvas()) return;
  readEnergy(time);
  drawFrame(time, engine.energy, engine.beats, time - engine.lastBeatAt, deckView());
}

// --------------------------------------------------------------- public api

export function startDj(onTrack, onProgress, onState, onMix) {
  engine.onTrack = onTrack;
  engine.onProgress = onProgress;
  engine.onState = onState;
  engine.onMix = onMix;

  ensureAudio();
  if (!engine.ctx) return;
  ensureDecks();
  ensureCanvas();
  installUnlockListeners();

  if (!engine.timer) engine.timer = setInterval(tick, TICK_MS);
  if (!engine.raf) engine.raf = requestAnimationFrame(frame);

  loadFeed();
}

export function togglePlayback() {
  doTogglePlayback();
}

export function seekTo(seconds) {
  doSeek(seconds);
}

export function nextTrack() {
  doNextTrack();
}

export function previousTrack() {
  doPreviousTrack();
}

export function setMuted(muted) {
  engine.muted = Boolean(muted);
  if (!engine.ctx || !engine.master) return;
  const ctx = engine.ctx;
  const target = engine.muted ? 0.0001 : 0.7;
  engine.master.gain.cancelScheduledValues(ctx.currentTime);
  engine.master.gain.setValueAtTime(
    Math.max(engine.master.gain.value, 0.0001),
    ctx.currentTime,
  );
  engine.master.gain.exponentialRampToValueAtTime(target, ctx.currentTime + 0.18);
}

export function stopDj() {
  engine.analysisRun += 1;
  if (engine.timer) clearInterval(engine.timer);
  if (engine.raf) cancelAnimationFrame(engine.raf);
  engine.timer = null;
  engine.raf = null;
  if (engine.mix) {
    for (const timer of engine.mix.timers) clearTimeout(timer);
    engine.mix = null;
  }
  engine.switching = false;
  for (const deck of engine.decks) {
    try {
      deck.element.pause();
      deck.element.removeAttribute("src");
      deck.element.load();
    } catch (_error) {
      // Already torn down.
    }
  }
  if (engine.ctx && engine.ctx.state !== "closed") {
    engine.ctx.close().catch(() => {});
  }
  engine.ctx = null;
  engine.decks = [];
  engine.playlist = [];
}
