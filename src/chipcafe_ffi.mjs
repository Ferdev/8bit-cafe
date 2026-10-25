// 8bit.cafe: one auto-DJ channel fed by the latest chiptune on Audius,
// streamed through two decks with beatmatched crossfades, plus a pixel-art VJ
// built from hand-drawn 8/16-bit sprites.

const CROSSFADE_SECONDS = 4;
const FADE_SECONDS = 2.6;
const TICK_MS = 250;
const CANVAS_W = 320;
const CANVAS_H = 180;

const ACCENTS = [
  ["#3ae8ff", "#ff3ad4"],
  ["#3affa0", "#3ae8ff"],
  ["#ffb03a", "#ff3ad4"],
  ["#b46bff", "#3ae8ff"],
  ["#ff3ad4", "#ffb03a"],
  ["#9bbc0f", "#3affa0"],
  ["#8a84b0", "#3ae8ff"],
];

const DARK = "#0a0614";
const INK = "#e8e4ff";
const SKIN = "#ffd9a0";
const PAPER = "#fff6e0";

const engine = {
  ctx: null,
  mixBus: null,
  master: null,
  analyser: null,
  freqData: null,
  decks: [],
  active: 0,
  switching: false,
  playlist: [],
  currentIndex: 0,
  retried: false,
  errorCount: 0,
  recoveryTimer: null,
  onTrack: null,
  onProgress: null,
  onState: null,
  lastState: "",
  muted: false,
  timer: null,
  raf: null,
  lastProgressAt: 0,
  canvas: null,
  gfx: null,
  canvasWanted: false,
  stars: [],
  notes: [],
  particles: [],
  energy: { bass: 0, mid: 0, high: 0, level: 0 },
  signal: 0,
  palette: { a: [58, 232, 255], b: [255, 58, 212] },
  unlockInstalled: false,
};

// --------------------------------------------------------------- utilities

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const clean = String(hex || "").replace("#", "");
  if (clean.length !== 6) return [58, 232, 255];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function mixRgb(a, b, amount) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * amount),
    Math.round(a[1] + (b[1] - a[1]) * amount),
    Math.round(a[2] + (b[2] - a[2]) * amount),
  ];
}

function rgb(color) {
  return `rgb(${color[0]},${color[1]},${color[2]})`;
}

function rgba(color, alpha) {
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}

function shade(color, amount) {
  return mixRgb(color, [8, 6, 20], amount);
}

function cleanTitle(title) {
  return String(title || "Untitled")
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
  const next = engine.playlist[(index + 1) % engine.playlist.length];
  engine.currentIndex = index;
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
  engine.palette = {
    a: hexToRgb(track.accent),
    b: hexToRgb(track.accent_alt),
  };
}

// ------------------------------------------------------------------- feed

function isoDate(track) {
  return String(track.release_date || track.created_at || "").slice(0, 10);
}

function looksChiptune(track) {
  const hay = `${track.title || ""} ${track.genre || ""} ${track.tags || ""}`.toLowerCase();
  return (
    track.genre === "Chiptune" ||
    /chip|8-?bit|16-?bit|gameboy|famitracker|tracker|nes|pixel/.test(hay)
  );
}

function licenseLabel(license) {
  if (!license || /all rights reserved/i.test(license)) return "";
  if (/sharealike/i.test(license) && /noncommercial/i.test(license)) return "CC BY-NC-SA";
  if (/noncommercial/i.test(license)) return "CC BY-NC";
  if (/sharealike/i.test(license)) return "CC BY-SA";
  if (/attribution/i.test(license)) return "CC BY";
  if (/public domain|cc0/i.test(license)) return "CC0";
  return "";
}

function licenseUrl(license) {
  const label = licenseLabel(license);
  switch (label) {
    case "CC BY-NC-SA":
      return "https://creativecommons.org/licenses/by-nc-sa/4.0/";
    case "CC BY-NC":
      return "https://creativecommons.org/licenses/by-nc/4.0/";
    case "CC BY-SA":
      return "https://creativecommons.org/licenses/by-sa/4.0/";
    case "CC BY":
      return "https://creativecommons.org/licenses/by/4.0/";
    case "CC0":
      return "https://creativecommons.org/publicdomain/zero/1.0/";
    default:
      return "";
  }
}

function toTrack(track) {
  const user = track.user || {};
  return {
    id: String(track.id),
    title: cleanTitle(track.title),
    artist: user.name || user.handle || "Unknown artist",
    album: "",
    released: isoDate(track),
    artist_url: user.handle ? `https://audius.co/${user.handle}` : "",
    track_url: track.permalink ? `https://audius.co${track.permalink}` : "",
    license: licenseLabel(track.license),
    license_url: licenseUrl(track.license),
    seconds: Math.round(track.duration || 0),
    audio_url: track.stream && track.stream.url ? track.stream.url : "",
    accent: ACCENTS[0][0],
    accent_alt: ACCENTS[0][1],
    plays: track.play_count || 0,
  };
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

async function buildPlaylist(items) {
  const seen = new Set();
  const tracks = [];
  for (const item of items) {
    if (!item || !item.id || item.is_delete || !item.is_streamable) continue;
    if (!item.stream || !item.stream.url) continue;
    if (!item.user || !item.user.handle) continue;
    if (!Number.isFinite(item.duration) || item.duration < 30 || item.duration > 900) continue;
    if (seen.has(String(item.id))) continue;
    if (!looksChiptune(item)) continue;
    seen.add(String(item.id));
    tracks.push(toTrack(item));
  }

  tracks.sort((a, b) => {
    const byDate = (b.released || "").localeCompare(a.released || "");
    if (byDate !== 0) return byDate;
    return (b.plays || 0) - (a.plays || 0);
  });

  const primary = [];
  const extra = [];
  const artists = new Set();
  for (const track of tracks) {
    if (!artists.has(track.artist)) {
      artists.add(track.artist);
      primary.push(track);
    } else {
      extra.push(track);
    }
  }

  const candidates = primary.concat(extra).slice(0, 24);
  const checks = await Promise.all(candidates.map(preflightTrack));
  let selected = candidates.filter((_track, index) => checks[index]).slice(0, 14);
  if (selected.length < 3) selected = tracks.slice(0, 14);

  return selected.map((track, index) => {
    const accent = ACCENTS[index % ACCENTS.length];
    return { ...track, accent: accent[0], accent_alt: accent[1] };
  });
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("feed request failed: " + response.status);
  return response.json();
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
  const searches = [
    "/api/audius/v1/tracks/search?" +
      new URLSearchParams({
        query: "",
        genre: "Chiptune",
        app_name: "8bitcafe",
        limit: "50",
      }),
    "/api/audius/v1/tracks/search?" +
      new URLSearchParams({
        query: "chiptune",
        app_name: "8bitcafe",
        limit: "100",
      }),
  ];

  try {
    const results = await Promise.all(searches.map((url) => fetchJson(url)));
    const items = results.flatMap((result) => (Array.isArray(result.data) ? result.data : []));
    const playlist = await buildPlaylist(items);
    if (playlist.length === 0) throw new Error("no playable chiptune tracks");

    engine.playlist = playlist;
    engine.retried = false;
    engine.currentIndex = 0;
    engine.errorCount = 0;
    if (engine.recoveryTimer) {
      clearTimeout(engine.recoveryTimer);
      engine.recoveryTimer = null;
    }

    loadDeck(0, 0);
    loadDeck(1, 1 % playlist.length);
    engine.decks[0].gain.gain.value = 1;
    engine.decks[1].gain.gain.value = 0.0001;

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

function ensureDecks() {
  if (engine.decks.length > 0) return;
  for (let index = 0; index < 2; index += 1) {
    const element = new Audio();
    element.crossOrigin = "anonymous";
    element.preload = "auto";
    element.setAttribute("playsinline", "");
    element.style.display = "none";
    document.body.appendChild(element);

    const source = engine.ctx.createMediaElementSource(element);
    const gain = engine.ctx.createGain();
    gain.gain.value = index === 0 ? 1 : 0.0001;
    source.connect(gain);
    gain.connect(engine.mixBus);

    const deck = { element, gain, index: null };
    element.addEventListener("ended", () => {
      if (engine.decks[engine.active] === deck && !engine.switching) {
        switchTo(engine.currentIndex + 1, 0.4);
      }
    });
    element.addEventListener("error", () => {
      if (engine.decks[engine.active] === deck) {
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

function fadeTo(deck, target, seconds) {
  const now = engine.ctx.currentTime;
  deck.gain.gain.cancelScheduledValues(now);
  deck.gain.gain.setValueAtTime(Math.max(deck.gain.gain.value, 0.0001), now);
  deck.gain.gain.exponentialRampToValueAtTime(target, now + seconds);
}

function switchTo(targetIndex, fadeSeconds) {
  if (engine.switching || engine.playlist.length === 0) return;
  const length = engine.playlist.length;
  const target = ((targetIndex % length) + length) % length;
  const oldDeckIndex = engine.active;
  const newDeckIndex = 1 - oldDeckIndex;
  const oldDeck = engine.decks[oldDeckIndex];
  const newDeck = engine.decks[newDeckIndex];
  if (!oldDeck || !newDeck) return;

  engine.switching = true;
  loadDeck(newDeckIndex, target);
  newDeck.gain.gain.cancelScheduledValues(engine.ctx.currentTime);
  newDeck.gain.gain.setValueAtTime(0.0001, engine.ctx.currentTime);

  playDeck(newDeckIndex)
    .then(() => {
      fadeTo(newDeck, 1, fadeSeconds);
      fadeTo(oldDeck, 0.0001, fadeSeconds);
      engine.active = newDeckIndex;
      engine.switching = false;
      engine.errorCount = 0;
      emitTrack(target);
      if (contextRunning()) emitState("live", true);
      else emitState("blocked", false);

      setTimeout(() => {
        if (engine.active === oldDeckIndex) return;
        oldDeck.element.pause();
        oldDeck.element.currentTime = 0;
        loadDeck(oldDeckIndex, (target + 1) % length);
      }, fadeSeconds * 1000 + 250);
    })
    .catch((error) => {
      engine.switching = false;
      if (error && (error.name === "NotAllowedError" || error.name === "AbortError")) {
        emitState("blocked", false);
      } else {
        skipBrokenTrack();
      }
    });
}

function skipBrokenTrack() {
  if (engine.playlist.length === 0) return;
  if (engine.switching) {
    setTimeout(skipBrokenTrack, 300);
    return;
  }
  engine.errorCount += 1;
  if (engine.errorCount > engine.playlist.length) {
    emitState("failed", false);
    scheduleRecovery();
    return;
  }
  switchTo(engine.currentIndex + 1, 0.3);
}

function doTogglePlayback() {
  if (!engine.ctx || engine.playlist.length === 0) return;
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
  switchTo(engine.currentIndex + 1, 1.1);
}

function doPreviousTrack() {
  if (engine.playlist.length === 0) return;
  switchTo(engine.currentIndex - 1, 0.8);
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

  if (
    !engine.switching &&
    !element.paused &&
    Number.isFinite(element.duration) &&
    element.duration > 0
  ) {
    const remaining = element.duration - element.currentTime;
    if (remaining <= CROSSFADE_SECONDS) {
      switchTo(engine.currentIndex + 1, FADE_SECONDS);
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
  if (engine.gfx && document.getElementById("vj-art") === engine.canvas) {
    return true;
  }
  const canvas = document.getElementById("vj-art");
  if (!canvas) {
    if (!engine.canvasWanted) {
      engine.canvasWanted = true;
      requestAnimationFrame(() => {
        engine.canvasWanted = false;
        ensureCanvas();
      });
    }
    return false;
  }
  engine.canvas = canvas;
  engine.canvas.width = CANVAS_W;
  engine.canvas.height = CANVAS_H;
  engine.gfx = canvas.getContext("2d");
  engine.gfx.imageSmoothingEnabled = false;
  const random = mulberry32(8317);
  engine.stars = Array.from({ length: 54 }, () => ({
    x: Math.floor(random() * CANVAS_W),
    y: Math.floor(random() * 96),
    size: random() < 0.85 ? 1 : 2,
    phase: random() * Math.PI * 2,
  }));
  return true;
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
}

function px(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

function pixelDisc(g, cx, cy, radius, color, cut) {
  for (let dy = -radius; dy <= radius; dy += 1) {
    const width = Math.floor(Math.sqrt(radius * radius - dy * dy));
    if (cut && dy > radius * 0.15 && Math.floor((dy + radius) / 3) % 2 === 0) continue;
    px(g, cx - width, cy + dy, width * 2 + 1, 1, color);
  }
}

function drawSky(g, time, energy, palette) {
  const horizon = 120;
  const top = mixRgb([7, 5, 18], palette.a, 0.12);
  const middle = mixRgb([20, 8, 40], palette.b, 0.26);
  const bottom = mixRgb([36, 13, 58], palette.a, 0.42);
  for (let y = 0; y < horizon; y += 8) {
    const f = y / horizon;
    const color = f < 0.5 ? mixRgb(top, middle, f * 2) : mixRgb(middle, bottom, (f - 0.5) * 2);
    px(g, 0, y, CANVAS_W, 8, rgb(color));
  }

  for (const star of engine.stars) {
    const twinkle = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * 2 + star.phase));
    const alpha = clamp(0.25 + twinkle * (0.45 + energy.high * 0.55), 0, 1);
    px(g, star.x, star.y, star.size, star.size, rgba([255, 246, 224], alpha));
  }

  const airshipX = ((time * 4) % 400) - 60;
  const airshipY = 54;
  const balloon = rgb(mixRgb([90, 80, 130], palette.a, 0.4));
  px(g, airshipX + 4, airshipY, 20, 2, DARK);
  px(g, airshipX + 2, airshipY + 2, 24, 4, balloon);
  px(g, airshipX + 4, airshipY + 6, 20, 2, DARK);
  px(g, airshipX + 10, airshipY + 8, 8, 3, DARK);
  px(g, airshipX + 12, airshipY + 9, 4, 1, rgb(palette.a));
  if (Math.floor(time * 2) % 2 === 0) px(g, airshipX + 5, airshipY + 4, 1, 1, PAPER);

  for (let index = 0; index < 3; index += 1) {
    const birdX = ((time * (7 + index * 2) + index * 120) % 400) - 40;
    const birdY = 32 + index * 14 + Math.sin(time * 2 + index) * 2;
    px(g, birdX, birdY, 1, 1, INK);
    px(g, birdX + 1, birdY - 1, 1, 1, INK);
    px(g, birdX + 2, birdY, 1, 1, INK);
  }

  for (let index = 0; index < 3; index += 1) {
    const x = ((time * (6 + index * 3) + index * 130) % 380) - 40;
    const y = 26 + index * 18;
    const color = rgba(mixRgb([120, 110, 160], palette.a, 0.35), 0.55);
    px(g, x + 4, y, 14, 2, color);
    px(g, x, y + 2, 24, 3, color);
    px(g, x + 3, y + 5, 16, 2, color);
  }
}

function drawMoon(g, time, energy, palette) {
  const cx = 254;
  const cy = 42;
  const radius = 14 + Math.round(energy.bass * 4);
  const glow = mixRgb(palette.b, [255, 246, 224], 0.45);
  pixelDisc(g, cx, cy, radius + 3, rgba(glow, 0.12), false);
  pixelDisc(g, cx, cy, radius, rgb(glow), true);
  pixelDisc(g, cx, cy, Math.max(3, radius - 4), rgb(mixRgb(glow, [255, 255, 255], 0.25)), false);
  px(g, cx - 5, cy - 3, 3, 2, rgba([180, 120, 150], 0.5));
  px(g, cx + 4, cy + 4, 4, 2, rgba([180, 120, 150], 0.4));
  if (engine.signal > 0.5) {
    px(g, cx - radius - 6, cy - 8, 1, 1, PAPER);
    px(g, cx + radius + 5, cy + 10, 1, 1, PAPER);
  }
}

function drawRidge(g, baseY, minHeight, maxHeight, color, seed) {
  const random = mulberry32(seed);
  let height = (minHeight + maxHeight) / 2;
  for (let x = 0; x < CANVAS_W; x += 4) {
    height = clamp(height + (random() - 0.5) * 9, minHeight, maxHeight);
    const h = Math.round(height);
    px(g, x, baseY - h, 4, h, color);
    px(g, x, baseY - h, 4, 1, rgba([255, 255, 255], 0.08));
  }
}

function drawGround(g, time, energy, palette) {
  px(g, 0, 120, CANVAS_W, 60, rgb(mixRgb([8, 6, 20], palette.b, 0.12)));
  for (let x = 0; x < CANVAS_W; x += 8) {
    const color = Math.floor((x + time * 2) / 8) % 2 === 0
      ? mixRgb([14, 10, 30], palette.a, 0.18)
      : mixRgb([10, 8, 24], palette.b, 0.12);
    px(g, x, 120, 7, 6, rgb(color));
  }
  for (let y = 128; y < 180; y += 8) {
    for (let x = 0; x < CANVAS_W; x += 16) {
      const even = ((x / 16) + (y / 8)) % 2 === 0;
      px(g, x, y, 16, 8, rgb(even
        ? mixRgb([12, 9, 28], palette.a, 0.1)
        : mixRgb([8, 6, 20], palette.b, 0.08)));
      if ((x / 16 + y / 8) % 5 === 0) {
        px(g, x + 7, y + 3, 2, 2, rgba(palette.a, 0.22 + energy.bass * 0.3));
      }
    }
  }
}

function drawNoteSprite(g, x, y, color, scale = 1) {
  const rows = ["...x", "...x", "...x", "...x", ".xxx", "xxxx", ".xx."];
  for (let row = 0; row < rows.length; row += 1) {
    for (let col = 0; col < rows[row].length; col += 1) {
      if (rows[row][col] === "x") px(g, x + col * scale, y + row * scale, scale, scale, color);
    }
  }
}

function drawSpeaker(g, x, y, energy, palette) {
  px(g, x, y, 16, 24, DARK);
  px(g, x + 1, y + 1, 14, 22, rgb(mixRgb([18, 14, 38], palette.a, 0.2)));
  px(g, x + 1, y + 1, 14, 1, rgb(palette.a));
  const pulse = 3 + Math.round(energy.mid * 3);
  pixelDisc(g, x + 8, y + 8, 5, rgb(mixRgb([30, 22, 50], palette.b, 0.35)), false);
  pixelDisc(g, x + 8, y + 8, pulse, rgba(palette.a, 0.85), false);
  pixelDisc(g, x + 8, y + 19, 3, rgba(palette.b, 0.5 + energy.high * 0.4), false);
}

function drawDisc(g, cx, cy, radius, ring, center, time, energy) {
  pixelDisc(g, cx, cy, radius, DARK, false);
  pixelDisc(g, cx, cy, radius - 1, rgb(mixRgb(ring, [24, 16, 44], 0.55)), false);
  pixelDisc(g, cx, cy, radius - 3, DARK, false);
  pixelDisc(g, cx, cy, radius - 4, rgba(ring, 0.45), false);
  px(g, cx - 1, cy - 1, 3, 3, rgb(center));
  const angle = time * (2.4 + energy.mid);
  const hx = cx + Math.round(Math.cos(angle) * (radius - 2));
  const hy = cy + Math.round(Math.sin(angle) * (radius - 2));
  px(g, hx, hy, 1, 1, PAPER);
  px(g, cx - radius + 1, cy + 1, 1, 1, rgba(PAPER, 0.5));
}

function drawDj(g, time, energy, palette) {
  const cx = 190;
  const bob = Math.round(Math.sin(time * 3.1) + energy.bass * 2);
  const headX = cx - 6;
  const headY = 90 + bob;
  const jacket = rgb(mixRgb(palette.b, [40, 24, 70], 0.35));
  const hair = rgb(mixRgb(palette.a, [40, 20, 60], 0.15));
  const accent = rgb(palette.a);
  const armUp = Math.floor(time * 4) % 2 === 0;

  px(g, cx - 8, 119 + bob, 16, 2, rgba(DARK, 0.6));
  px(g, cx - 7, 103 + bob, 14, 15, DARK);
  px(g, cx - 6, 104 + bob, 12, 13, jacket);
  px(g, cx - 1, 106 + bob, 2, 8, accent);
  px(g, cx - 6, 116 + bob, 4, 7, rgb(mixRgb([20, 16, 38], palette.a, 0.2)));
  px(g, cx + 2, 116 + bob, 4, 7, rgb(mixRgb([20, 16, 38], palette.a, 0.2)));
  px(g, cx - 7, 121 + bob, 5, 2, INK);
  px(g, cx + 2, 121 + bob, 5, 2, INK);

  const leftY = 104 + bob + (armUp ? -4 : 2);
  const rightY = 104 + bob + (armUp ? 2 : -4);
  px(g, cx - 11, leftY, 3, 9, DARK);
  px(g, cx - 10, leftY + 1, 2, 6, jacket);
  px(g, cx - 11, leftY + 7, 3, 2, SKIN);
  px(g, cx + 8, rightY, 3, 9, DARK);
  px(g, cx + 9, rightY + 1, 2, 6, jacket);
  px(g, cx + 8, rightY + 7, 3, 2, SKIN);

  px(g, headX - 1, headY - 1, 14, 12, DARK);
  px(g, headX, headY, 12, 10, SKIN);
  px(g, headX, headY, 12, 3, hair);
  px(g, headX + 1, headY + 4, 2, 2, DARK);
  px(g, headX + 9, headY + 4, 2, 2, DARK);
  px(g, headX + 4, headY + 7, 4, 1, DARK);
  px(g, headX + 2, headY - 2, 8, 1, DARK);
  px(g, headX - 2, headY + 2, 2, 6, DARK);
  px(g, headX + 12, headY + 2, 2, 6, DARK);
  px(g, headX - 1, headY + 3, 1, 4, accent);
  px(g, headX + 12, headY + 3, 1, 4, accent);
  px(g, headX - 3, headY + 1, 2, 2, DARK);
  px(g, headX + 13, headY + 1, 2, 2, DARK);
}

function drawMushroom(g, x, y, frame, palette) {
  const cap = rgb(mixRgb([255, 90, 90], palette.a, 0.15));
  px(g, x + 1, y + 3, 8, 1, DARK);
  px(g, x, y + 4, 10, 4, cap);
  px(g, x + 2, y + 4, 1, 1, PAPER);
  px(g, x + 6, y + 5, 1, 1, PAPER);
  px(g, x + 4, y + 8, 2, 4, SKIN);
  px(g, x + 3, y + 9 + frame, 1, 1, DARK);
  px(g, x + 6, y + 9 + frame, 1, 1, DARK);
}

function drawSlime(g, x, y, frame, palette) {
  const color = rgb(mixRgb(palette.a, [30, 200, 120], 0.4));
  const h = frame ? 4 : 5;
  px(g, x + 1, y + 6 - h, 8, h, color);
  px(g, x + 2, y + 5 - h, 6, 1, color);
  px(g, x + 2, y + 3, 1, 1, DARK);
  px(g, x + 6, y + 3, 1, 1, DARK);
  px(g, x + 3, y + 1, 1, 1, rgba(PAPER, 0.7));
}

function drawCat(g, x, y, frame, palette) {
  const fur = rgb(mixRgb(palette.b, [255, 176, 58], 0.55));
  px(g, x + 1, y + 4, 8, 4, fur);
  px(g, x + 1, y + 2, 2, 2, fur);
  px(g, x + 7, y + 2, 2, 2, fur);
  px(g, x + 2, y + 5, 1, 1, DARK);
  px(g, x + 7, y + 5, 1, 1, DARK);
  px(g, x + 3, y + 7, 4, 1, DARK);
  px(g, x + 9, y + 3 + frame, 3, 1, fur);
  px(g, x + 11, y + 1 + frame, 1, 2, fur);
}

function drawRobot(g, x, y, frame, palette) {
  const metal = rgb(mixRgb([150, 150, 190], palette.a, 0.2));
  px(g, x + 1, y + 2, 7, 6, DARK);
  px(g, x + 2, y + 3, 5, 4, metal);
  px(g, x + 3, y + 4, 1, 1, rgb(palette.a));
  px(g, x + 6, y + 4, 1, 1, rgb(palette.a));
  px(g, x + 4, y + 8, 2, 3, metal);
  px(g, x + 2, y + 11, 2, 2, metal);
  px(g, x + 5, y + 11, 2, 2, metal);
  px(g, x + 4 + frame, y, 1, 2, rgb(palette.b));
}

function drawCrowd(g, time, energy, palette) {
  const spots = [22, 50, 78, 106, 134, 162, 190, 218, 246, 274, 302];
  for (let index = 0; index < spots.length; index += 1) {
    const frame = Math.floor(time * 3 + index) % 2;
    const bob = Math.round(Math.sin(time * 3.4 + index * 0.9) + energy.bass * 2);
    const x = spots[index];
    const y = 150 + bob;
    px(g, x - 2, 170, 12, 1, rgba(DARK, 0.6));
    switch (index % 4) {
      case 0:
        drawSlime(g, x, y, frame, palette);
        break;
      case 1:
        drawCat(g, x - 1, y - 2, frame, palette);
        break;
      case 2:
        drawRobot(g, x, y - 2, frame, palette);
        break;
      default:
        drawMushroom(g, x - 1, y - 2, frame, palette);
        break;
    }
  }
}

function drawStage(g, time, energy, palette) {
  px(g, 148, 127, 84, 9, DARK);
  px(g, 148, 127, 84, 2, rgb(palette.a));
  px(g, 150, 136, 80, 2, rgba(palette.b, 0.5));

  drawSpeaker(g, 150, 103, energy, palette);
  drawSpeaker(g, 214, 103, energy, palette);

  px(g, 166, 122, 48, 10, DARK);
  px(g, 166, 122, 48, 2, rgb(mixRgb(palette.b, [255, 246, 224], 0.25)));
  px(g, 184, 116, 13, 7, rgb(mixRgb([12, 9, 28], palette.a, 0.22)));
  for (let index = 0; index < 3; index += 1) {
    const lit = index === 0 || (index === 1 && energy.mid > 0.4) || (index === 2 && energy.high > 0.5);
    px(g, 187 + index * 4, 119, 2, 2, lit ? rgb(palette.a) : rgba(palette.a, 0.25));
  }

  drawDisc(g, 176, 115, 8, palette.b, palette.a, time, energy);
  drawDisc(g, 204, 115, 8, palette.a, palette.b, time, energy);
  drawDj(g, time, energy, palette);
}

function drawNotes(g, time, energy, palette) {
  if (Math.random() < engine.energy.high * 0.22) {
    engine.notes.push({
      x: 70 + Math.random() * 180,
      y: 112 + Math.random() * 10,
      vy: -8 - Math.random() * 16,
      life: 1,
      color: Math.random() < 0.5 ? palette.a : palette.b,
      scale: Math.random() < 0.25 ? 2 : 1,
    });
  }
  for (const note of engine.notes) {
    note.y += note.vy * 0.016;
    note.life -= 0.008;
    drawNoteSprite(g, note.x, note.y, rgba(note.color, Math.max(0, note.life) * 0.9), note.scale);
  }
  engine.notes = engine.notes.filter((note) => note.life > 0);

  if (Math.random() < engine.energy.level * 0.08) {
    engine.particles.push({
      x: Math.random() * CANVAS_W,
      y: 100 + Math.random() * 30,
      vy: -5 - Math.random() * 10,
      life: 1,
      color: Math.random() < 0.5 ? palette.a : palette.b,
    });
  }
  for (const particle of engine.particles) {
    particle.y += particle.vy * 0.016;
    particle.life -= 0.012;
    px(g, particle.x, particle.y, 1, 1, rgba(particle.color, Math.max(0, particle.life) * 0.8));
  }
  engine.particles = engine.particles.filter((particle) => particle.life > 0);
}

function draw(time) {
  const g = engine.gfx;
  if (!g) return;
  const palette = engine.palette;
  const energy = engine.energy;

  g.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawSky(g, time, energy, palette);
  drawMoon(g, time, energy, palette);
  drawRidge(g, 120, 18, 38, rgb(mixRgb([10, 8, 26], palette.b, 0.18)), 4411);
  drawRidge(g, 124, 8, 24, rgb(mixRgb([7, 5, 18], palette.a, 0.16)), 9907);
  drawGround(g, time, energy, palette);
  drawStage(g, time, energy, palette);
  drawCrowd(g, time, energy, palette);
  drawNotes(g, time, energy, palette);
}

function frame(timestamp) {
  engine.raf = requestAnimationFrame(frame);
  if (!engine.gfx) {
    ensureCanvas();
    return;
  }
  readEnergy(timestamp / 1000);
  draw(timestamp / 1000);
}

// --------------------------------------------------------------- public api

export function startDj(onTrack, onProgress, onState) {
  engine.onTrack = onTrack;
  engine.onProgress = onProgress;
  engine.onState = onState;

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
  if (engine.timer) clearInterval(engine.timer);
  if (engine.raf) cancelAnimationFrame(engine.raf);
  engine.timer = null;
  engine.raf = null;
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
