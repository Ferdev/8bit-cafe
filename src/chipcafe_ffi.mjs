import { choice, TypeSafeClient } from "@typesafe-ai/sdk";

const favoriteKey = "8bit-cafe.favorite-room";
const STARTUP_BUFFER_SECONDS = 12;
const REFILL_LOW_WATER_SECONDS = 12;
const REQUEST_TIMEOUT_MS = 6000;
const BARS_PER_BLOCK = 16;
const BEATS_PER_BAR = 4;
const VISUAL_STYLES = Object.freeze(["grid", "waves", "particles", "orbit", "bars", "pixels"]);

const PRESETS = Object.freeze({
  cvgm: preset("Neon drive", 132, 48, [0, 2, 3, 5, 7, 8, 10], [0, 5, 3, 4], 0.82, "square"),
  rainwave: preset("Coastal wave", 104, 48, [0, 2, 4, 7, 9], [0, 3, 4, 3], 0.48, "triangle"),
  nectarine: preset("Forest quest", 116, 50, [0, 2, 3, 5, 7, 9, 10], [0, 3, 5, 4], 0.58, "square"),
  slay: preset("Boss mode", 148, 45, [0, 2, 3, 5, 7, 8, 11], [0, 5, 3, 6], 0.92, "sawtooth"),
  kaaos: preset("Pocket pulse", 124, 47, [0, 2, 4, 5, 7, 9, 11], [0, 4, 5, 3], 0.72, "square"),
  kohina: preset("Orbital chip", 88, 43, [0, 2, 3, 5, 7, 8, 10], [0, 5, 2, 4], 0.35, "triangle"),
  "keygen-fm": preset("Cracktro lab", 154, 46, [0, 2, 3, 5, 7, 9, 10], [0, 6, 3, 4], 0.96, "square"),
  "sid-station": preset("SID ritual", 112, 45, [0, 2, 3, 5, 7, 8, 10], [0, 3, 5, 4], 0.68, "sawtooth"),
  rpgn: preset("Adventure loop", 108, 48, [0, 2, 4, 5, 7, 9, 11], [0, 4, 5, 3], 0.55, "triangle"),
  radiosega: preset("Turbo drive", 164, 47, [0, 2, 4, 5, 7, 9, 10], [0, 5, 3, 4], 1, "square"),
  "gtt-radio": preset("Party mode", 128, 48, [0, 2, 4, 5, 7, 9, 10], [0, 3, 5, 4], 0.78, "square"),
  ericade: preset("Tracker stage", 138, 46, [0, 2, 3, 5, 7, 9, 10], [0, 5, 3, 6], 0.86, "sawtooth"),
});

const VISUAL_PRESETS = Object.freeze({
  cvgm: visualPreset("neon skyline", ["#5dfdff", "#ff4fd8", "#6b5cff"], ["grid", "bars", "particles"]),
  rainwave: visualPreset("sunset tide", ["#ffcc66", "#ff6b8a", "#58d7ff"], ["waves", "particles", "orbit"]),
  nectarine: visualPreset("firefly grove", ["#a8ff60", "#ffe66d", "#43d17d"], ["particles", "waves", "pixels"]),
  slay: visualPreset("castle forge", ["#c084fc", "#ff5c5c", "#ffd166"], ["bars", "grid", "particles"]),
  kaaos: visualPreset("handheld matrix", ["#9bbc0f", "#8bac0f", "#306230"], ["pixels", "grid", "bars"]),
  kohina: visualPreset("deep orbit", ["#c55cff", "#5d7cff", "#ffffff"], ["orbit", "particles", "waves"]),
  "keygen-fm": visualPreset("code tunnel", ["#63ff9b", "#5dfdff", "#ff4fd8"], ["grid", "pixels", "bars"]),
  "sid-station": visualPreset("sid chamber", ["#ff9f43", "#c084fc", "#5dfdff"], ["orbit", "bars", "waves"]),
  rpgn: visualPreset("overworld map", ["#8dff78", "#ffd166", "#5da9ff"], ["pixels", "particles", "waves"]),
  radiosega: visualPreset("turbo circuit", ["#ff4f6d", "#5dfdff", "#ffe66d"], ["grid", "bars", "orbit"]),
  "gtt-radio": visualPreset("quiz party", ["#ff77d9", "#72f1b8", "#ffe66d"], ["particles", "bars", "pixels"]),
  ericade: visualPreset("demo plasma", ["#8f7cff", "#ff4fd8", "#5dfdff"], ["waves", "orbit", "grid"]),
});

function preset(name, tempo, root, scale, progression, energy, leadWave) {
  return Object.freeze({ name, tempo, root, scale, progression, energy, leadWave });
}

function visualPreset(name, palette, styles) {
  return Object.freeze({ name, palette: Object.freeze(palette), styles: Object.freeze(styles) });
}

let audioContext = null;
let masterGain = null;
let activeSession = null;
let sessionSequence = 0;
let cachedClient = null;
let cachedClientKey = "";
let noiseBuffer = null;

export function loadFavorite() {
  try {
    return window.localStorage.getItem(favoriteKey) || "";
  } catch (_error) {
    return "";
  }
}

export function saveFavorite(roomId) {
  try {
    window.localStorage.setItem(favoriteKey, roomId);
  } catch (_error) {
    // Listening still works when storage is blocked or unavailable.
  }
}

export function clearFavorite() {
  try {
    window.localStorage.removeItem(favoriteKey);
  } catch (_error) {
    // Listening still works when storage is blocked or unavailable.
  }
}

export function trackEvent(name, roomId) {
  if (typeof window.umami?.track !== "function") return;

  const data = roomId ? { room: roomId } : undefined;
  window.umami.track(name, data);
}

export function startPlayer(roomId, onStatus) {
  const roomPreset = PRESETS[roomId];
  if (!roomPreset) {
    onStatus("failed");
    return;
  }

  stopActiveSession(false);

  let context;
  try {
    context = ensureAudioContext();
  } catch (_error) {
    onStatus("failed");
    return;
  }

  const session = {
    id: ++sessionSequence,
    roomId,
    preset: roomPreset,
    onStatus,
    controller: new AbortController(),
    sources: new Set(),
    timeouts: new Set(),
    interval: null,
    nextStartTime: 0,
    blockIndex: 0,
    previousSummary: "Opening block",
    requestInFlight: false,
    apiCalls: 0,
    provenance: "local",
    visualProgram: generateVisualProgram(roomId, roomPreset, 0, 0),
    visualStartTime: context.currentTime,
    visualTempo: roomPreset.tempo,
    visualFrame: null,
    visualFrames: 0,
    reduceMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  };
  activeSession = session;
  startVisualRenderer(session);
  emitStatus(session, "starting-audio");

  // This call is entered synchronously from the user's click. AudioContext is
  // created above before the first await, satisfying browser autoplay policies.
  void context.resume().then(
    () => beginSession(session),
    () => failSession(session),
  );
}

export function pausePlayer() {
  if (!activeSession) return;
  const callback = activeSession.onStatus;
  stopActiveSession(true);
  callback("paused");
}

export function stopPlayer() {
  stopActiveSession(true);
}

async function beginSession(session) {
  if (!isActive(session)) return;
  emitStatus(session, "composing");

  try {
    const result = await composeNextBlock(session);
    if (!isActive(session)) return;
    emitStatus(session, "buffering");
    const timing = scheduleBlock(session, result.block);
    session.provenance = result.provenance;
    scheduleVisualProgram(session, timing.startTime, result.block);
    scheduleStatus(session, timing.startTime, result.provenance);
    session.interval = window.setInterval(() => {
      void refillIfNeeded(session).catch(() => failSession(session));
    }, 750);
  } catch (_error) {
    failSession(session);
  }
}

async function refillIfNeeded(session) {
  if (!isActive(session) || session.requestInFlight) return;
  const queued = queuedSeconds(session);
  if (queued >= REFILL_LOW_WATER_SECONDS) return;

  if (queued < 3) emitStatus(session, "recovering");
  const result = await composeNextBlock(session);
  if (!isActive(session)) return;
  const timing = scheduleBlock(session, result.block);
  scheduleVisualProgram(session, timing.startTime, result.block);
  scheduleStatus(session, timing.startTime, result.provenance);
}

async function composeNextBlock(session) {
  session.requestInFlight = true;
  const index = session.blockIndex;
  const candidates = buildCandidates(
    session.roomId,
    index,
    session.previousSummary,
  );

  let selected = selectLocalCandidate(candidates, session.roomId, index);
  let provenance = "local";
  try {
    const chosenId = await chooseWithJev(session, candidates);
    const chosen = candidates.find((candidate) => candidate.id === chosenId);
    if (chosen) {
      selected = chosen;
      provenance = "jev";
    }
  } catch (_error) {
    // The local choice is already valid and keeps the audio queue moving.
  } finally {
    session.requestInFlight = false;
  }

  session.blockIndex += 1;
  session.previousSummary = selected.summary;
  return { block: selected, provenance };
}

async function chooseWithJev(session, candidates) {
  const config = browserConfig();
  const testProvider = globalThis.__chipcafeJevDecide;
  const criteria = Object.fromEntries(
    candidates.map((candidate) => [candidate.id, candidate.summary]),
  );
  const state = {
    role: "You are directing an original generative chiptune and procedural animation stage.",
    room: session.preset.name,
    tempo: session.preset.tempo,
    energy: session.preset.energy,
    previous_block: session.previousSummary,
    goal: "Choose the most coherent, interesting music-and-animation continuation without repetitive sound or motion.",
  };

  session.apiCalls += 1;
  if (typeof testProvider === "function") {
    return withDeadline(
      Promise.resolve(testProvider({ state, criteria, roomId: session.roomId })),
      session,
    );
  }

  if (!config.typesafeApiKey) throw new Error("Jev is not configured");
  const client = typesafeClient(config);
  const questions = {
    continuation: choice(
      "Which candidate is the strongest combined musical and visual continuation for this stage?",
      criteria,
    ),
  };
  const response = await client.systemOne(
    {
      model: config.typesafeModel || "jev-latest",
      state,
      questions,
    },
    {
      signal: session.controller.signal,
      timeout: REQUEST_TIMEOUT_MS,
      retry: { maxRetries: 0 },
    },
  );
  return response.answers.continuation.choice;
}

function typesafeClient(config) {
  const cacheKey = `${config.typesafeApiKey}:${config.typesafeModel || "jev-latest"}`;
  if (cachedClient && cachedClientKey === cacheKey) return cachedClient;
  cachedClient = new TypeSafeClient({
    apiKey: config.typesafeApiKey,
    baseURL: `${window.location.origin}/typesafe`,
    defaultModel: config.typesafeModel || "jev-latest",
    dangerouslyAllowBrowser: true,
    timeout: REQUEST_TIMEOUT_MS,
    retry: { maxRetries: 0 },
    logLevel: "off",
  });
  cachedClientKey = cacheKey;
  return cachedClient;
}

function withDeadline(promise, session) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Jev request timed out")), REQUEST_TIMEOUT_MS);
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    session.controller.signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => {
      window.clearTimeout(timer);
      session.controller.signal.removeEventListener("abort", abort);
    });
  });
}

function browserConfig() {
  if (typeof window === "undefined") return {};
  return window.CHIPCAFE_CONFIG || {};
}

function ensureAudioContext() {
  if (audioContext && audioContext.state !== "closed") return audioContext;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("Web Audio is unavailable");
  audioContext = new AudioContextClass({ latencyHint: "playback" });
  noiseBuffer = null;

  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 16;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.2;

  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.19;
  masterGain.connect(compressor);
  compressor.connect(audioContext.destination);
  return audioContext;
}

function stopActiveSession(suspendContext) {
  const session = activeSession;
  if (!session) return;
  activeSession = null;
  sessionSequence += 1;
  session.controller.abort();
  if (session.interval !== null) window.clearInterval(session.interval);
  if (session.visualFrame !== null) window.cancelAnimationFrame(session.visualFrame);
  for (const timeout of session.timeouts) window.clearTimeout(timeout);
  for (const source of session.sources) {
    try {
      source.stop();
    } catch (_error) {
      // The source may already have ended.
    }
  }
  session.sources.clear();
  if (suspendContext && audioContext?.state === "running") {
    void audioContext.suspend();
  }
}

function isActive(session) {
  return activeSession === session && !session.controller.signal.aborted;
}

function emitStatus(session, status) {
  if (!isActive(session)) return;
  session.onStatus(status);
}

function failSession(session) {
  if (!isActive(session)) return;
  const callback = session.onStatus;
  stopActiveSession(true);
  callback("failed");
}

function scheduleStatus(session, startTime, provenance) {
  const delay = Math.max(0, (startTime - audioContext.currentTime) * 1000);
  const timeout = window.setTimeout(() => {
    session.timeouts.delete(timeout);
    if (!isActive(session)) return;
    session.provenance = provenance;
    emitStatus(session, provenance === "jev" ? "playing-jev" : "playing-local");
  }, delay);
  session.timeouts.add(timeout);
}

function scheduleVisualProgram(session, startTime, block) {
  const delay = Math.max(0, (startTime - audioContext.currentTime) * 1000);
  const timeout = window.setTimeout(() => {
    session.timeouts.delete(timeout);
    if (!isActive(session)) return;
    session.visualProgram = block.visual;
    session.visualStartTime = startTime;
    session.visualTempo = block.tempo;
    if (session.reduceMotion) drawVisualFrame(session);
  }, delay);
  session.timeouts.add(timeout);
}

function startVisualRenderer(session) {
  drawVisualFrame(session);
  if (session.reduceMotion) return;

  const render = () => {
    if (!isActive(session)) return;
    drawVisualFrame(session);
    session.visualFrame = window.requestAnimationFrame(render);
  };
  session.visualFrame = window.requestAnimationFrame(render);
}

function drawVisualFrame(session) {
  const canvas = document.querySelector("canvas.room-visual");
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  const width = Math.max(1, Math.round(canvas.clientWidth));
  const height = Math.max(1, Math.round(canvas.clientHeight));
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  const backingWidth = Math.round(width * pixelRatio);
  const backingHeight = Math.round(height * pixelRatio);
  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  const program = session.visualProgram;
  const elapsed = Math.max(0, (audioContext?.currentTime || 0) - session.visualStartTime);
  const beat = elapsed * session.visualTempo / 60;
  const pulse = 0.82 + Math.max(0, Math.sin(beat * Math.PI * 2)) * 0.18 * program.pulse;
  context.globalAlpha = pulse;
  context.lineWidth = 2;

  switch (program.style) {
    case "grid": drawGrid(context, width, height, elapsed, program); break;
    case "waves": drawWaves(context, width, height, elapsed, program); break;
    case "particles": drawParticles(context, width, height, elapsed, program); break;
    case "orbit": drawOrbit(context, width, height, elapsed, program); break;
    case "bars": drawBars(context, width, height, beat, program); break;
    case "pixels": drawPixels(context, width, height, elapsed, program); break;
  }
  context.globalAlpha = 1;
  session.visualFrames += 1;
}

function drawGrid(context, width, height, time, program) {
  const horizon = height * 0.43;
  context.strokeStyle = program.palette[0];
  for (let index = -8; index <= 8; index += 1) {
    const bottomX = width / 2 + index * width / 8;
    context.beginPath();
    context.moveTo(width / 2, horizon);
    context.lineTo(bottomX, height);
    context.stroke();
  }
  const offset = (time * program.speed * 0.35) % 1;
  for (let index = 0; index < 12; index += 1) {
    const depth = (index + offset) / 12;
    const y = horizon + depth * depth * (height - horizon);
    context.strokeStyle = program.palette[index % program.palette.length];
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function drawWaves(context, width, height, time, program) {
  const waveCount = Math.max(3, Math.round(program.density / 8));
  for (let wave = 0; wave < waveCount; wave += 1) {
    context.strokeStyle = program.palette[wave % program.palette.length];
    context.beginPath();
    for (let x = 0; x <= width; x += 8) {
      const y = height * (wave + 1) / (waveCount + 1)
        + Math.sin(x * 0.018 + time * program.speed * 2 + wave) * height * 0.045;
      if (x === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
}

function drawParticles(context, width, height, time, program) {
  for (let index = 0; index < program.density; index += 1) {
    const baseX = visualUnit(program.seed, index, 1);
    const baseY = visualUnit(program.seed, index, 2);
    const drift = visualUnit(program.seed, index, 3) * 0.6 + 0.4;
    const x = (baseX * width + time * program.speed * drift * 24) % width;
    const y = (baseY * height + Math.sin(time * drift + index) * 18 + height) % height;
    const size = 2 + Math.floor(visualUnit(program.seed, index, 4) * 5);
    context.fillStyle = program.palette[index % program.palette.length];
    context.fillRect(Math.round(x), Math.round(y), size, size);
  }
}

function drawOrbit(context, width, height, time, program) {
  const centerX = width / 2;
  const centerY = height / 2;
  const rings = Math.max(3, Math.round(program.density / 10));
  for (let index = 0; index < rings; index += 1) {
    const radius = Math.min(width, height) * (0.12 + index * 0.075);
    context.strokeStyle = program.palette[index % program.palette.length];
    context.beginPath();
    context.ellipse(centerX, centerY, radius, radius * 0.48, index * 0.18, 0, Math.PI * 2);
    context.stroke();
    const angle = time * program.speed * (0.45 + index * 0.08) + index * 1.7;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius * 0.48;
    context.fillStyle = program.palette[(index + 1) % program.palette.length];
    context.fillRect(Math.round(x - 3), Math.round(y - 3), 6, 6);
  }
}

function drawBars(context, width, height, beat, program) {
  const count = Math.max(10, Math.round(program.density / 2));
  const barWidth = width / count;
  for (let index = 0; index < count; index += 1) {
    const phase = beat * program.speed + visualUnit(program.seed, index, 5) * Math.PI * 2;
    const barHeight = height * (0.08 + Math.abs(Math.sin(phase)) * 0.34);
    context.fillStyle = program.palette[index % program.palette.length];
    context.fillRect(
      Math.round(index * barWidth + 2),
      Math.round(height - barHeight),
      Math.max(2, Math.floor(barWidth - 4)),
      Math.round(barHeight),
    );
  }
}

function drawPixels(context, width, height, time, program) {
  const size = Math.max(18, Math.round(Math.min(width, height) / 16));
  const columns = Math.ceil(width / size);
  const rows = Math.ceil(height / size);
  const phase = Math.floor(time * program.speed * 4);
  for (let index = 0; index < program.density; index += 1) {
    const cell = Math.floor(visualUnit(program.seed + phase, index, 6) * columns * rows);
    const x = cell % columns;
    const y = Math.floor(cell / columns);
    context.fillStyle = program.palette[(index + phase) % program.palette.length];
    context.globalAlpha = 0.22 + visualUnit(program.seed, index, 7) * 0.5;
    context.fillRect(x * size, y * size, size - 2, size - 2);
  }
}

function visualUnit(seed, index, salt) {
  let value = seed ^ Math.imul(index + 1, 0x45d9f3b) ^ Math.imul(salt, 0x27d4eb2d);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function queuedSeconds(session) {
  if (!audioContext) return 0;
  return Math.max(0, session.nextStartTime - audioContext.currentTime);
}

function scheduleBlock(session, block) {
  if (!validateCandidate(block)) throw new Error("Invalid musical block");
  const startTime = Math.max(audioContext.currentTime + 0.12, session.nextStartTime);
  const secondsPerBeat = 60 / block.tempo;
  for (const event of block.events) {
    const when = startTime + event.beat * secondsPerBeat;
    const duration = Math.max(0.025, event.duration * secondsPerBeat);
    scheduleEvent(session, event, when, duration, block);
  }
  const duration = block.totalBeats * secondsPerBeat;
  session.nextStartTime = startTime + duration;
  return { startTime, duration };
}

function scheduleEvent(session, event, when, duration, block) {
  switch (event.instrument) {
    case "kick":
      scheduleKick(session, when, event.velocity);
      break;
    case "snare":
    case "hat":
      scheduleNoise(session, when, duration, event.velocity, event.instrument);
      break;
    default:
      scheduleTone(session, when, duration, event, block);
  }
}

function scheduleTone(session, when, duration, event, block) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const peak = Math.max(0.006, event.velocity * (event.instrument === "bass" ? 0.11 : 0.075));
  oscillator.type = event.instrument === "bass" ? "triangle" : block.leadWave;
  oscillator.frequency.value = midiToFrequency(event.pitch);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + 0.008);
  gain.gain.setValueAtTime(peak, Math.max(when + 0.01, when + duration - 0.035));
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  oscillator.connect(gain);
  gain.connect(masterGain);
  trackSource(session, oscillator);
  oscillator.start(when);
  oscillator.stop(when + duration + 0.01);
}

function scheduleKick(session, when, velocity) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(145, when);
  oscillator.frequency.exponentialRampToValueAtTime(46, when + 0.12);
  gain.gain.setValueAtTime(Math.max(0.01, velocity * 0.32), when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
  oscillator.connect(gain);
  gain.connect(masterGain);
  trackSource(session, oscillator);
  oscillator.start(when);
  oscillator.stop(when + 0.17);
}

function scheduleNoise(session, when, duration, velocity, instrument) {
  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  source.buffer = getNoiseBuffer();
  filter.type = "highpass";
  filter.frequency.value = instrument === "hat" ? 6500 : 1800;
  const length = instrument === "hat" ? Math.min(duration, 0.045) : Math.min(duration, 0.13);
  gain.gain.setValueAtTime(Math.max(0.005, velocity * (instrument === "hat" ? 0.055 : 0.12)), when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  trackSource(session, source);
  source.start(when, 0, length);
}

function getNoiseBuffer() {
  if (noiseBuffer) return noiseBuffer;
  const length = Math.floor(audioContext.sampleRate * 0.25);
  noiseBuffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  let seed = 0x8b17cafe;
  for (let index = 0; index < length; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[index] = (seed / 0xffffffff) * 2 - 1;
  }
  return noiseBuffer;
}

function trackSource(session, source) {
  session.sources.add(source);
  source.onended = () => session.sources.delete(source);
}

function midiToFrequency(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

export function buildCandidates(roomId, blockIndex, previousSummary = "") {
  const roomPreset = PRESETS[roomId];
  if (!roomPreset) return [];
  return Array.from({ length: 8 }, (_, candidateIndex) =>
    generateCandidate(roomId, roomPreset, blockIndex, candidateIndex, previousSummary),
  );
}

function generateCandidate(roomId, roomPreset, blockIndex, candidateIndex, previousSummary) {
  const random = mulberry32(hashString(`${roomId}:${blockIndex}:${candidateIndex}`));
  const variation = (blockIndex + candidateIndex) % 4;
  const progression = rotate(roomPreset.progression, variation);
  const events = [];
  const totalBeats = BARS_PER_BLOCK * BEATS_PER_BAR;
  const leadDensity = 0.42 + roomPreset.energy * 0.32 + candidateIndex * 0.015;
  let previousLeadDegree = roomPreset.scale.length * 2;
  let previousLead = scalePitch(roomPreset, previousLeadDegree, 0);

  for (let bar = 0; bar < BARS_PER_BLOCK; bar += 1) {
    const chordDegree = progression[bar % progression.length];
    const rootPitch = scalePitch(roomPreset, chordDegree, 0);
    const chord = [
      scalePitch(roomPreset, chordDegree, 1),
      scalePitch(roomPreset, chordDegree + 2, 1),
      scalePitch(roomPreset, chordDegree + 4, 1),
    ];
    const barBeat = bar * BEATS_PER_BAR;

    events.push(note("bass", barBeat, 0.86, rootPitch, 0.78));
    events.push(note("bass", barBeat + 2, 0.72, rootPitch + (variation === 3 ? 7 : 0), 0.64));

    for (let step = 0; step < 8; step += 1) {
      const beat = barBeat + step * 0.5;
      const arpPitch = chord[(step + variation) % chord.length] + (step % 4 === 3 ? 12 : 0);
      events.push(note("arp", beat, 0.34, arpPitch, 0.28 + roomPreset.energy * 0.12));

      if (random() < leadDensity && !(bar % 4 === 3 && step > 5)) {
        const direction = random() > 0.52 ? 1 : -1;
        const leap = random() > 0.82 ? 2 : 1;
        previousLeadDegree += direction * leap;
        const lowerBound = roomPreset.scale.length;
        const upperBound = roomPreset.scale.length * 3;
        if (previousLeadDegree < lowerBound) previousLeadDegree = lowerBound + leap;
        if (previousLeadDegree > upperBound) previousLeadDegree = upperBound - leap;
        previousLead = scalePitch(roomPreset, previousLeadDegree, 0);
        events.push(note("lead", beat, random() > 0.7 ? 0.7 : 0.38, previousLead, 0.44 + roomPreset.energy * 0.2));
      }

      events.push(percussion("hat", beat, 0.08, step % 2 === 0 ? 0.42 : 0.25));
    }

    events.push(percussion("kick", barBeat, 0.16, 0.72 + roomPreset.energy * 0.18));
    events.push(percussion("snare", barBeat + 1, 0.14, 0.55));
    events.push(percussion("kick", barBeat + 2, 0.16, 0.62));
    events.push(percussion("snare", barBeat + 3, 0.14, 0.58));
    if (roomPreset.energy > 0.8 && bar % 4 === 3) {
      events.push(percussion("snare", barBeat + 3.5, 0.1, 0.42));
      events.push(percussion("snare", barBeat + 3.75, 0.08, 0.35));
    }
  }

  const contour = ["rising hooks", "falling answers", "wide leaps", "tight motifs"][variation];
  const visual = generateVisualProgram(roomId, roomPreset, blockIndex, candidateIndex);
  const visualName = VISUAL_PRESETS[roomId].name;
  const id = `option_${candidateIndex}`;
  const summary = `${contour}; progression ${progression.join("-")}; lead density ${leadDensity.toFixed(2)}; energy ${roomPreset.energy.toFixed(2)}; ${visualName} ${visual.style} animation at speed ${visual.speed.toFixed(2)}; varies from ${previousSummary || "the opening"}`;
  return {
    schemaVersion: 1,
    id,
    roomId,
    blockIndex,
    tempo: roomPreset.tempo,
    totalBeats,
    leadWave: roomPreset.leadWave,
    visual,
    summary,
    events: events.sort((left, right) => left.beat - right.beat),
  };
}

function generateVisualProgram(roomId, roomPreset, blockIndex, candidateIndex) {
  const preset = VISUAL_PRESETS[roomId];
  const seed = hashString(`${roomId}:${blockIndex}:${candidateIndex}:visual`);
  const random = mulberry32(seed);
  return {
    schemaVersion: 1,
    style: preset.styles[(blockIndex + candidateIndex) % preset.styles.length],
    palette: [...preset.palette],
    speed: Number((0.55 + roomPreset.energy * 0.7 + random() * 0.55).toFixed(3)),
    density: Math.round(14 + roomPreset.energy * 20 + random() * 14),
    pulse: Number((0.35 + roomPreset.energy * 0.5 + random() * 0.15).toFixed(3)),
    seed,
  };
}

function note(instrument, beat, duration, pitch, velocity) {
  return { instrument, beat, duration, pitch, velocity };
}

function percussion(instrument, beat, duration, velocity) {
  return { instrument, beat, duration, pitch: 0, velocity };
}

function scalePitch(roomPreset, degree, octave) {
  const length = roomPreset.scale.length;
  const normalized = ((degree % length) + length) % length;
  const octaveOffset = Math.floor(degree / length) + octave;
  return roomPreset.root + roomPreset.scale[normalized] + octaveOffset * 12;
}

function rotate(values, count) {
  const offset = count % values.length;
  return [...values.slice(offset), ...values.slice(0, offset)];
}

export function validateCandidate(candidate) {
  if (!candidate || candidate.schemaVersion !== 1) return false;
  if (!PRESETS[candidate.roomId]) return false;
  if (!Number.isInteger(candidate.blockIndex) || candidate.blockIndex < 0) return false;
  if (candidate.tempo < 60 || candidate.tempo > 200) return false;
  if (candidate.totalBeats !== BARS_PER_BLOCK * BEATS_PER_BAR) return false;
  if (!validateVisualProgram(candidate.visual, candidate.roomId)) return false;
  if (!Array.isArray(candidate.events) || candidate.events.length > 700) return false;
  return candidate.events.every((event) => {
    const validInstrument = ["lead", "arp", "bass", "kick", "snare", "hat"].includes(event.instrument);
    const validPitch = ["kick", "snare", "hat"].includes(event.instrument)
      ? event.pitch === 0
      : Number.isFinite(event.pitch) && event.pitch >= 24 && event.pitch <= 108;
    return validInstrument
      && Number.isFinite(event.beat)
      && event.beat >= 0
      && event.beat < candidate.totalBeats
      && Number.isFinite(event.duration)
      && event.duration > 0
      && event.duration <= 2
      && validPitch
      && Number.isFinite(event.velocity)
      && event.velocity > 0
      && event.velocity <= 1;
  });
}

function validateVisualProgram(visual, roomId) {
  const preset = VISUAL_PRESETS[roomId];
  if (!visual || visual.schemaVersion !== 1 || !preset) return false;
  if (!VISUAL_STYLES.includes(visual.style) || !preset.styles.includes(visual.style)) return false;
  if (!Array.isArray(visual.palette) || visual.palette.length !== preset.palette.length) return false;
  if (!visual.palette.every((color, index) => /^#[0-9a-f]{6}$/i.test(color) && color === preset.palette[index])) return false;
  return Number.isFinite(visual.speed)
    && visual.speed >= 0.25
    && visual.speed <= 2.5
    && Number.isInteger(visual.density)
    && visual.density >= 8
    && visual.density <= 64
    && Number.isFinite(visual.pulse)
    && visual.pulse >= 0
    && visual.pulse <= 1
    && Number.isInteger(visual.seed)
    && visual.seed >= 0;
}

export function selectLocalCandidate(candidates, roomId, blockIndex) {
  if (!candidates.length) throw new Error("No musical candidates");
  const index = hashString(`${roomId}:${blockIndex}:fallback`) % candidates.length;
  return candidates[index];
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function playerDebugState() {
  return {
    active: Boolean(activeSession),
    roomId: activeSession?.roomId || null,
    blockIndex: activeSession?.blockIndex || 0,
    queuedSeconds: activeSession ? queuedSeconds(activeSession) : 0,
    apiCalls: activeSession?.apiCalls || 0,
    provenance: activeSession?.provenance || null,
    contextState: audioContext?.state || "unavailable",
    visualStyle: activeSession?.visualProgram.style || null,
    visualFrames: activeSession?.visualFrames || 0,
  };
}

if (typeof window !== "undefined") {
  window.__chipcafePlayerDebug = playerDebugState;
}
