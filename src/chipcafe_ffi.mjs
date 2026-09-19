import { choice, TypeSafeClient } from "@typesafe-ai/sdk";
import {
  ART_DIRECTIONS, composeVisualProgram, createVisualProgram,
  describeVisualProgram, renderPixelScene, validateVisualProgram,
  visualChoiceCriteria,
} from "./chipcafe_art.mjs";

const favoriteKey = "8bit-cafe.favorite-room";
const STARTUP_BUFFER_SECONDS = 12;
const REFILL_LOW_WATER_SECONDS = 12;
const REQUEST_TIMEOUT_MS = 6000;
const BARS_PER_BLOCK = 16;
const BEATS_PER_BAR = 4;
const TONAL_INSTRUMENTS = Object.freeze(["lead", "counter", "arp", "pulse", "pad", "bass", "stab", "texture"]);
const PERCUSSION_INSTRUMENTS = Object.freeze(["kick", "snare", "hat"]);
const OSCILLATOR_TYPES = Object.freeze(["sine", "square", "sawtooth", "triangle"]);
const LAYERED_INSTRUMENTS = new Set(["pad", "stab", "texture"]);

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
  cvgm: melodyProfile("neon signal", 0.5, 0.74, [0, null, 0, 7, null, 5, 4, null, 2, 4, 5, null, 9, 7, null, 2], [4, null, 4, 11, null, 9, 7, null, 5, 4, 2, null, 0, 2, 4, null]),
  rainwave: melodyProfile("harbor lights", 1, 0.92, [0, null, 4, 2, null, 5, 4, null], [2, 4, null, 7, 5, null, 2, 0], ["ballad", "wide rests"]),
  nectarine: melodyProfile("firefly dance", 0.5, 0.58, [0, 4, null, 2, 5, null, 7, 4, null, 2, 0, 2, null, 5, 4, null], [4, 7, null, 5, 9, null, 7, 5, 4, null, 2, 5, null, 4, 2, 0]),
  slay: melodyProfile("citadel call", 0.5, 0.84, [0, 0, null, 7, 6, 6, null, 3, 0, null, 8, 7, 5, null, 3, 2], [5, 5, null, 12, 11, 8, null, 7, 3, null, 10, 8, 7, 5, 3, 0]),
  kaaos: melodyProfile("pocket hero", 0.25, 0.52, [0, null, 2, 4, 7, 4, 2, null, 0, 2, 4, null, 5, 7, 9, null, 7, 5, 4, 2, 4, null, 0, null, 2, 4, 5, 2, 0, null, null, null], [4, null, 5, 7, 11, 7, 5, null, 4, 5, 7, null, 9, 11, 12, null, 9, 7, 5, 4, 2, null, 0, null, 2, 4, 7, 5, 4, 2, 0, null]),
  kohina: melodyProfile("distant beacon", 1, 0.94, [0, null, null, 5, null, 2, null, null], [7, null, 4, null, null, 2, 0, null], ["ambient", "long tones"]),
  "keygen-fm": melodyProfile("unlock sequence", 0.25, 0.48, [0, 3, 7, 10, 7, 3, 0, null, 2, 5, 8, 12, 8, 5, 2, null, 3, 7, 10, 14, 10, 7, 3, null, 5, 8, 12, 15, 12, 8, 5, null], [7, 10, 14, 17, 14, 10, 7, null, 5, 8, 12, 15, 12, 8, 5, null, 3, 7, 10, 14, 10, 7, 3, null, 2, 5, 8, 12, 8, 5, 3, 0]),
  "sid-station": melodyProfile("sid invocation", 0.5, 0.62, [0, null, 3, null, 2, 5, null, 3, 0, 0, null, 7, 5, null, 3, 2], [3, null, 7, 5, null, 8, 7, null, 3, 2, null, 5, 3, 0, null, 2]),
  rpgn: melodyProfile("road to dawn", 1, 0.9, [0, 2, 4, null, 7, 5, 4, 2], [4, 5, 7, 9, 11, 9, 7, null], ["anthem", "broad phrases"]),
  radiosega: melodyProfile("final lap", 0.25, 0.56, [0, 2, 4, 7, 9, 7, 4, 2, 5, null, 9, 12, 11, 9, 7, null, 4, 5, 7, 9, 12, 9, 7, 5, 2, 4, 5, 7, 9, 11, 12, null], [7, 9, 11, 14, 12, 11, 9, 7, 5, null, 9, 12, 14, 12, 9, null, 7, 5, 4, 2, 0, 2, 4, 5, 7, 9, 7, 5, 4, 2, 0, null]),
  "gtt-radio": melodyProfile("bonus round", 0.5, 0.5, [0, 7, null, 4, 2, 9, null, 5, 4, 11, 9, null, 2, 7, 5, null], [4, 12, null, 9, 7, 14, null, 11, 9, 5, 7, null, 4, 2, 0, null]),
  ericade: melodyProfile("demo anthem", 0.25, 0.46, [0, 3, 5, null, 10, 8, 7, null, 3, 5, 7, 10, 12, null, 10, 8, 7, 5, 3, null, 0, 3, 7, null, 8, 10, 12, 15, 12, 10, 8, null], [5, 7, 8, null, 15, 12, 10, null, 8, 10, 12, 15, 17, null, 15, 12, 10, 8, 7, null, 3, 5, 8, null, 10, 12, 15, 12, 10, 8, 5, 3]),
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

function melodyProfile(name, stepBeats, gate, phraseA, phraseB, character = []) {
  return Object.freeze({
    name,
    stepBeats,
    gate,
    phraseA: Object.freeze(phraseA),
    phraseB: Object.freeze(phraseB),
    character: Object.freeze(character),
  });
}

let audioContext = null;
let masterGain = null;
let activeSession = null;
let lobbyVisualFrame = null;
let lobbyVisualFrames = 0;
let sessionSequence = 0;
let cachedClient = null;
let cachedClientKey = "";
let noiseBuffer = null;
const rememberedVisualPrograms = new Map();

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
    visualProgram: rememberedVisualPrograms.get(roomId) || createVisualProgram(roomId),
    visualProvenance: "local",
    visualStartTime: context.currentTime,
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
    rememberedVisualPrograms.get(roomId) || createVisualProgram(roomId),
  ]));
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  let lastPaint = 0;

  const render = (timestamp) => {
    if (timestamp - lastPaint >= 80 || lastPaint === 0) {
      const elapsed = reduceMotion ? 0 : Math.max(0, (timestamp - startedAt) / 1000);
      for (const canvas of document.querySelectorAll("canvas.room-art[data-room-id]")) {
        const roomId = canvas.dataset.roomId;
        const program = programs[roomId];
        if (program) renderPixelScene(canvas, program, elapsed);
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
  const candidates = buildCandidates(session.roomId, index);

  let selected = selectLocalCandidate(candidates, session.roomId, index);
  let provenance = "local";
  try {
    const decisions = await chooseWithJev(session, candidates);
    const chosen = candidates.find((candidate) => candidate.id === decisions.continuation);
    if (chosen) {
      selected = { ...chosen, visual: composeVisualProgram(chosen.visual, decisions) };
      const options = visualChoiceCriteria(session.roomId);
      selected.visualProvenance = ["setting", "cast", "atmosphere"]
        .every((key) => Object.hasOwn(options[key], decisions[key])) ? "jev" : "local";
      provenance = "jev";
    }
  } catch (_error) {
    // The local choice is already valid and keeps the audio queue moving.
  } finally {
    session.requestInFlight = false;
  }

  session.blockIndex += 1;
  session.previousSummary = selected.summary + "; art: " + describeVisualProgram(selected.visual);
  return { block: selected, provenance };
}

async function chooseWithJev(session, candidates) {
  const config = browserConfig();
  const testProvider = globalThis.__chipcafeJevDecide;
  const criteria = Object.fromEntries(
    candidates.map((candidate) => [candidate.id, candidate.summary]),
  );
  const visualCriteria = visualChoiceCriteria(session.roomId);
  const state = {
    role: "You are composing original chiptune and a detailed 8-bit sprite scene from an authored art library.",
    room: session.preset.name,
    tempo: session.preset.tempo,
    energy: session.preset.energy,
    music_profile: MUSIC_PROFILES[session.roomId].name,
    melody_profile: MELODY_PROFILES[session.roomId].name,
    available_voices: [...TONAL_INSTRUMENTS],
    visual_scene: ART_DIRECTIONS[session.roomId].scene,
    previous_visual: session.visualProgram,
    previous_block: session.previousSummary,
    goal: "Preserve the recognizable melody. Independently compose a coherent setting, cast of characters, and atmosphere. Keep the room recognizable and favor small changes between blocks.",
  };

  session.apiCalls += 1;
  if (typeof testProvider === "function") {
    return withDeadline(
      Promise.resolve(testProvider({ state, criteria, visualCriteria, roomId: session.roomId })),
      session,
    );
  }

  if (!config.typesafeApiKey) throw new Error("Jev is not configured");
  const client = typesafeClient(config);
  const questions = {
    continuation: choice(
      "Which musical arrangement best continues this stage?",
      criteria,
    ),
    setting: choice("Which setting should the sprite scene use?", visualCriteria.setting),
    cast: choice("Which characters should inhabit the scene?", visualCriteria.cast),
    atmosphere: choice("Which ambient animation best fits the room and music?", visualCriteria.atmosphere),
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
  return Object.fromEntries(["continuation", "setting", "cast", "atmosphere"].map((key) => [
    key, response.answers[key]?.choice,
  ]));
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
    session.visualProvenance = block.visualProvenance || "local";
    rememberedVisualPrograms.set(session.roomId, block.visual);
    session.visualStartTime = startTime;
    if (session.reduceMotion) drawVisualFrame(session);
  }, delay);
  session.timeouts.add(timeout);
}

function startVisualRenderer(session) {
  drawVisualFrame(session);
  if (session.reduceMotion) return;

  let lastPaint = 0;
  const render = (timestamp) => {
    if (!isActive(session)) return;
    if (timestamp - lastPaint >= 80 || lastPaint === 0) {
      drawVisualFrame(session);
      lastPaint = timestamp;
    }
    session.visualFrame = window.requestAnimationFrame(render);
  };
  session.visualFrame = window.requestAnimationFrame(render);
}

function drawVisualFrame(session) {
  const canvas = document.querySelector("canvas.room-visual");
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const elapsed = Math.max(0, (audioContext?.currentTime || 0) - session.visualStartTime);
  renderPixelScene(canvas, session.visualProgram, session.reduceMotion ? 0 : elapsed);
  session.visualFrames += 1;
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

export function buildCandidates(roomId, blockIndex) {
  const roomPreset = PRESETS[roomId];
  if (!roomPreset) return [];
  return Array.from({ length: 8 }, (_, candidateIndex) =>
    generateCandidate(roomId, roomPreset, blockIndex, candidateIndex),
  );
}

function generateCandidate(roomId, roomPreset, blockIndex, candidateIndex) {
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

    const melodyStepsPerBar = Math.round(BEATS_PER_BAR / melody.stepBeats);
    for (let step = 0; step < melodyStepsPerBar; step += 1) {
      const phraseIndex = (bar % 2) * melodyStepsPerBar + step;
      const degree = phrase[phraseIndex];
      if (degree === null) continue;
      const octaveLift = section === 3 && variation === 2 ? 12 : 0;
      const leadPitch = scalePitch(roomPreset, degree, 1) + octaveLift;
      const duration = melodyNoteDuration(melody, phrase, phraseIndex);
      const melodySwing = melody.stepBeats < 1 && step % 2 ? profile.swing : 0;
      events.push(note("lead", barBeat + step * melody.stepBeats + melodySwing, duration, leadPitch, Math.min(1, (0.5 + roomPreset.energy * 0.18) * sectionEnergy)));
    }

    for (let beat = 0; beat < BEATS_PER_BAR; beat += 1) {
      const pulseDegree = chordDegree + ((beat + variation) % 3) * 2;
      if (section > 0 || beat % 2 === 0) {
        events.push(note("pulse", barBeat + beat + profile.swing, 0.22, scalePitch(roomPreset, pulseDegree, 2), Math.min(1, (0.24 + roomPreset.energy * 0.11) * sectionEnergy)));
      }
    }

    for (const offset of [1.5, 3.5]) {
      if ((section > 0 || bar === 1) && random() < profile.counterDensity + section * 0.07) {
        const answerIndex = (bar % 2) * melodyStepsPerBar + Math.round(offset / melody.stepBeats);
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
  const visual = createVisualProgram(roomId, blockIndex, candidateIndex);
  const id = `option_${candidateIndex}`;
  const hookSummary = melody.phraseA.map((degree) => degree === null ? "r" : degree).join("-");
  const summary = `${profile.name} ${profile.groove} arrangement built around the repeating ${melody.name} melody (${hookSummary}) on a ${melody.stepBeats}-beat grid${melody.character.length ? ` with ${melody.character.join(" and ")}` : ""}, with eight tonal voices, ${arrangement}, intro/theme/lift/chorus/finale form, extended progression ${progression.join("-")}, and energy ${roomPreset.energy.toFixed(2)}; preserves the recurring hook`;
  return {
    schemaVersion: 1,
    id,
    roomId,
    blockIndex,
    tempo: roomPreset.tempo,
    totalBeats,
    profile: profile.name,
    melody: melody.name,
    melodyStep: melody.stepBeats,
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

function melodyNoteDuration(melody, phrase, index) {
  let steps = 1;
  while (steps < 4 && phrase[index + steps] === null) steps += 1;
  return Math.max(0.12, steps * melody.stepBeats * melody.gate);
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
  if (candidate.melodyStep !== melody.stepBeats) return false;
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
    visualSetting: activeSession?.visualProgram.setting || null,
    visualCast: activeSession?.visualProgram.cast || null,
    visualAtmosphere: activeSession?.visualProgram.atmosphere || null,
    visualProvenance: activeSession?.visualProvenance || null,
    visualFrames: activeSession?.visualFrames || 0,
    lobbyVisualFrames,
  };
}

if (typeof window !== "undefined") {
  window.__chipcafePlayerDebug = playerDebugState;
}
