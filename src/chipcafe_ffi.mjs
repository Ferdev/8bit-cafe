import { choice, TypeSafeClient } from "@typesafe-ai/sdk";

const favoriteKey = "8bit-cafe.favorite-room";
const STARTUP_BUFFER_SECONDS = 12;
const REFILL_LOW_WATER_SECONDS = 12;
const REQUEST_TIMEOUT_MS = 6000;
const BARS_PER_BLOCK = 16;
const BEATS_PER_BAR = 4;
const MAX_RENDER_DIMENSION = 320;
const MAX_THUMBNAIL_DIMENSION = 160;
const VISUAL_STYLES = Object.freeze(["grid", "waves", "particles", "orbit", "bars", "pixels"]);
const VISUAL_SCENES = Object.freeze([
  "skyline", "coast", "forest", "castle", "handheld", "cosmos",
  "code-tunnel", "chip-studio", "overworld", "turbo-road", "quiz-stage", "plasma",
]);
const TONAL_INSTRUMENTS = Object.freeze(["lead", "counter", "arp", "pulse", "pad", "bass", "stab", "texture"]);
const PERCUSSION_INSTRUMENTS = Object.freeze(["kick", "snare", "hat"]);
const OSCILLATOR_TYPES = Object.freeze(["sine", "square", "sawtooth", "triangle"]);
const LAYERED_INSTRUMENTS = new Set(["lead", "counter", "pad", "stab", "texture"]);
const DELAY_INSTRUMENTS = new Set(["lead", "counter", "arp", "texture"]);

const PRESETS = Object.freeze({
  cvgm: preset("Neon drive", 132, 48, [0, 2, 3, 5, 7, 8, 10], [0, 5, 3, 4], 0.82),
  rainwave: preset("Coastal wave", 104, 48, [0, 2, 4, 7, 9], [0, 3, 4, 3], 0.48),
  nectarine: preset("Forest quest", 116, 50, [0, 2, 3, 5, 7, 9, 10], [0, 3, 5, 4], 0.58),
  slay: preset("Boss mode", 148, 45, [0, 2, 3, 5, 7, 8, 11], [0, 5, 3, 6], 0.92),
  kaaos: preset("Pocket pulse", 124, 47, [0, 2, 4, 5, 7, 9, 11], [0, 4, 5, 3], 0.72),
  kohina: preset("Orbital chip", 88, 43, [0, 2, 3, 5, 7, 8, 10], [0, 5, 2, 4], 0.35),
  "keygen-fm": preset("Cracktro lab", 154, 46, [0, 2, 3, 5, 7, 9, 10], [0, 6, 3, 4], 0.96),
  "sid-station": preset("SID ritual", 112, 45, [0, 2, 3, 5, 7, 8, 10], [0, 3, 5, 4], 0.68),
  rpgn: preset("Adventure loop", 108, 48, [0, 2, 4, 5, 7, 9, 11], [0, 4, 5, 3], 0.55),
  radiosega: preset("Turbo drive", 164, 47, [0, 2, 4, 5, 7, 9, 10], [0, 5, 3, 4], 1),
  "gtt-radio": preset("Party mode", 128, 48, [0, 2, 4, 5, 7, 9, 10], [0, 3, 5, 4], 0.78),
  ericade: preset("Tracker stage", 138, 46, [0, 2, 3, 5, 7, 9, 10], [0, 5, 3, 6], 0.86),
});

const MUSIC_PROFILES = Object.freeze({
  cvgm: musicProfile("night-drive", "drive", 0.5, 0.02, 0.68, ["square", "square", "triangle", "sawtooth", "triangle", "triangle", "sawtooth", "sine"]),
  rainwave: musicProfile("coastal-dream", "laidback", 1, 0.1, 0.42, ["triangle", "sine", "triangle", "sine", "triangle", "sine", "triangle", "sine"]),
  nectarine: musicProfile("woodland-party", "skip", 0.5, 0.06, 0.58, ["square", "triangle", "triangle", "square", "sine", "triangle", "square", "sine"]),
  slay: musicProfile("boss-assault", "assault", 0.5, 0, 0.82, ["sawtooth", "square", "sawtooth", "square", "sawtooth", "square", "sawtooth", "triangle"]),
  kaaos: musicProfile("handheld-hook", "chip", 0.5, 0.08, 0.7, ["square", "square", "triangle", "square", "square", "triangle", "square", "sine"]),
  kohina: musicProfile("zero-gravity", "ambient", 1, 0.12, 0.34, ["triangle", "sine", "sine", "triangle", "sine", "triangle", "triangle", "sine"]),
  "keygen-fm": musicProfile("cracktro-break", "breakbeat", 0.25, 0.04, 0.88, ["square", "sawtooth", "square", "square", "sawtooth", "triangle", "sawtooth", "sine"]),
  "sid-station": musicProfile("sid-funk", "shuffle", 0.5, 0.11, 0.66, ["sawtooth", "square", "sawtooth", "square", "triangle", "triangle", "square", "sine"]),
  rpgn: musicProfile("adventure-march", "march", 0.5, 0.03, 0.56, ["triangle", "square", "triangle", "square", "sine", "triangle", "square", "sine"]),
  radiosega: musicProfile("turbo-sprint", "turbo", 0.25, 0, 0.92, ["square", "sawtooth", "square", "square", "sawtooth", "triangle", "sawtooth", "triangle"]),
  "gtt-radio": musicProfile("arcade-party", "party", 0.5, 0.07, 0.78, ["square", "triangle", "square", "square", "triangle", "triangle", "square", "sine"]),
  ericade: musicProfile("demo-tracker", "tracker", 0.25, 0.05, 0.84, ["sawtooth", "square", "sawtooth", "square", "triangle", "triangle", "sawtooth", "sine"]),
});

const MELODY_PROFILES = Object.freeze({
  cvgm: melodyProfile("neon signal", [0, null, 2, 4, 5, 4, 2, null, 0, 2, 4, 7, 5, 4, 2, null], [4, null, 5, 7, 9, 7, 5, null, 4, 2, 0, 2, 4, 2, 0, null]),
  rainwave: melodyProfile("harbor lights", [0, null, null, 2, 4, null, 2, null, 5, null, null, 4, 2, null, 0, null], [2, null, 4, null, 5, null, 7, null, 5, null, 4, 2, 0, null, null, null]),
  nectarine: melodyProfile("firefly dance", [0, 2, null, 4, 2, 5, null, 4, 2, 0, 2, 4, null, 2, 0, null], [4, 5, null, 7, 5, 4, 2, null, 0, 2, 4, 5, 4, 2, 0, null]),
  slay: melodyProfile("citadel call", [0, null, 0, 3, 5, null, 3, 2, 0, 3, 5, 7, 6, 5, 3, null], [5, null, 7, 8, 7, 5, 3, null, 2, 3, 5, 6, 5, 3, 2, 0]),
  kaaos: melodyProfile("pocket hero", [0, 2, 4, 2, 5, 4, 2, null, 0, 2, 4, 7, 5, 2, 0, null], [4, 4, 5, 7, 5, 4, 2, null, 2, 0, 2, 4, 2, 0, null, null]),
  kohina: melodyProfile("distant beacon", [0, null, null, null, 4, null, null, 2, 5, null, null, 4, 2, null, null, null], [7, null, null, 5, 4, null, null, 2, 0, null, 2, null, 4, null, null, null]),
  "keygen-fm": melodyProfile("unlock sequence", [0, 2, 3, 5, 7, 5, 3, 2, 0, 3, 5, 8, 7, 5, 3, null], [3, 5, 7, 8, 10, 8, 7, 5, 3, 2, 0, 2, 3, 5, 7, null]),
  "sid-station": melodyProfile("sid invocation", [0, null, 3, 2, null, 5, 3, null, 0, 2, null, 4, 5, 4, 2, null], [3, null, 5, 7, null, 5, 4, 2, 0, null, 2, 3, 5, 3, 2, null]),
  rpgn: melodyProfile("road to dawn", [0, null, 2, 4, 5, null, 4, 2, 0, 2, 4, 7, 5, 4, 2, 0], [4, null, 5, 7, 9, null, 7, 5, 4, 5, 4, 2, 0, 2, 0, null]),
  radiosega: melodyProfile("final lap", [0, 2, 4, 5, 7, 5, 9, 7, 5, 4, 2, 4, 5, 7, 9, null], [7, 9, 10, 9, 7, 5, 4, 2, 0, 2, 4, 5, 7, 5, 4, null]),
  "gtt-radio": melodyProfile("bonus round", [0, 4, 2, 5, 4, null, 2, 0, 2, 5, 4, 7, 5, 4, 2, null], [4, 7, 5, 9, 7, null, 5, 4, 2, 4, 5, 7, 5, 2, 0, null]),
  ericade: melodyProfile("demo anthem", [0, 3, 5, 3, 7, 5, 3, 2, 0, 2, 5, 7, 8, 7, 5, 3], [5, 7, 8, 10, 8, 7, 5, 3, 2, 3, 5, 7, 5, 3, 2, null]),
});

const VISUAL_PRESETS = Object.freeze({
  cvgm: visualPreset("neon skyline", "skyline", "#07051c", ["#5dfdff", "#ff4fd8", "#6b5cff"], ["grid", "bars", "particles"]),
  rainwave: visualPreset("sunset tide", "coast", "#17102f", ["#ffcc66", "#ff6b8a", "#58d7ff"], ["waves", "particles", "orbit"]),
  nectarine: visualPreset("firefly grove", "forest", "#06190f", ["#a8ff60", "#ffe66d", "#43d17d"], ["particles", "waves", "pixels"]),
  slay: visualPreset("castle forge", "castle", "#100719", ["#c084fc", "#ff5c5c", "#ffd166"], ["bars", "grid", "particles"]),
  kaaos: visualPreset("handheld matrix", "handheld", "#0f380f", ["#9bbc0f", "#8bac0f", "#306230"], ["pixels", "grid", "bars"]),
  kohina: visualPreset("deep orbit", "cosmos", "#03030f", ["#c55cff", "#5d7cff", "#ffffff"], ["orbit", "particles", "waves"]),
  "keygen-fm": visualPreset("code tunnel", "code-tunnel", "#020d08", ["#63ff9b", "#5dfdff", "#ff4fd8"], ["grid", "pixels", "bars"]),
  "sid-station": visualPreset("sid chamber", "chip-studio", "#170b08", ["#ff9f43", "#c084fc", "#5dfdff"], ["orbit", "bars", "waves"]),
  rpgn: visualPreset("overworld map", "overworld", "#071a15", ["#8dff78", "#ffd166", "#5da9ff"], ["pixels", "particles", "waves"]),
  radiosega: visualPreset("turbo circuit", "turbo-road", "#08051b", ["#ff4f6d", "#5dfdff", "#ffe66d"], ["grid", "bars", "orbit"]),
  "gtt-radio": visualPreset("quiz party", "quiz-stage", "#19071b", ["#ff77d9", "#72f1b8", "#ffe66d"], ["particles", "bars", "pixels"]),
  ericade: visualPreset("demo plasma", "plasma", "#06051b", ["#8f7cff", "#ff4fd8", "#5dfdff"], ["waves", "orbit", "grid"]),
});

function preset(name, tempo, root, scale, progression, energy) {
  return Object.freeze({ name, tempo, root, scale, progression, energy });
}

function musicProfile(name, groove, arpRate, swing, counterDensity, waves) {
  return Object.freeze({
    name,
    groove,
    arpRate,
    swing,
    counterDensity,
    waves: Object.freeze(Object.fromEntries(TONAL_INSTRUMENTS.map((voice, index) => [voice, waves[index]]))),
  });
}

function melodyProfile(name, phraseA, phraseB) {
  return Object.freeze({
    name,
    phraseA: Object.freeze(phraseA),
    phraseB: Object.freeze(phraseB),
  });
}

function visualPreset(name, scene, backdrop, palette, styles) {
  return Object.freeze({
    name,
    scene,
    backdrop,
    palette: Object.freeze(palette),
    styles: Object.freeze(styles),
  });
}

let audioContext = null;
let masterGain = null;
let delaySend = null;
let activeSession = null;
let lobbyVisualFrame = null;
let lobbyVisualFrames = 0;
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

  stopLobbyVisuals();
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

export function startLobbyVisuals() {
  stopLobbyVisuals();
  lobbyVisualFrames = 0;
  const startedAt = window.performance.now();
  const programs = Object.fromEntries(Object.keys(PRESETS).map((roomId) => [
    roomId,
    generateVisualProgram(roomId, PRESETS[roomId], 0, 0),
  ]));
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  let lastPaint = 0;

  const render = (timestamp) => {
    if (timestamp - lastPaint >= 80 || lastPaint === 0) {
      const elapsed = Math.max(0, (timestamp - startedAt) / 1000);
      for (const canvas of document.querySelectorAll("canvas.room-art[data-room-id]")) {
        const roomId = canvas.dataset.roomId;
        const program = programs[roomId];
        if (program) renderVisualCanvas(canvas, program, elapsed, PRESETS[roomId].tempo, MAX_THUMBNAIL_DIMENSION);
      }
      lastPaint = timestamp;
      lobbyVisualFrames += 1;
    }
    if (!reduceMotion) lobbyVisualFrame = window.requestAnimationFrame(render);
  };

  lobbyVisualFrame = window.requestAnimationFrame(render);
}

export function stopLobbyVisuals() {
  if (lobbyVisualFrame !== null) window.cancelAnimationFrame(lobbyVisualFrame);
  lobbyVisualFrame = null;
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
    music_profile: MUSIC_PROFILES[session.roomId].name,
    melody_profile: MELODY_PROFILES[session.roomId].name,
    available_voices: [...TONAL_INSTRUMENTS],
    visual_scene: VISUAL_PRESETS[session.roomId].scene,
    previous_block: session.previousSummary,
    goal: "Preserve the stage's recognizable melody while choosing the most coherent variation in arrangement, energy, and scene motion.",
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
    defaultHeaders: { "X-Chipcafe-Jev-Key": config.typesafeApiKey },
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
  masterGain.gain.value = 0.145;
  masterGain.connect(compressor);

  const delay = audioContext.createDelay(0.75);
  const feedback = audioContext.createGain();
  const delayWet = audioContext.createGain();
  delay.delayTime.value = 0.285;
  feedback.gain.value = 0.21;
  delayWet.gain.value = 0.24;
  delaySend = audioContext.createGain();
  delaySend.gain.value = 1;
  delaySend.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(delayWet);
  delayWet.connect(compressor);
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
  const elapsed = Math.max(0, (audioContext?.currentTime || 0) - session.visualStartTime);
  renderVisualCanvas(canvas, session.visualProgram, elapsed, session.visualTempo, MAX_RENDER_DIMENSION);
  session.visualFrames += 1;
}

function renderVisualCanvas(canvas, program, elapsed, tempo, maxDimension) {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  const clientWidth = Math.max(1, canvas.clientWidth);
  const clientHeight = Math.max(1, canvas.clientHeight);
  const aspect = clientWidth / clientHeight;
  const width = aspect >= 1 ? maxDimension : Math.max(1, Math.round(maxDimension * aspect));
  const height = aspect >= 1 ? Math.max(1, Math.round(maxDimension / aspect)) : maxDimension;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.imageSmoothingEnabled = false;

  const beat = elapsed * tempo / 60;
  const pulse = 0.82 + Math.max(0, Math.sin(beat * Math.PI * 2)) * 0.18 * program.pulse;
  context.globalAlpha = 1;
  context.fillStyle = program.backdrop;
  context.fillRect(0, 0, width, height);
  context.lineWidth = Math.max(1, Math.round(Math.min(width, height) / 360));

  switch (program.scene) {
    case "skyline": drawSkylineScene(context, width, height, elapsed, beat, program); break;
    case "coast": drawCoastScene(context, width, height, elapsed, beat, program); break;
    case "forest": drawForestScene(context, width, height, elapsed, beat, program); break;
    case "castle": drawCastleScene(context, width, height, elapsed, beat, program); break;
    case "handheld": drawHandheldScene(context, width, height, elapsed, beat, program); break;
    case "cosmos": drawCosmosScene(context, width, height, elapsed, beat, program); break;
    case "code-tunnel": drawCodeTunnelScene(context, width, height, elapsed, beat, program); break;
    case "chip-studio": drawChipStudioScene(context, width, height, elapsed, beat, program); break;
    case "overworld": drawOverworldScene(context, width, height, elapsed, beat, program); break;
    case "turbo-road": drawTurboRoadScene(context, width, height, elapsed, beat, program); break;
    case "quiz-stage": drawQuizStageScene(context, width, height, elapsed, beat, program); break;
    case "plasma": drawPlasmaScene(context, width, height, elapsed, beat, program); break;
  }

  drawSceneActors(context, width, height, elapsed, beat, program);

  context.save();
  context.globalAlpha = 0.025 * pulse;
  switch (program.style) {
    case "grid": drawGrid(context, width, height, elapsed, program); break;
    case "waves": drawWaves(context, width, height, elapsed, program); break;
    case "particles": drawParticles(context, width, height, elapsed, program); break;
    case "orbit": drawOrbit(context, width, height, elapsed, program); break;
    case "bars": drawBars(context, width, height, beat, program); break;
    case "pixels": drawPixels(context, width, height, elapsed, program); break;
  }
  context.restore();
  context.globalAlpha = 1;
}

function drawSkylineScene(context, width, height, time, beat, program) {
  const horizon = height * 0.52;
  context.globalAlpha = 0.22;
  context.fillStyle = program.palette[2];
  context.fillRect(0, 0, width, horizon);
  for (let index = 0; index < 22; index += 1) {
    const buildingWidth = width / 18;
    const x = index * buildingWidth - (time * program.speed * 9 % buildingWidth);
    const buildingHeight = height * (0.12 + visualUnit(program.seed, index, 10) * 0.3);
    context.globalAlpha = 0.72;
    context.fillStyle = index % 3 === 0 ? program.palette[2] : program.backdrop;
    context.fillRect(x, horizon - buildingHeight, buildingWidth - 3, buildingHeight);
    context.globalAlpha = 0.72 + Math.sin(beat + index) * 0.18;
    context.fillStyle = program.palette[index % 2];
    for (let row = 0; row < 5; row += 1) {
      if ((row + index + program.variant) % 3 !== 0) {
        context.fillRect(x + 6, horizon - buildingHeight + 8 + row * 13, 4, 6);
      }
    }
  }
  context.globalAlpha = 0.85;
  context.fillStyle = program.backdrop;
  polygon(context, [[width * 0.34, height], [width * 0.47, horizon], [width * 0.53, horizon], [width * 0.68, height]]);
  context.strokeStyle = program.palette[0];
  for (let index = 0; index < 9; index += 1) {
    const depth = ((index + time * program.speed * 1.8) % 9) / 9;
    const y = horizon + depth * depth * (height - horizon);
    context.beginPath();
    context.moveTo(width * (0.47 - depth * 0.13), y);
    context.lineTo(width * (0.53 + depth * 0.15), y);
    context.stroke();
  }
}

function drawCoastScene(context, width, height, time, beat, program) {
  const horizon = Math.round(height * 0.52);
  for (let band = 0; band < 6; band += 1) {
    context.globalAlpha = 0.1 + band * 0.045;
    context.fillStyle = program.palette[(band + 1) % program.palette.length];
    context.fillRect(0, Math.round(band * horizon / 6), width, Math.ceil(horizon / 6));
  }
  for (let star = 0; star < 22; star += 1) {
    context.globalAlpha = 0.35 + visualUnit(program.seed, star, 31) * 0.55;
    context.fillStyle = program.palette[0];
    context.fillRect(Math.round(visualUnit(program.seed, star, 32) * width), Math.round(visualUnit(program.seed, star, 33) * horizon * 0.65), 1, 1);
  }
  context.globalAlpha = 0.92;
  context.fillStyle = program.palette[0];
  context.beginPath();
  const sunX = Math.round(width * (0.72 - program.variant * 0.04));
  context.arc(sunX, horizon * 0.62, Math.min(width, height) * 0.085, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = program.backdrop;
  context.fillRect(0, horizon, width, height - horizon);
  for (let row = 0; row < 17; row += 1) {
    const y = horizon + 3 + row * 5;
    const drift = Math.round((time * program.speed * (2 + row * 0.1)) % 24);
    context.globalAlpha = 0.28 + row * 0.018;
    context.fillStyle = program.palette[row % program.palette.length];
    for (let x = -24 + drift; x < width; x += 31 + row % 4) {
      context.fillRect(x, y + row % 2, 13 + row % 9, 1);
    }
  }
  for (let row = 0; row < 11; row += 1) {
    const reflectionWidth = 5 + row * 4;
    const reflectionX = sunX - reflectionWidth / 2 + Math.round(Math.sin(time * 3 + row) * 3);
    context.globalAlpha = 0.55 - row * 0.025;
    context.fillStyle = program.palette[0];
    context.fillRect(reflectionX, horizon + row * 4, reflectionWidth, 2);
  }
  const boatX = ((time * program.speed * 22) % (width + 120)) - 60;
  const boatY = horizon + height * 0.2 + Math.sin(beat) * 2;
  context.globalAlpha = 0.9;
  context.fillStyle = program.palette[1];
  polygon(context, [[boatX - 13, boatY], [boatX + 15, boatY], [boatX + 9, boatY + 6], [boatX - 9, boatY + 6]]);
  context.fillStyle = program.palette[0];
  polygon(context, [[boatX, boatY - 20], [boatX, boatY - 2], [boatX + 12, boatY - 2]]);
}

function drawForestScene(context, width, height, time, beat, program) {
  for (let star = 0; star < 28; star += 1) {
    context.globalAlpha = 0.3 + visualUnit(program.seed, star, 34) * 0.55;
    context.fillStyle = star % 5 === 0 ? program.palette[1] : program.palette[0];
    context.fillRect(Math.round(visualUnit(program.seed, star, 35) * width), Math.round(visualUnit(program.seed, star, 36) * height * 0.5), 1, 1);
  }
  context.globalAlpha = 0.8;
  context.fillStyle = program.palette[1];
  context.beginPath();
  context.arc(width * 0.76, height * 0.2, 12, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
  context.fillStyle = program.backdrop;
  context.fillRect(0, height * 0.72, width, height * 0.28);
  const treeCount = 19;
  for (let index = 0; index < treeCount; index += 1) {
    const foreground = index % 3 === 0;
    const span = width + 60;
    const speed = foreground ? 10 : 4;
    const x = ((index / treeCount * span - time * program.speed * speed) % span + span) % span - 30;
    const baseY = foreground ? height * 0.86 : height * 0.74;
    const treeHeight = (foreground ? 58 : 39) + Math.round(visualUnit(program.seed, index, 37) * 25);
    context.globalAlpha = foreground ? 0.48 : 0.25;
    context.fillStyle = foreground ? program.palette[2] : program.palette[0];
    context.fillRect(Math.round(x - 2), Math.round(baseY - treeHeight * 0.45), 4, Math.round(treeHeight * 0.48));
    for (let tier = 0; tier < 3; tier += 1) {
      const tierY = baseY - treeHeight + tier * treeHeight * 0.23;
      const half = treeHeight * (0.25 + tier * 0.08);
      polygon(context, [[x, tierY], [x - half, tierY + treeHeight * 0.45], [x + half, tierY + treeHeight * 0.45]]);
    }
  }
  for (let index = 0; index < program.density; index += 1) {
    const x = visualUnit(program.seed, index, 12) * width;
    const y = height * 0.42 + visualUnit(program.seed, index, 13) * height * 0.48;
    const glow = 1 + Math.round(Math.max(0, Math.sin(time * 2 + index + beat)));
    context.globalAlpha = 0.35 + glow * 0.2;
    context.fillStyle = program.palette[1];
    context.fillRect(Math.round(x), Math.round(y), glow, glow);
  }
}

function drawCastleScene(context, width, height, time, beat, program) {
  context.globalAlpha = 0.22;
  context.fillStyle = program.palette[0];
  context.fillRect(0, 0, width, height * 0.62);
  context.globalAlpha = 0.8;
  context.fillStyle = program.palette[2];
  context.beginPath();
  context.arc(width * 0.72, height * 0.22, Math.min(width, height) * 0.1, 0, Math.PI * 2);
  context.fill();
  const baseY = height * 0.76;
  context.fillStyle = program.backdrop;
  context.fillRect(width * 0.22, height * 0.43, width * 0.56, baseY - height * 0.43);
  for (const center of [0.22, 0.5, 0.78]) {
    const towerWidth = width * 0.13;
    context.fillRect(width * center - towerWidth / 2, height * 0.32, towerWidth, baseY - height * 0.32);
    for (let notch = 0; notch < 3; notch += 1) {
      context.fillRect(width * center - towerWidth / 2 + notch * towerWidth / 3, height * 0.28, towerWidth / 5, height * 0.07);
    }
  }
  context.fillStyle = program.palette[1];
  const flicker = 5 + Math.abs(Math.sin(beat * Math.PI)) * 8;
  for (const x of [0.28, 0.43, 0.57, 0.72]) {
    context.fillRect(width * x - 4, height * 0.52, 8, flicker);
  }
  if (program.variant === 3 && Math.floor(time * 1.5) % 5 === 0) {
    context.strokeStyle = "#ffffff";
    context.globalAlpha = 0.75;
    context.beginPath();
    context.moveTo(width * 0.13, 0);
    context.lineTo(width * 0.2, height * 0.18);
    context.lineTo(width * 0.15, height * 0.31);
    context.stroke();
  }
}

function drawHandheldScene(context, width, height, time, beat, program) {
  context.globalAlpha = 1;
  context.fillStyle = program.palette[0];
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 0.26;
  context.fillStyle = program.palette[2];
  for (let cloud = 0; cloud < 6; cloud += 1) {
    const cloudX = ((cloud * width / 5 - time * program.speed * 7) % (width + 50) + width + 50) % (width + 50) - 25;
    const cloudY = 18 + cloud % 3 * 24;
    context.fillRect(cloudX, cloudY, 21, 5);
    context.fillRect(cloudX + 5, cloudY - 5, 12, 5);
  }
  context.globalAlpha = 0.4;
  context.fillStyle = program.palette[1];
  polygon(context, [[0, height * 0.72], [width * 0.2, height * 0.43], [width * 0.4, height * 0.72]]);
  polygon(context, [[width * 0.3, height * 0.72], [width * 0.56, height * 0.35], [width * 0.82, height * 0.72]]);
  polygon(context, [[width * 0.66, height * 0.72], [width * 0.88, height * 0.49], [width, height * 0.67], [width, height * 0.72]]);
  context.globalAlpha = 1;
  context.fillStyle = program.palette[2];
  context.fillRect(0, height * 0.72, width, height * 0.28);
  context.fillStyle = program.backdrop;
  for (let x = -8; x < width; x += 12) {
    const offset = Math.round((time * program.speed * 10) % 12);
    context.fillRect(x - offset, height * 0.77, 6, 3);
    context.fillRect(x - offset + 5, height * 0.91, 3, 3);
  }
  const pipeX = width * 0.8;
  context.fillStyle = program.palette[1];
  context.fillRect(pipeX, height * 0.58, 28, height * 0.14);
  context.fillRect(pipeX - 4, height * 0.55, 36, 7);
  const spriteX = width * 0.34 + Math.sin(time * program.speed * 0.7) * width * 0.18;
  const spriteY = height * 0.62 - Math.max(0, Math.sin(time * program.speed * 2.1)) * height * 0.2;
  const walkFrame = Math.floor(beat * 2) % 2;
  drawPixelSprite(context, walkFrame ? PIXEL_SPRITES.heroB : PIXEL_SPRITES.heroA, spriteX - 10, spriteY - 17, 3, program);
}

function drawCosmosScene(context, width, height, time, beat, program) {
  for (let index = 0; index < program.density * 2; index += 1) {
    const depth = 0.3 + visualUnit(program.seed, index, 15) * 0.7;
    const x = (visualUnit(program.seed, index, 16) * width + time * program.speed * 12 * depth) % width;
    const y = visualUnit(program.seed, index, 17) * height;
    const size = Math.max(1, Math.round(depth * 4));
    context.globalAlpha = 0.35 + depth * 0.6;
    context.fillStyle = program.palette[index % program.palette.length];
    context.fillRect(x, y, size, size);
  }
  const radius = Math.min(width, height) * (0.13 + program.variant * 0.015);
  const centerX = width * 0.68;
  const centerY = height * 0.42;
  context.globalAlpha = 0.8;
  context.fillStyle = program.palette[0];
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = program.palette[1];
  context.lineWidth = 5;
  context.beginPath();
  context.ellipse(centerX, centerY, radius * 1.65, radius * 0.42, Math.sin(beat * 0.08) * 0.2, 0, Math.PI * 2);
  context.stroke();
}

function drawCodeTunnelScene(context, width, height, time, beat, program) {
  const deskY = Math.round(height * 0.72);
  context.globalAlpha = 0.22;
  context.strokeStyle = program.palette[2];
  context.lineWidth = 1;
  for (let line = 0; line < 9; line += 1) {
    const y = 14 + line * 13;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(28 + line * 5, y);
    context.lineTo(28 + line * 5, y + 7);
    context.lineTo(width - 25 - line * 4, y + 7);
    context.stroke();
  }
  context.globalAlpha = 0.9;
  context.fillStyle = program.palette[2];
  context.fillRect(0, deskY, width, 9);
  context.fillStyle = program.backdrop;
  context.fillRect(7, deskY + 9, 8, height - deskY);
  context.fillRect(width - 15, deskY + 9, 8, height - deskY);
  const laptopX = Math.round(width * 0.31);
  const laptopY = Math.round(height * 0.25);
  const laptopW = Math.round(width * 0.38);
  const laptopH = Math.round(height * 0.39);
  context.fillStyle = program.palette[2];
  context.fillRect(laptopX - 5, laptopY - 5, laptopW + 10, laptopH + 9);
  context.fillStyle = program.backdrop;
  context.fillRect(laptopX, laptopY, laptopW, laptopH);
  for (let row = 0; row < 9; row += 1) {
    const widthUnit = 12 + Math.round(visualUnit(program.seed + Math.floor(time * 2), row, 38) * (laptopW - 26));
    context.globalAlpha = 0.55 + row * 0.035;
    context.fillStyle = program.palette[(row + Math.floor(beat)) % program.palette.length];
    context.fillRect(laptopX + 7, laptopY + 7 + row * 5, widthUnit, 2);
  }
  context.globalAlpha = 0.8;
  context.fillStyle = program.palette[1];
  polygon(context, [[laptopX - 15, deskY], [laptopX + laptopW + 15, deskY], [laptopX + laptopW + 28, deskY + 7], [laptopX - 28, deskY + 7]]);
  context.fillStyle = program.palette[0];
  context.fillRect(width * 0.78, deskY - 19, 29, 19);
  context.fillStyle = program.backdrop;
  context.fillRect(width * 0.78 + 4, deskY - 15, 21, 11);
}

function drawChipStudioScene(context, width, height, time, beat, program) {
  const deskY = Math.round(height * 0.74);
  context.globalAlpha = 0.16;
  context.fillStyle = program.palette[0];
  context.fillRect(0, 18, width, 3);
  context.fillRect(0, height * 0.45, width, 2);
  context.globalAlpha = 0.9;
  context.fillStyle = program.palette[2];
  context.fillRect(0, deskY, width, 12);
  context.fillStyle = program.backdrop;
  context.fillRect(18, deskY + 12, 9, height - deskY);
  context.fillRect(width - 27, deskY + 12, 9, height - deskY);
  const monitorX = Math.round(width * 0.35);
  const monitorY = Math.round(height * 0.27);
  const monitorW = Math.round(width * 0.3);
  const monitorH = Math.round(height * 0.31);
  context.fillStyle = program.palette[1];
  context.fillRect(monitorX - 5, monitorY - 5, monitorW + 10, monitorH + 10);
  context.fillStyle = program.backdrop;
  context.fillRect(monitorX, monitorY, monitorW, monitorH);
  context.strokeStyle = program.palette[0];
  context.lineWidth = 2;
  context.beginPath();
  for (let x = 0; x < monitorW; x += 3) {
    const y = monitorY + monitorH / 2 + Math.sin(x * 0.24 + time * program.speed * 4) * monitorH * 0.25;
    if (x === 0) context.moveTo(monitorX + x, y); else context.lineTo(monitorX + x, y);
  }
  context.stroke();
  for (const speakerX of [width * 0.12, width * 0.76]) {
    context.fillStyle = program.palette[2];
    context.fillRect(speakerX, height * 0.38, width * 0.12, height * 0.31);
    context.fillStyle = program.backdrop;
    context.beginPath();
    context.arc(speakerX + width * 0.06, height * 0.48, 7 + Math.sin(beat * Math.PI) * 2, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(speakerX + width * 0.06, height * 0.62, 11 + Math.sin(beat * Math.PI) * 2, 0, Math.PI * 2);
    context.fill();
  }
  for (let key = 0; key < 14; key += 1) {
    context.fillStyle = program.palette[key % 3];
    context.fillRect(width * 0.31 + key * 9, deskY - 10, 6, 7);
  }
}

function drawOverworldScene(context, width, height, time, beat, program) {
  for (let band = 0; band < 5; band += 1) {
    context.globalAlpha = 0.08 + band * 0.035;
    context.fillStyle = program.palette[2];
    context.fillRect(0, band * height * 0.11, width, height * 0.12);
  }
  for (let star = 0; star < 32; star += 1) {
    context.globalAlpha = 0.35;
    context.fillStyle = program.palette[1];
    context.fillRect(visualUnit(program.seed, star, 39) * width, visualUnit(program.seed, star, 40) * height * 0.4, 1, 1);
  }
  context.globalAlpha = 0.28;
  context.fillStyle = program.palette[2];
  polygon(context, [[0, height * 0.63], [width * 0.18, height * 0.28], [width * 0.29, height * 0.57], [width * 0.43, height * 0.35], [width * 0.58, height * 0.63]]);
  context.globalAlpha = 0.58;
  context.fillStyle = program.palette[0];
  polygon(context, [[0, height * 0.69], [width * 0.28, height * 0.5], [width * 0.51, height * 0.68], [width * 0.75, height * 0.46], [width, height * 0.65], [width, height], [0, height]]);
  context.globalAlpha = 0.45;
  context.fillStyle = program.palette[1];
  polygon(context, [[width * 0.46, height], [width * 0.54, height], [width * 0.62, height * 0.72], [width * 0.58, height * 0.61], [width * 0.53, height * 0.54], [width * 0.56, height * 0.47], [width * 0.59, height * 0.45], [width * 0.61, height * 0.46], [width * 0.59, height * 0.49], [width * 0.57, height * 0.5], [width * 0.59, height * 0.57], [width * 0.65, height * 0.7]]);
  const castleX = width * 0.77;
  context.globalAlpha = 0.75;
  context.fillStyle = program.backdrop;
  context.fillRect(castleX, height * 0.48, 29, 22);
  context.fillRect(castleX + 3, height * 0.42, 7, 12);
  context.fillRect(castleX + 19, height * 0.4, 7, 14);
}

function drawTurboRoadScene(context, width, height, time, beat, program) {
  const horizon = height * 0.4;
  for (let band = 0; band < 5; band += 1) {
    context.globalAlpha = 0.08 + band * 0.035;
    context.fillStyle = program.palette[(band + 2) % 3];
    context.fillRect(0, band * horizon / 5, width, horizon / 5 + 1);
  }
  context.globalAlpha = 0.34;
  context.fillStyle = program.palette[0];
  for (let building = 0; building < 22; building += 1) {
    const x = building * width / 21;
    const h = 7 + visualUnit(program.seed, building, 41) * 23;
    context.fillRect(x, horizon - h, width / 25, h);
  }
  context.globalAlpha = 0.86;
  context.fillStyle = program.backdrop;
  polygon(context, [[width * 0.48, horizon], [width * 0.59, horizon], [width * 0.93, height], [width * 0.04, height]]);
  for (let line = 0; line < 12; line += 1) {
    const depth = ((line + time * program.speed * 3.2) % 12) / 12;
    const y = horizon + depth * depth * (height - horizon);
    context.strokeStyle = program.palette[line % program.palette.length];
    context.globalAlpha = 0.35 + depth * 0.65;
    const bend = Math.sin(time * 0.2) * depth * width * 0.12;
    context.fillRect(width * (0.53 - depth * 0.42) + bend, y, Math.max(2, depth * width * 0.18), Math.max(1, depth * 3));
    context.fillRect(width * (0.54 + depth * 0.2) + bend, y, Math.max(2, depth * width * 0.18), Math.max(1, depth * 3));
  }
  const carY = height * 0.78 + Math.sin(beat * 2) * 3;
  context.globalAlpha = 1;
  context.fillStyle = program.palette[0];
  context.fillRect(width * 0.5 - 42, carY, 84, 24);
  context.fillStyle = program.palette[1];
  context.fillRect(width * 0.5 - 25, carY - 16, 50, 18);
  context.fillRect(width * 0.5 - 36, carY + 20, 14, 8);
  context.fillRect(width * 0.5 + 22, carY + 20, 14, 8);
}

function drawQuizStageScene(context, width, height, time, beat, program) {
  context.globalAlpha = 0.15;
  context.fillStyle = program.palette[2];
  context.fillRect(0, 12, width, 2);
  context.fillRect(0, height * 0.82, width, 3);
  const boardX = Math.round(width * 0.34);
  const boardY = Math.round(height * 0.13);
  const cell = 12;
  context.globalAlpha = 0.9;
  context.fillStyle = program.palette[2];
  context.fillRect(boardX - 6, boardY - 6, cell * 8 + 12, cell * 5 + 12);
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const active = (row * 3 + column + Math.floor(beat)) % 7 !== 0;
      context.fillStyle = active ? program.palette[(row + column + program.variant) % 3] : program.backdrop;
      context.fillRect(boardX + column * cell, boardY + row * cell, cell - 2, cell - 2);
    }
  }
  for (const cabinetX of [18, 63, width - 102, width - 57]) {
    context.globalAlpha = 0.74;
    context.fillStyle = program.palette[2];
    context.fillRect(cabinetX, height * 0.47, 32, 67);
    context.fillStyle = program.backdrop;
    context.fillRect(cabinetX + 5, height * 0.51, 22, 18);
    context.fillStyle = program.palette[Math.floor(cabinetX) % 3];
    context.fillRect(cabinetX + 7, height * 0.53, 18, 2);
    context.fillRect(cabinetX + 8, height * 0.64, 4, 4);
    context.fillRect(cabinetX + 20, height * 0.64, 4, 4);
  }
  for (let audience = 0; audience < 28; audience += 1) {
    context.globalAlpha = 0.25 + Math.max(0, Math.sin(beat + audience)) * 0.3;
    context.fillStyle = program.palette[audience % 3];
    context.fillRect(audience * width / 27, height * 0.88 + audience % 3 * 3, 3, 3);
  }
}

function drawPlasmaScene(context, width, height, time, beat, program) {
  const screenX = Math.round(width * 0.32);
  const screenY = 13;
  const screenWidth = Math.round(width * 0.36);
  const screenHeight = 69;
  context.globalAlpha = 0.68;
  context.fillStyle = program.palette[2];
  context.fillRect(screenX - 4, screenY - 4, screenWidth + 8, screenHeight + 8);
  const size = 5;
  const columns = Math.ceil(screenWidth / size);
  const rows = Math.ceil(screenHeight / size);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const value = Math.sin(column * 0.32 + time * program.speed)
        + Math.sin(row * 0.27 - time * program.speed * 0.8)
        + Math.sin((column + row) * 0.18 + beat * 0.45);
      const color = Math.abs(Math.floor(value * 2 + program.variant)) % program.palette.length;
      context.fillStyle = program.palette[color];
      context.globalAlpha = 0.55;
      context.fillRect(screenX + column * size, screenY + row * size, size + 1, size + 1);
    }
  }
  context.globalAlpha = 0.86;
  context.fillStyle = program.palette[2];
  context.fillRect(0, height * 0.64, width, 9);
  for (let terminal = 0; terminal < 4; terminal += 1) {
    const x = 18 + terminal * (width - 48) / 3;
    context.fillStyle = program.palette[terminal % 3];
    context.fillRect(x, height * 0.45, 35, 28);
    context.fillStyle = program.backdrop;
    context.fillRect(x + 4, height * 0.48, 27, 18);
    context.fillStyle = program.palette[(terminal + 1) % 3];
    for (let line = 0; line < 4; line += 1) {
      context.fillRect(x + 7, height * 0.5 + line * 3, 12 + (line + terminal) % 3 * 4, 1);
    }
    context.fillStyle = program.palette[2];
    context.fillRect(x + 12, height * 0.59, 11, 7);
  }
  context.fillStyle = program.backdrop;
  for (let leg = 0; leg < 5; leg += 1) context.fillRect(12 + leg * (width - 24) / 4, height * 0.64 + 9, 6, height * 0.36);
}

const PIXEL_SPRITES = Object.freeze({
  hovercar: Object.freeze([
    "  22222 ",
    " 2111122",
    "23333332",
    "  4  4  ",
  ]),
  gull: Object.freeze([
    "11   11",
    " 11211 ",
    "   1   ",
  ]),
  foxA: Object.freeze([
    "  22   ",
    " 2222  ",
    "1133111",
    "  33 1 ",
    "  3  3 ",
  ]),
  foxB: Object.freeze([
    "  22   ",
    " 2222  ",
    "1133111",
    "  33 1 ",
    "   33  ",
  ]),
  dragon: Object.freeze([
    "     22 ",
    "  222223",
    "1222222 ",
    "  2  2  ",
    " 1    1 ",
  ]),
  ghost: Object.freeze([
    " 1111 ",
    "122221",
    "123321",
    "122221",
    "121121",
  ]),
  rocket: Object.freeze([
    "   1   ",
    "  121  ",
    " 12221 ",
    "1122211",
    "  232  ",
    "  343  ",
  ]),
  bot: Object.freeze([
    " 11111 ",
    "1222221",
    "1232321",
    "1222221",
    " 11 11 ",
    " 1   1 ",
  ]),
  pulse: Object.freeze([
    "1     1",
    " 1   1 ",
    "  121  ",
    "   2   ",
    "  121  ",
    " 1   1 ",
    "1     1",
  ]),
  heroA: Object.freeze([
    "  111  ",
    " 12221 ",
    "  232  ",
    " 13331 ",
    "   3   ",
    "  3 3  ",
  ]),
  heroB: Object.freeze([
    "  111  ",
    " 12221 ",
    "  232  ",
    " 13331 ",
    "   3   ",
    "   33  ",
  ]),
  rival: Object.freeze([
    "  1111  ",
    " 122221 ",
    "13333331",
    " 4    4 ",
  ]),
  host: Object.freeze([
    "  111  ",
    " 12221 ",
    "  232  ",
    " 13331 ",
    " 3 3 3 ",
    " 3   3 ",
  ]),
  star: Object.freeze([
    "   1   ",
    " 1 1 1 ",
    "  222  ",
    "1223221",
    "  222  ",
    " 1 1 1 ",
    "   1   ",
  ]),
});

function drawSceneActors(context, width, height, time, beat, program) {
  const frame = Math.floor(beat * 2) % 2;
  const travel = (time * program.speed * 24) % (width + 56) - 28;
  const bob = frame === 0 ? 0 : 2;
  switch (program.scene) {
    case "skyline":
      drawPixelSprite(context, PIXEL_SPRITES.hovercar, travel, height * 0.32 + bob, 3, program);
      break;
    case "coast":
      drawPixelSprite(context, PIXEL_SPRITES.gull, width - travel, height * 0.2 + bob * 2, 2, program);
      break;
    case "forest":
      drawPixelSprite(context, frame ? PIXEL_SPRITES.foxB : PIXEL_SPRITES.foxA, travel, height * 0.72, 3, program);
      break;
    case "castle":
      drawPixelSprite(context, PIXEL_SPRITES.dragon, width - travel, height * 0.17 + Math.sin(time * 2) * 5, 3, program);
      drawPixelFlag(context, width * 0.5, height * 0.23, frame, program);
      break;
    case "handheld":
      drawPixelSprite(context, PIXEL_SPRITES.ghost, width * 0.7, height * 0.28 + bob * 2, 4, program);
      break;
    case "cosmos":
      drawPixelSprite(context, PIXEL_SPRITES.rocket, travel, height * 0.62 - Math.sin(time) * 14, 3, program);
      break;
    case "code-tunnel":
      drawPixelSprite(context, PIXEL_SPRITES.bot, width * 0.5 - 14, height * 0.64 + bob, 4, program);
      break;
    case "chip-studio":
      drawPixelSprite(context, PIXEL_SPRITES.pulse, width * 0.5 - 7, height * 0.5 - 7, 2, program);
      break;
    case "overworld":
      drawPixelSprite(context, frame ? PIXEL_SPRITES.heroB : PIXEL_SPRITES.heroA, width * 0.2, height * 0.63, 3, program);
      break;
    case "turbo-road":
      drawPixelSprite(context, PIXEL_SPRITES.rival, width * (0.32 + Math.sin(time * 0.8) * 0.12), height * 0.51 + bob, 3, program);
      break;
    case "quiz-stage":
      drawPixelSprite(context, PIXEL_SPRITES.host, width * 0.5 - 11, height * 0.31 + bob, 3, program);
      break;
    case "plasma":
      drawPixelSprite(context, PIXEL_SPRITES.star, width * 0.5 - 7, height * 0.5 - 7 + bob, 3, program);
      break;
  }
}

function drawPixelSprite(context, sprite, x, y, scale, program) {
  const colors = {
    1: program.palette[0],
    2: program.palette[1],
    3: program.palette[2],
    4: program.backdrop,
  };
  context.save();
  context.globalAlpha = 1;
  for (let row = 0; row < sprite.length; row += 1) {
    for (let column = 0; column < sprite[row].length; column += 1) {
      const color = colors[sprite[row][column]];
      if (!color) continue;
      context.fillStyle = color;
      context.fillRect(Math.round(x) + column * scale, Math.round(y) + row * scale, scale, scale);
    }
  }
  context.restore();
}

function drawPixelFlag(context, x, y, frame, program) {
  context.save();
  context.globalAlpha = 1;
  context.fillStyle = program.palette[2];
  context.fillRect(Math.round(x), Math.round(y), 2, 22);
  context.fillStyle = program.palette[1];
  context.fillRect(Math.round(x) + 2, Math.round(y), frame ? 12 : 16, 4);
  context.fillRect(Math.round(x) + 2, Math.round(y) + 4, frame ? 16 : 12, 4);
  context.restore();
}

function polygon(context, points) {
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) context.lineTo(x, y);
  context.closePath();
  context.fill();
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
  const inheritedAlpha = context.globalAlpha;
  for (let index = 0; index < program.density; index += 1) {
    const cell = Math.floor(visualUnit(program.seed + phase, index, 6) * columns * rows);
    const x = cell % columns;
    const y = Math.floor(cell / columns);
    context.fillStyle = program.palette[(index + phase) % program.palette.length];
    context.globalAlpha = inheritedAlpha * (0.22 + visualUnit(program.seed, index, 7) * 0.5);
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
  const filter = audioContext.createBiquadFilter();
  const voiceGain = {
    bass: 0.1,
    pad: 0.034,
    arp: 0.034,
    pulse: 0.029,
    counter: 0.043,
    lead: 0.082,
    stab: 0.033,
    texture: 0.025,
  }[event.instrument] || 0.05;
  const peak = Math.max(0.004, event.velocity * voiceGain);
  oscillator.type = block.waves[event.instrument];
  oscillator.frequency.value = midiToFrequency(event.pitch);
  filter.type = "lowpass";
  filter.frequency.value = {
    bass: 720,
    pad: 1350,
    arp: 3400,
    pulse: 2100,
    counter: 2600,
    lead: 3700,
    stab: 1800,
    texture: 4300,
  }[event.instrument] || 2600;
  filter.Q.value = event.instrument === "lead" || event.instrument === "stab" ? 3.2 : 0.8;
  gain.gain.setValueAtTime(0.0001, when);
  const sustained = event.instrument === "pad" || event.instrument === "texture";
  const attack = sustained ? Math.min(0.14, duration / 3) : 0.008;
  const release = sustained ? Math.min(0.24, duration / 3) : 0.035;
  gain.gain.exponentialRampToValueAtTime(peak, when + attack);
  gain.gain.setValueAtTime(peak, Math.max(when + attack + 0.002, when + duration - release));
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  oscillator.connect(filter);
  if (LAYERED_INSTRUMENTS.has(event.instrument)) {
    const layer = audioContext.createOscillator();
    const layerGain = audioContext.createGain();
    layer.type = block.waves[event.instrument];
    layer.frequency.value = midiToFrequency(event.pitch) * (event.instrument === "texture" ? 2 : 1);
    layer.detune.value = event.instrument === "stab" ? -10 : 7;
    layerGain.gain.value = event.instrument === "pad" ? 0.32 : 0.22;
    layer.connect(layerGain);
    layerGain.connect(filter);
    trackSource(session, layer);
    layer.start(when);
    layer.stop(when + duration + 0.01);
  }
  filter.connect(gain);
  gain.connect(masterGain);
  if (DELAY_INSTRUMENTS.has(event.instrument)) gain.connect(delaySend);
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
  const profile = MUSIC_PROFILES[roomId];
  const melody = MELODY_PROFILES[roomId];
  const variation = (blockIndex + candidateIndex) % 4;
  const progression = rotate(roomPreset.progression, variation);
  const events = [];
  const totalBeats = BARS_PER_BLOCK * BEATS_PER_BAR;
  const form = ["intro", "theme-a", "lift", "chorus", "finale"];

  for (let bar = 0; bar < BARS_PER_BLOCK; bar += 1) {
    const chordDegree = progression[bar % progression.length];
    const inversion = (variation + Math.floor(bar / 4)) % 3;
    const chord = [
      scalePitch(roomPreset, chordDegree, 1),
      scalePitch(roomPreset, chordDegree + 2, 1),
      scalePitch(roomPreset, chordDegree + 4, 1),
      scalePitch(roomPreset, chordDegree + (variation % 2 === 0 ? 6 : 8), 1),
    ].map((pitch, index) => index < inversion ? pitch + 12 : pitch);
    const barBeat = bar * BEATS_PER_BAR;
    const section = sectionForBar(bar);
    const sectionEnergy = [0.66, 0.86, 0.94, 1, 1.08][section];
    const phrase = section === 2 || section === 4 ? melody.phraseB : melody.phraseA;

    const bassPattern = grooveBassPattern(profile.groove);
    for (const [index, offset] of bassPattern.entries()) {
      const passingTone = index === bassPattern.length - 1 && variation === 3 ? 2 : 0;
      events.push(note("bass", barBeat + offset, 0.42, scalePitch(roomPreset, chordDegree + passingTone, 0), Math.min(1, (0.54 + roomPreset.energy * 0.18) * sectionEnergy)));
    }

    if (bar % 2 === 0) {
      for (const pitch of chord) {
        events.push(note("pad", barBeat, 7.7, pitch - 12, Math.min(1, (0.29 + roomPreset.energy * 0.11) * sectionEnergy)));
      }
    }

    const arpSteps = Math.round(BEATS_PER_BAR / profile.arpRate);
    for (let step = 0; step < arpSteps; step += 1) {
      const offset = step * profile.arpRate;
      const beat = barBeat + offset + (step % 2 === 1 ? profile.swing : 0);
      const arpPitch = chord[(step + variation) % chord.length] + (step % 4 === 3 ? 12 : 0);
      const arpVelocity = section === 0 && step % 2 === 1 ? 0.11 : (0.17 + roomPreset.energy * 0.1) * sectionEnergy;
      events.push(note("arp", beat, profile.arpRate * 0.72, arpPitch, Math.min(1, arpVelocity)));
    }

    for (let step = 0; step < 8; step += 1) {
      const phraseIndex = (bar % 2) * 8 + step;
      const degree = phrase[phraseIndex];
      if (degree === null) continue;
      const octaveLift = section === 3 && variation === 2 ? 12 : 0;
      const leadPitch = scalePitch(roomPreset, degree, 1) + octaveLift;
      const duration = melodyNoteDuration(phrase, phraseIndex);
      events.push(note("lead", barBeat + step * 0.5 + (step % 2 ? profile.swing : 0), duration, leadPitch, Math.min(1, (0.5 + roomPreset.energy * 0.18) * sectionEnergy)));
    }

    for (let beat = 0; beat < BEATS_PER_BAR; beat += 1) {
      const pulseDegree = chordDegree + ((beat + variation) % 3) * 2;
      if (section > 0 || beat % 2 === 0) {
        events.push(note("pulse", barBeat + beat + profile.swing, 0.22, scalePitch(roomPreset, pulseDegree, 2), Math.min(1, (0.24 + roomPreset.energy * 0.11) * sectionEnergy)));
      }
    }

    for (const offset of [1.5, 3.5]) {
      if ((section > 0 || bar === 1) && random() < profile.counterDensity + section * 0.07) {
        const answerIndex = (bar % 2) * 8 + Math.round(offset * 2);
        const answerDegree = phrase[answerIndex] ?? chordDegree + 4;
        events.push(note("counter", barBeat + offset, 0.42, scalePitch(roomPreset, answerDegree, 2), Math.min(1, (0.31 + roomPreset.energy * 0.13) * sectionEnergy)));
      }
    }

    if (section > 0 || bar === 1) {
      const stabOffsets = grooveStabPattern(profile.groove, bar);
      for (const offset of stabOffsets) {
        for (const pitch of chord.slice(0, 3)) {
          events.push(note("stab", barBeat + offset + profile.swing, 0.2, pitch, Math.min(1, (0.28 + roomPreset.energy * 0.15) * sectionEnergy)));
        }
      }
    }

    if (bar % 2 === 0) {
      const texturePitch = chord[3] + (section >= 3 ? 12 : 0);
      events.push(note("texture", barBeat + (section === 0 ? 0 : 2.75), section === 0 ? 2.8 : 1.1, texturePitch, Math.min(1, (0.24 + roomPreset.energy * 0.1) * sectionEnergy)));
    }

    for (let step = 0; step < 8; step += 1) {
      const hatBeat = barBeat + step * 0.5 + (step % 2 === 1 ? profile.swing : 0);
      if (section === 0 && step % 2 === 1) continue;
      const openAccent = profile.groove === "ambient" ? 0.2 : step % 2 === 0 ? 0.36 : 0.22;
      events.push(percussion("hat", hatBeat, 0.08, openAccent));
    }
    addDrumGroove(events, barBeat, profile.groove, roomPreset.energy * sectionEnergy, bar);
  }

  const arrangement = ["open voicings", "syncopated support", "an octave-lifted chorus", "cadence fills"][variation];
  const visual = generateVisualProgram(roomId, roomPreset, blockIndex, candidateIndex);
  const visualName = VISUAL_PRESETS[roomId].name;
  const id = `option_${candidateIndex}`;
  const hookSummary = melody.phraseA.map((degree) => degree === null ? "r" : degree).join("-");
  const summary = `${profile.name} ${profile.groove} arrangement built around the repeating ${melody.name} melody (${hookSummary}), with eight tonal voices, ${arrangement}, intro/theme/lift/chorus/finale form, extended progression ${progression.join("-")}, and energy ${roomPreset.energy.toFixed(2)}; literal animated pixel-art ${visualName} ${visual.scene} scene at speed ${visual.speed.toFixed(2)}; varies the arrangement from ${previousSummary || "the opening"} while preserving the hook`;
  return {
    schemaVersion: 1,
    id,
    roomId,
    blockIndex,
    tempo: roomPreset.tempo,
    totalBeats,
    profile: profile.name,
    melody: melody.name,
    form,
    hook: [...melody.phraseA],
    waves: { ...profile.waves },
    visual,
    summary,
    events: events.sort((left, right) => left.beat - right.beat),
  };
}

function sectionForBar(bar) {
  if (bar < 2) return 0;
  if (bar < 6) return 1;
  if (bar < 10) return 2;
  if (bar < 14) return 3;
  return 4;
}

function melodyNoteDuration(phrase, index) {
  let steps = 1;
  while (steps < 4 && phrase[index + steps] === null) steps += 1;
  return Math.max(0.38, steps * 0.5 - 0.08);
}

function grooveStabPattern(groove, bar) {
  switch (groove) {
    case "ambient": return [2.5];
    case "laidback": return bar % 2 === 0 ? [1.5] : [2.75];
    case "shuffle": return [1.5, 3.5];
    case "breakbeat": return [0.75, 2.75];
    case "turbo": return [1.5, 2.5, 3.5];
    case "tracker": return [0.75, 2.25, 3.25];
    default: return bar % 2 === 0 ? [1.5, 3.5] : [2.5];
  }
}

function grooveBassPattern(groove) {
  switch (groove) {
    case "drive": return [0, 2, 3.5];
    case "laidback": return [0, 2.5];
    case "skip": return [0, 1.5, 3];
    case "assault": return [0, 1, 2, 3];
    case "chip": return [0, 2, 3];
    case "ambient": return [0, 3];
    case "breakbeat": return [0, 0.75, 2, 2.75];
    case "shuffle": return [0, 1.5, 2.75];
    case "march": return [0, 1, 2, 3];
    case "turbo": return [0, 1, 2, 2.5, 3];
    case "party": return [0, 1.5, 2, 3.5];
    case "tracker": return [0, 0.75, 1.5, 2, 3.25];
  }
}

function addDrumGroove(events, barBeat, groove, energy, bar) {
  const patterns = {
    drive: [["kick", 0], ["snare", 1], ["kick", 2], ["snare", 3]],
    laidback: [["kick", 0], ["snare", 2], ["kick", 3.25]],
    skip: [["kick", 0], ["snare", 1], ["kick", 2.5], ["snare", 3]],
    assault: [["kick", 0], ["kick", 1], ["snare", 2], ["kick", 2.5], ["snare", 3]],
    chip: [["kick", 0], ["snare", 1], ["kick", 2], ["kick", 2.75], ["snare", 3]],
    ambient: [["kick", 0], ["snare", 2]],
    breakbeat: [["kick", 0], ["snare", 1], ["kick", 1.75], ["kick", 2.5], ["snare", 3]],
    shuffle: [["kick", 0], ["snare", 1.5], ["kick", 2.25], ["snare", 3.5]],
    march: [["kick", 0], ["snare", 1], ["kick", 2], ["snare", 3]],
    turbo: [["kick", 0], ["kick", 1], ["snare", 1.5], ["kick", 2], ["kick", 3], ["snare", 3.5]],
    party: [["kick", 0], ["snare", 1], ["kick", 2], ["snare", 3], ["kick", 3.5]],
    tracker: [["kick", 0], ["snare", 1], ["kick", 1.75], ["snare", 2.5], ["kick", 3.25]],
  };
  for (const [instrument, offset] of patterns[groove]) {
    const velocity = instrument === "kick" ? 0.62 + energy * 0.2 : 0.48 + energy * 0.12;
    events.push(percussion(instrument, barBeat + offset, instrument === "kick" ? 0.16 : 0.13, velocity));
  }
  if (energy > 0.8 && bar % 4 === 3) {
    events.push(percussion("snare", barBeat + 3.75, 0.08, 0.36));
  }
}

function generateVisualProgram(roomId, roomPreset, blockIndex, candidateIndex) {
  const preset = VISUAL_PRESETS[roomId];
  const seed = hashString(`${roomId}:${blockIndex}:${candidateIndex}:visual`);
  const random = mulberry32(seed);
  return {
    schemaVersion: 1,
    scene: preset.scene,
    style: preset.styles[(blockIndex + candidateIndex) % preset.styles.length],
    backdrop: preset.backdrop,
    palette: [...preset.palette],
    variant: (blockIndex + candidateIndex) % 4,
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
  const profile = MUSIC_PROFILES[candidate.roomId];
  if (candidate.profile !== profile.name || !validateWaves(candidate.waves)) return false;
  const melody = MELODY_PROFILES[candidate.roomId];
  if (candidate.melody !== melody.name) return false;
  if (!Array.isArray(candidate.form)
    || candidate.form.join(",") !== "intro,theme-a,lift,chorus,finale") return false;
  if (!Array.isArray(candidate.hook)
    || candidate.hook.length !== melody.phraseA.length
    || !candidate.hook.every((degree, index) => degree === melody.phraseA[index])) return false;
  if (!validateVisualProgram(candidate.visual, candidate.roomId)) return false;
  if (!Array.isArray(candidate.events) || candidate.events.length > 1100) return false;
  return candidate.events.every((event) => {
    const validInstrument = [...TONAL_INSTRUMENTS, ...PERCUSSION_INSTRUMENTS].includes(event.instrument);
    const validPitch = PERCUSSION_INSTRUMENTS.includes(event.instrument)
      ? event.pitch === 0
      : Number.isFinite(event.pitch) && event.pitch >= 24 && event.pitch <= 108;
    return validInstrument
      && Number.isFinite(event.beat)
      && event.beat >= 0
      && event.beat < candidate.totalBeats
      && Number.isFinite(event.duration)
      && event.duration > 0
      && event.duration <= 8
      && validPitch
      && Number.isFinite(event.velocity)
      && event.velocity > 0
      && event.velocity <= 1;
  });
}

function validateWaves(waves) {
  if (!waves || Object.keys(waves).length !== TONAL_INSTRUMENTS.length) return false;
  return TONAL_INSTRUMENTS.every((voice) => OSCILLATOR_TYPES.includes(waves[voice]));
}

function validateVisualProgram(visual, roomId) {
  const preset = VISUAL_PRESETS[roomId];
  if (!visual || visual.schemaVersion !== 1 || !preset) return false;
  if (!VISUAL_SCENES.includes(visual.scene) || visual.scene !== preset.scene) return false;
  if (!VISUAL_STYLES.includes(visual.style) || !preset.styles.includes(visual.style)) return false;
  if (visual.backdrop !== preset.backdrop) return false;
  if (!Array.isArray(visual.palette) || visual.palette.length !== preset.palette.length) return false;
  if (!visual.palette.every((color, index) => /^#[0-9a-f]{6}$/i.test(color) && color === preset.palette[index])) return false;
  return Number.isInteger(visual.variant)
    && visual.variant >= 0
    && visual.variant <= 3
    && Number.isFinite(visual.speed)
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
    musicProfile: activeSession ? MUSIC_PROFILES[activeSession.roomId].name : null,
    melodyProfile: activeSession ? MELODY_PROFILES[activeSession.roomId].name : null,
    tonalVoices: activeSession ? TONAL_INSTRUMENTS.length : 0,
    visualScene: activeSession?.visualProgram.scene || null,
    visualStyle: activeSession?.visualProgram.style || null,
    visualFrames: activeSession?.visualFrames || 0,
    lobbyVisualFrames,
  };
}

if (typeof window !== "undefined") {
  window.__chipcafePlayerDebug = playerDebugState;
}
