// 8bit.cafe streaming auto-DJ: real open-licensed chiptune files, two decks
// with beatmatched crossfades, and a pixel-art VJ driven by the live analyser.

const CROSSFADE_SECONDS = 4;
const FADE_SECONDS = 2.6;
const TICK_MS = 250;
const CANVAS_W = 480;
const CANVAS_H = 270;

const engine = {
  ctx: null,
  mixBus: null,
  master: null,
  analyser: null,
  freqData: null,
  decks: [],
  active: 0,
  crossfading: false,
  playlist: [],
  notified: null,
  errorCount: 0,
  onTrack: null,
  onStatus: null,
  lastStatus: "",
  muted: false,
  timer: null,
  raf: null,
  canvas: null,
  gfx: null,
  canvasWanted: false,
  stars: [],
  particles: [],
  spectrum: Array.from({ length: 32 }, () => 0.2),
  energy: { bass: 0, mid: 0, high: 0, level: 0 },
  signal: 0,
  palette: { a: [58, 232, 255], b: [255, 58, 212] },
  unlockInstalled: false,
};

// --------------------------------------------------------------- utilities

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function rgba(color, alpha) {
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}

// ----------------------------------------------------------------- status

function emitStatus(status) {
  if (engine.lastStatus === status) return;
  engine.lastStatus = status;
  const callback = engine.onStatus;
  if (typeof callback !== "function") return;
  setTimeout(() => {
    try {
      callback(status);
    } catch (_error) {
      // The UI can be torn down while a callback is in flight.
    }
  }, 0);
}

// ------------------------------------------------------------------ audio

function ensureAudio() {
  if (engine.ctx) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    emitStatus("failed");
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

    const deck = { element, gain, index: null, failed: false };
    element.addEventListener("ended", () => {
      if (engine.decks[engine.active] === deck && !engine.crossfading) {
        crossfade();
      }
    });
    element.addEventListener("error", () => {
      if (engine.decks[engine.active] === deck) {
        skipBrokenTrack(index);
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
  deck.failed = false;
  let url = track.audio_url;
  try {
    url = new URL(track.audio_url, window.location.href).href;
  } catch (_error) {
    // Keep the original URL if it cannot be normalised.
  }
  if (deck.element.src !== url) {
    deck.element.src = url;
    deck.element.load();
  }
}

function setPalette(track) {
  if (!track) return;
  engine.palette = {
    a: hexToRgb(track.accent),
    b: hexToRgb(track.accent_alt),
  };
}

function notifyTrack(index) {
  if (engine.notified === index) return;
  engine.notified = index;
  const callback = engine.onTrack;
  if (typeof callback !== "function") return;
  setTimeout(() => {
    try {
      callback(index);
    } catch (_error) {
      // Ignore a callback racing with a reload.
    }
  }, 0);
}

function playDeck(deckIndex) {
  const deck = engine.decks[deckIndex];
  if (!deck) return Promise.resolve();
  const result = deck.element.play();
  return result && typeof result.then === "function" ? result : Promise.resolve();
}

function refreshStatus() {
  if (!engine.ctx) return;
  if (engine.ctx.state === "running") {
    removeUnlockListeners();
    emitStatus("live");
  } else {
    emitStatus("blocked");
  }
}

function startPlayback() {
  const deck = engine.decks[engine.active];
  if (!deck) return;
  playDeck(engine.active)
    .then(() => {
      refreshStatus();
    })
    .catch((error) => {
      if (error && (error.name === "NotAllowedError" || error.name === "AbortError")) {
        emitStatus("blocked");
      } else {
        skipBrokenTrack(engine.active);
      }
    });
  if (engine.ctx && engine.ctx.state !== "running") {
    engine.ctx.resume().then(refreshStatus).catch(() => emitStatus("blocked"));
  }
}

function fadeIn(deck) {
  const now = engine.ctx.currentTime;
  deck.gain.gain.cancelScheduledValues(now);
  deck.gain.gain.setValueAtTime(0.0001, now);
  deck.gain.gain.exponentialRampToValueAtTime(1, now + FADE_SECONDS);
}

function fadeOut(deck) {
  const now = engine.ctx.currentTime;
  deck.gain.gain.cancelScheduledValues(now);
  const current = Math.max(deck.gain.gain.value, 0.0001);
  deck.gain.gain.setValueAtTime(current, now);
  deck.gain.gain.exponentialRampToValueAtTime(0.0001, now + FADE_SECONDS);
}

function crossfade() {
  if (engine.crossfading || engine.playlist.length === 0) return;
  const oldDeckIndex = engine.active;
  const oldDeck = engine.decks[oldDeckIndex];
  const newDeckIndex = 1 - oldDeckIndex;
  const newDeck = engine.decks[newDeckIndex];
  if (!oldDeck || !newDeck) return;

  const currentTrack = oldDeck.index ?? 0;
  const nextTrack = (currentTrack + 1) % engine.playlist.length;

  engine.crossfading = true;
  if (newDeck.index !== nextTrack) loadDeck(newDeckIndex, nextTrack);
  newDeck.gain.gain.cancelScheduledValues(engine.ctx.currentTime);
  newDeck.gain.gain.setValueAtTime(0.0001, engine.ctx.currentTime);

  playDeck(newDeckIndex)
    .then(() => {
      const now = engine.ctx.currentTime;
      newDeck.gain.gain.exponentialRampToValueAtTime(1, now + FADE_SECONDS);
      const currentGain = Math.max(oldDeck.gain.gain.value, 0.0001);
      oldDeck.gain.gain.cancelScheduledValues(now);
      oldDeck.gain.gain.setValueAtTime(currentGain, now);
      oldDeck.gain.gain.exponentialRampToValueAtTime(0.0001, now + FADE_SECONDS);

      engine.active = newDeckIndex;
      engine.crossfading = false;
      engine.errorCount = 0;
      setPalette(engine.playlist[nextTrack]);
      notifyTrack(nextTrack);
      refreshStatus();

      setTimeout(() => {
        if (engine.active === oldDeckIndex) return;
        oldDeck.element.pause();
        oldDeck.element.currentTime = 0;
        loadDeck(oldDeckIndex, (nextTrack + 1) % engine.playlist.length);
      }, (FADE_SECONDS + 0.4) * 1000);
    })
    .catch((error) => {
      engine.crossfading = false;
      if (error && (error.name === "NotAllowedError" || error.name === "AbortError")) {
        emitStatus("blocked");
      } else {
        skipBrokenTrack(oldDeckIndex);
      }
    });
}

function skipBrokenTrack(deckIndex) {
  if (engine.playlist.length === 0) return;
  const deck = engine.decks[deckIndex];
  if (!deck || deckIndex !== engine.active) return;
  engine.errorCount += 1;
  if (engine.errorCount > engine.playlist.length) {
    emitStatus("failed");
    return;
  }
  const nextTrack = ((deck.index ?? 0) + 1) % engine.playlist.length;
  loadDeck(deckIndex, nextTrack);
  deck.gain.gain.value = 1;
  playDeck(deckIndex)
    .then(() => {
      setPalette(engine.playlist[nextTrack]);
      notifyTrack(nextTrack);
      refreshStatus();
    })
    .catch(() => emitStatus("blocked"));
}

function tick() {
  if (!engine.ctx || engine.crossfading) return;
  const deck = engine.decks[engine.active];
  if (!deck) return;
  const element = deck.element;
  if (element.error) {
    skipBrokenTrack(engine.active);
    return;
  }
  const duration = element.duration;
  if (!Number.isFinite(duration) || duration <= 0) return;
  const remaining = duration - element.currentTime;
  if (remaining <= CROSSFADE_SECONDS && remaining > 0) {
    crossfade();
  }
}

// ------------------------------------------------------------------ unlock

function unlockAudio() {
  if (!engine.ctx) return;
  engine.ctx
    .resume()
    .then(() => {
      if (engine.ctx.state !== "running") {
        emitStatus("blocked");
        return;
      }
      removeUnlockListeners();
      emitStatus("live");
      const deck = engine.decks[engine.active];
      if (deck && deck.element.paused) {
        playDeck(engine.active).catch(() => {});
      }
    })
    .catch(() => emitStatus("blocked"));
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
  engine.gfx = canvas.getContext("2d");
  engine.stars = Array.from({ length: 70 }, () => ({
    x: Math.floor(Math.random() * CANVAS_W),
    y: Math.floor(Math.random() * CANVAS_H * 0.62),
    size: Math.random() < 0.82 ? 1 : 2,
    phase: Math.random() * Math.PI * 2,
  }));
  return true;
}

function readEnergy(time) {
  const target = { bass: 0, mid: 0, high: 0, level: 0 };
  const hasAudio =
    engine.analyser && engine.ctx && engine.ctx.state === "running";
  let signalSum = 0;

  if (hasAudio) {
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
    for (let index = 0; index < 32; index += 1) {
      const bin = index + 2;
      engine.spectrum[index] += ((data[bin] || 0) / 255 - engine.spectrum[index]) * 0.3;
    }
  }

  const live = signalSum > 120;
  if (live) {
    engine.signal = 1;
  } else {
    engine.signal = Math.max(0, engine.signal - 0.03);
    target.bass = 0.34 + 0.24 * Math.sin(time * 2.2);
    target.mid = 0.28 + 0.2 * Math.sin(time * 3.4 + 1.2);
    target.high = 0.2 + 0.16 * Math.sin(time * 4.8 + 2.1);
    target.level = 0.3 + 0.1 * Math.sin(time * 1.8);
    for (let index = 0; index < 32; index += 1) {
      const wave = Math.abs(
        Math.sin(time * (1.1 + index * 0.09) + index * 0.7),
      );
      engine.spectrum[index] += (0.12 + wave * 0.26 - engine.spectrum[index]) * 0.15;
    }
  }

  for (const key of Object.keys(target)) {
    engine.energy[key] += (clamp(target[key], 0, 1) - engine.energy[key]) * 0.22;
  }
}

function draw(time) {
  const g = engine.gfx;
  if (!g) return;
  const palette = engine.palette;
  const energy = engine.energy;
  const horizon = CANVAS_H * 0.64;

  g.clearRect(0, 0, CANVAS_W, CANVAS_H);

  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, rgba(mixRgb([8, 6, 20], palette.a, 0.18), 1));
  sky.addColorStop(0.55, rgba(mixRgb([12, 8, 28], palette.b, 0.22), 1));
  sky.addColorStop(1, rgba(mixRgb([30, 12, 50], palette.a, 0.45), 1));
  g.fillStyle = sky;
  g.fillRect(0, 0, CANVAS_W, horizon);

  for (const star of engine.stars) {
    const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 2 + star.phase));
    g.fillStyle = rgba(mixRgb([230, 228, 255], palette.a, 0.4), twinkle);
    g.fillRect(star.x, star.y, star.size, star.size);
  }

  const sunX = CANVAS_W * 0.73;
  const sunY = horizon - 48;
  const sunRadius = 30 + energy.bass * 20;
  const sun = g.createRadialGradient(sunX, sunY, 4, sunX, sunY, sunRadius);
  sun.addColorStop(0, rgba(mixRgb([255, 240, 190], palette.a, 0.3), 0.98));
  sun.addColorStop(0.65, rgba(palette.b, 0.92));
  sun.addColorStop(1, rgba(palette.a, 0.1));
  g.fillStyle = sun;
  g.beginPath();
  g.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = rgba([12, 8, 28], 0.82);
  for (let band = 0; band < 6; band += 1) {
    const bandY = sunY + 2 + band * 6;
    g.fillRect(sunX - sunRadius, bandY, sunRadius * 2, 2 + (band > 3 ? 1 : 0));
  }

  g.fillStyle = rgba(mixRgb([6, 4, 16], palette.b, 0.18), 1);
  g.fillRect(0, horizon, CANVAS_W, CANVAS_H - horizon);

  const towers = 30;
  const towerWidth = CANVAS_W / towers;
  for (let index = 0; index < towers; index += 1) {
    const base = 12 + ((index * 37) % 23);
    const band = engine.spectrum[index % 32];
    const height = base + band * 58 + energy.bass * 10;
    const x = index * towerWidth;
    g.fillStyle = rgba(mixRgb([20, 10, 40], palette.a, 0.35), 0.92);
    g.fillRect(x + 1, horizon - height, towerWidth - 2, height);
    g.fillStyle = rgba(palette.a, 0.55 + band * 0.4);
    g.fillRect(x + 1, horizon - height, towerWidth - 2, 2);
    if (index % 2 === 0) {
      g.fillStyle = rgba(palette.b, 0.35 + band * 0.5);
      g.fillRect(x + 4, horizon - height + 6, 2, 2);
      g.fillRect(x + towerWidth - 7, horizon - height + 12 + band * 12, 2, 2);
    }
  }

  g.strokeStyle = rgba(palette.a, 0.35);
  g.lineWidth = 1;
  const gridBottom = CANVAS_H;
  for (let index = -8; index <= 8; index += 1) {
    g.beginPath();
    g.moveTo(CANVAS_W / 2 + index * 9, horizon);
    g.lineTo(CANVAS_W / 2 + index * 58, gridBottom);
    g.stroke();
  }
  const scroll = (time * 0.35) % 1;
  for (let line = 0; line < 7; line += 1) {
    const depth = (line + scroll) / 7;
    const y = horizon + Math.pow(depth, 2.1) * (gridBottom - horizon);
    g.strokeStyle = rgba(palette.b, 0.14 + depth * 0.4);
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(CANVAS_W, y);
    g.stroke();
  }

  if (Math.random() < engine.energy.high * 0.5) {
    engine.particles.push({
      x: CANVAS_W * (0.12 + Math.random() * 0.76),
      y: horizon - 8 - Math.random() * 40,
      vy: -12 - Math.random() * 22,
      life: 1,
      size: Math.random() < 0.5 ? 2 : 3,
      color: Math.random() < 0.5 ? palette.a : palette.b,
    });
  }
  for (const particle of engine.particles) {
    particle.y += particle.vy * 0.016;
    particle.life -= 0.012;
    g.fillStyle = rgba(particle.color, Math.max(0, particle.life) * 0.85);
    g.fillRect(
      Math.round(particle.x),
      Math.round(particle.y),
      particle.size,
      particle.size,
    );
  }
  engine.particles = engine.particles.filter((particle) => particle.life > 0);

  g.strokeStyle = rgba(mixRgb(palette.a, [255, 255, 255], 0.4), 0.65);
  g.lineWidth = 1.5;
  g.beginPath();
  if (engine.signal > 0.5) {
    for (let index = 0; index < 64; index += 1) {
      const value = engine.freqData[index] / 255;
      const x = (index / 63) * CANVAS_W;
      const y = horizon - 18 - value * 42;
      if (index === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
  } else {
    for (let index = 0; index < 64; index += 1) {
      const x = (index / 63) * CANVAS_W;
      const y =
        horizon - 30 - Math.sin(time * 2.4 + index * 0.32) * 12 - engine.energy.mid * 10;
      if (index === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
  }
  g.stroke();
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

export function startDj(playlistJson, onTrack, onStatus) {
  engine.onTrack = onTrack;
  engine.onStatus = onStatus;
  try {
    engine.playlist = JSON.parse(playlistJson);
  } catch (_error) {
    engine.playlist = [];
    emitStatus("failed");
    return;
  }
  if (!Array.isArray(engine.playlist) || engine.playlist.length === 0) {
    emitStatus("failed");
    return;
  }

  ensureAudio();
  if (!engine.ctx) return;
  ensureDecks();
  ensureCanvas();
  installUnlockListeners();

  if (!engine.timer) engine.timer = setInterval(tick, TICK_MS);
  if (!engine.raf) engine.raf = requestAnimationFrame(frame);

  engine.active = 0;
  engine.crossfading = false;
  engine.notified = 0;
  engine.errorCount = 0;
  setPalette(engine.playlist[0]);
  loadDeck(0, 0);
  loadDeck(1, 1 % engine.playlist.length);
  engine.decks[0].gain.gain.value = 1;
  engine.decks[1].gain.gain.value = 0.0001;
  startPlayback();
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
