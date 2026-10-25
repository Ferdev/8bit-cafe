// 8bit.cafe auto-DJ: generated chiptunes, beatmatched crossfades, and a
// pixel-art VJ that reacts to the analyser in real time.

const TOTAL_STEPS = 16 * 16;
const MIX_TAIL_STEPS = 24;
const LOOKAHEAD = 0.12;
const TICK_MS = 25;
const CANVAS_W = 480;
const CANVAS_H = 270;

const SCALES = [
  [0, 2, 3, 5, 7, 8, 10],
  [0, 2, 4, 5, 7, 9, 11],
  [0, 3, 5, 7, 10],
  [0, 2, 3, 5, 7, 9, 10],
];

const engine = {
  ctx: null,
  mixBus: null,
  master: null,
  analyser: null,
  freqData: null,
  noise: null,
  delaySend: null,
  tracks: [],
  onFinish: null,
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
  energy: { bass: 0, mid: 0, high: 0, level: 0 },
  palette: { a: [58, 232, 255], b: [255, 58, 212] },
  lastNow: 0,
  unlockInstalled: false,
};

// --------------------------------------------------------------- utilities

function nowSeconds() {
  return performance.now() / 1000;
}

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

function rgba(color, alpha) {
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}

function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
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
  master.gain.value = engine.muted ? 0 : 0.55;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.2;

  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.3125;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.28;
  const delaySend = ctx.createGain();
  delaySend.gain.value = 0.35;
  delaySend.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(mixBus);

  mixBus.connect(analyser);
  analyser.connect(compressor);
  compressor.connect(master);
  master.connect(ctx.destination);

  engine.ctx = ctx;
  engine.mixBus = mixBus;
  engine.analyser = analyser;
  engine.freqData = new Uint8Array(analyser.frequencyBinCount);
  engine.master = master;
  engine.delaySend = delaySend;
  engine.noise = makeNoiseBuffer(ctx);
}

function makeNoiseBuffer(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function unlockAudio() {
  if (!engine.ctx) return;
  const ctx = engine.ctx;
  if (ctx.state === "running") {
    removeUnlockListeners();
    emitStatus("live");
    return;
  }
  ctx
    .resume()
    .then(() => {
      if (ctx.state === "running") {
        removeUnlockListeners();
        emitStatus("live");
      } else {
        emitStatus("blocked");
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

// ------------------------------------------------------------------ tracks

function makePattern(seed) {
  const random = mulberry32(seed >>> 0);
  const scale = SCALES[Math.floor(random() * SCALES.length)];
  const root = 55 + Math.floor(random() * 8);
  const lead = [];
  const bass = [];
  for (let step = 0; step < 16; step += 1) {
    lead.push(random() < 0.2 ? -1 : Math.floor(random() * 7));
    bass.push(random() < 0.3 ? -1 : Math.floor(random() * 5));
  }
  const kicks = [0, 8];
  if (random() < 0.55) kicks.push(11);
  if (random() < 0.3) kicks.push(6);
  return { scale, root, lead, bass, kicks, progression: [0, 0, 5, 3] };
}

function beginTrack(trackId, bpm, seed, accent, accentAlt) {
  ensureAudio();
  if (!engine.ctx) return;

  engine.palette = {
    a: hexToRgb(accent),
    b: hexToRgb(accentAlt),
  };

  const safeBpm = clamp(Number(bpm) || 128, 60, 200);
  const stepDuration = 60 / safeBpm / 4;
  const duration = TOTAL_STEPS * stepDuration;

  const bus = engine.ctx.createGain();
  const startAt = engine.ctx.currentTime;
  bus.gain.setValueAtTime(0.0001, startAt);
  bus.gain.exponentialRampToValueAtTime(0.72, startAt + 1.1);
  bus.connect(engine.mixBus);

  const track = {
    id: String(trackId || "track"),
    stepDuration,
    duration,
    mixTime: Math.max(2, duration - MIX_TAIL_STEPS * stepDuration),
    startedAt: nowSeconds(),
    nextTime: 0,
    bus,
    pattern: makePattern(Number(seed) || 1),
    mixed: false,
    removed: false,
  };
  engine.tracks.push(track);

  if (engine.ctx.state !== "running") {
    unlockAudio();
    emitStatus("blocked");
  } else {
    emitStatus("live");
  }
}

function fadeBus(bus, seconds) {
  const ctx = engine.ctx;
  if (!ctx) return;
  const current = Math.max(bus.gain.value, 0.0001);
  bus.gain.cancelScheduledValues(ctx.currentTime);
  bus.gain.setValueAtTime(current, ctx.currentTime);
  bus.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
}

function voice(track, type, frequency, when, duration, volume, attack = 0.008) {
  const ctx = engine.ctx;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(volume, when + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  oscillator.connect(gain);
  gain.connect(track.bus);
  oscillator.start(when);
  oscillator.stop(when + duration + 0.04);
  return gain;
}

function leadVoice(track, frequency, when, duration) {
  const gain = voice(track, "square", frequency, when, duration, 0.075, 0.006);
  gain.connect(engine.delaySend);
}

function padVoice(track, frequency, when, duration) {
  voice(track, "triangle", frequency, when, duration, 0.032, 0.22);
  voice(track, "triangle", frequency * 1.005, when, duration, 0.024, 0.3);
}

function kick(track, when) {
  const ctx = engine.ctx;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(155, when);
  oscillator.frequency.exponentialRampToValueAtTime(42, when + 0.12);
  gain.gain.setValueAtTime(0.85, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
  oscillator.connect(gain);
  gain.connect(track.bus);
  oscillator.start(when);
  oscillator.stop(when + 0.26);
}

function noiseHit(track, when, duration, volume, filterType, frequency) {
  const ctx = engine.ctx;
  const source = ctx.createBufferSource();
  source.buffer = engine.noise;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequency;
  filter.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(track.bus);
  source.start(when, Math.random() * 0.4, duration + 0.02);
}

function scheduleStep(track, step, when) {
  const pattern = track.pattern;
  const bar = Math.floor(step / 16) % 4;
  const position = step % 16;
  const chord = pattern.root + pattern.progression[bar];

  if (position === 0) {
    const third = pattern.scale[2] ?? 3;
    padVoice(track, midiToFreq(chord + 12), when, track.stepDuration * 15);
    padVoice(track, midiToFreq(chord + 12 + third), when, track.stepDuration * 15);
  }

  if (position % 2 === 0 && pattern.bass[position] >= 0) {
    const degree = pattern.scale[pattern.bass[position] % pattern.scale.length];
    voice(
      track,
      "triangle",
      midiToFreq(chord - 12 + degree),
      when,
      track.stepDuration * 1.7,
      0.18,
      0.01,
    );
  }

  if (pattern.lead[position] >= 0) {
    const degree = pattern.scale[pattern.lead[position] % pattern.scale.length];
    leadVoice(track, midiToFreq(chord + 12 + degree), when, track.stepDuration * 1.35);
  }

  if (pattern.kicks.includes(position)) kick(track, when);
  if (position === 4 || position === 12) {
    noiseHit(track, when, 0.13, 0.2, "bandpass", 1900);
  }
  if (position % 2 === 1) {
    noiseHit(track, when, 0.045, position === 15 ? 0.06 : 0.035, "highpass", 7200);
  }
}

function tick() {
  const ctx = engine.ctx;
  if (!ctx) return;
  const current = nowSeconds();
  const running = ctx.state === "running";

  for (const track of engine.tracks) {
    if (track.removed) continue;
    const elapsed = current - track.startedAt;

    if (running) {
      if (track.nextTime < elapsed - 0.08) {
        track.nextTime = Math.ceil(elapsed / track.stepDuration) * track.stepDuration;
      }
      while (
        track.nextTime < elapsed + LOOKAHEAD &&
        track.nextTime < track.duration
      ) {
        const step = Math.round(track.nextTime / track.stepDuration);
        const when = ctx.currentTime + Math.max(0, track.nextTime - elapsed);
        scheduleStep(track, step, when);
        track.nextTime += track.stepDuration;
      }
    } else {
      track.nextTime = Math.ceil(elapsed / track.stepDuration) * track.stepDuration;
    }

    if (!track.mixed && elapsed >= track.mixTime) {
      track.mixed = true;
      fadeBus(track.bus, Math.max(0.4, track.duration - track.mixTime));
      const onFinish = engine.onFinish;
      if (typeof onFinish === "function") {
        setTimeout(() => {
          try {
            onFinish();
          } catch (_error) {
            // Ignore a callback racing with a reload.
          }
        }, 0);
      }
    }

    if (elapsed >= track.duration + 0.3) {
      track.removed = true;
      fadeBus(track.bus, 0.3);
      setTimeout(() => {
        try {
          track.bus.disconnect();
        } catch (_error) {
          // Already disconnected.
        }
      }, 400);
    }
  }

  engine.tracks = engine.tracks.filter((track) => !track.removed);
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

function readEnergy() {
  const target = { bass: 0, mid: 0, high: 0, level: 0 };
  if (engine.analyser && engine.ctx && engine.ctx.state === "running") {
    engine.analyser.getByteFrequencyData(engine.freqData);
    const data = engine.freqData;
    const average = (from, to) => {
      let total = 0;
      for (let i = from; i < to; i += 1) total += data[i];
      return total / ((to - from) * 255);
    };
    target.bass = Math.pow(average(1, 9), 1.25) * 1.7;
    target.mid = Math.pow(average(9, 34), 1.1) * 1.5;
    target.high = Math.pow(average(34, 92), 0.95) * 1.6;
    target.level = average(1, 100);
  } else {
    const time = performance.now() / 1000;
    target.bass = 0.36 + 0.22 * Math.sin(time * 2.4);
    target.mid = 0.3 + 0.18 * Math.sin(time * 3.7 + 1.3);
    target.high = 0.22 + 0.16 * Math.sin(time * 5.1 + 2.1);
    target.level = 0.32 + 0.1 * Math.sin(time * 2);
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
  const random = mulberry32(9871);
  for (let index = 0; index < towers; index += 1) {
    const base = 12 + random() * 26;
    const band = engine.freqData ? engine.freqData[(index % 32) + 2] / 255 : 0.2;
    const height = base + band * 54 + energy.bass * 10;
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
    g.fillRect(Math.round(particle.x), Math.round(particle.y), particle.size, particle.size);
  }
  engine.particles = engine.particles.filter((particle) => particle.life > 0);

  if (engine.analyser && engine.ctx && engine.ctx.state === "running") {
    const data = engine.freqData;
    g.strokeStyle = rgba(mixRgb(palette.a, [255, 255, 255], 0.4), 0.65);
    g.lineWidth = 1.5;
    g.beginPath();
    for (let index = 0; index < 64; index += 1) {
      const value = data[index] / 255;
      const x = (index / 63) * CANVAS_W;
      const y = horizon - 18 - value * 42;
      if (index === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
}

function frame(timestamp) {
  engine.raf = requestAnimationFrame(frame);
  if (!engine.gfx) {
    ensureCanvas();
    return;
  }
  readEnergy();
  draw(timestamp / 1000);
}

// --------------------------------------------------------------- public api

export function startDj(trackId, bpm, seed, accent, accentAlt, onFinish, onStatus) {
  engine.onFinish = onFinish;
  engine.onStatus = onStatus;
  ensureAudio();
  ensureCanvas();
  installUnlockListeners();
  if (!engine.timer) engine.timer = setInterval(tick, TICK_MS);
  if (!engine.raf) engine.raf = requestAnimationFrame(frame);
  beginTrack(trackId, bpm, seed, accent, accentAlt);
  if (engine.ctx && engine.ctx.state === "running") {
    removeUnlockListeners();
    emitStatus("live");
  }
}

export function playTrack(trackId, bpm, seed, accent, accentAlt) {
  if (!engine.ctx) {
    startDj(trackId, bpm, seed, accent, accentAlt, engine.onFinish, engine.onStatus);
    return;
  }
  beginTrack(trackId, bpm, seed, accent, accentAlt);
}

export function setMuted(muted) {
  engine.muted = Boolean(muted);
  if (!engine.ctx || !engine.master) return;
  const ctx = engine.ctx;
  const target = engine.muted ? 0.0001 : 0.55;
  engine.master.gain.cancelScheduledValues(ctx.currentTime);
  engine.master.gain.setValueAtTime(Math.max(engine.master.gain.value, 0.0001), ctx.currentTime);
  engine.master.gain.exponentialRampToValueAtTime(target, ctx.currentTime + 0.18);
}

export function stopDj() {
  if (engine.timer) clearInterval(engine.timer);
  if (engine.raf) cancelAnimationFrame(engine.raf);
  engine.timer = null;
  engine.raf = null;
  for (const track of engine.tracks) {
    try {
      track.bus.disconnect();
    } catch (_error) {
      // Already disconnected.
    }
  }
  engine.tracks = [];
  if (engine.ctx) {
    engine.ctx.close().catch(() => {});
    engine.ctx = null;
  }
}
