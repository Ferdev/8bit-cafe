// Tempo and beat-grid detection for the auto-DJ. The engine decodes the
// first minutes of a track at a low sample rate, builds an onset envelope,
// finds the beat period by autocorrelation, then refines period and phase
// with a comb search so two decks can be locked on the same grid.

const FRAME_RATE = 100;
const ANALYSIS_RATE = 11025;
const ANALYSIS_BYTES = 2500000;
const MIN_BPM = 84;
const MAX_BPM = 176;

const cache = new Map();

// Onset strength at about 100 frames per second from mono samples. The
// exact frame rate is sampleRate / hop and travels with the envelope.
export function onsetEnvelope(samples, sampleRate) {
  const hop = Math.max(1, Math.round(sampleRate / FRAME_RATE));
  const frameRate = sampleRate / hop;
  const frames = Math.floor(samples.length / hop);
  const energy = new Float32Array(frames);
  let low = 0;
  for (let f = 0; f < frames; f += 1) {
    let full = 0;
    let bass = 0;
    for (let i = f * hop; i < (f + 1) * hop; i += 1) {
      const s = samples[i];
      low += (s - low) * 0.06;
      full += s * s;
      bass += low * low;
    }
    energy[f] = Math.log1p(1000 * (full / hop)) + 2 * Math.log1p(1000 * (bass / hop));
  }
  const onset = new Float32Array(frames);
  for (let f = 1; f < frames; f += 1) onset[f] = Math.max(0, energy[f] - energy[f - 1]);
  // Remove the local mean so loud passages do not dominate.
  const half = Math.round(frameRate / 2);
  const out = new Float32Array(frames);
  let sum = 0;
  for (let f = 0; f < Math.min(frames, half); f += 1) sum += onset[f];
  for (let f = 0; f < frames; f += 1) {
    if (f + half < frames) sum += onset[f + half];
    if (f - half - 1 >= 0) sum -= onset[f - half - 1];
    const count = Math.min(frames - 1, f + half) - Math.max(0, f - half) + 1;
    out[f] = Math.max(0, onset[f] - sum / count);
  }
  return { envelope: out, frameRate };
}

function sampleAt(envelope, frame) {
  const i = Math.floor(frame);
  if (i < 0 || i + 1 >= envelope.length) return 0;
  const t = frame - i;
  return envelope[i] * (1 - t) + envelope[i + 1] * t;
}

function combScore(envelope, periodFrames, phaseFrames) {
  let total = 0;
  for (let f = phaseFrames; f < envelope.length - 1; f += periodFrames) total += sampleAt(envelope, f);
  return total;
}

// Returns { bpm, period, offset, confidence } with period and offset in
// seconds, or null when the envelope has no clear pulse.
export function detectTempo({ envelope, frameRate }) {
  const frames = envelope.length;
  if (frames < frameRate * 12) return null;

  const minLag = Math.floor((60 * frameRate) / MAX_BPM);
  const maxLag = Math.ceil((60 * frameRate) / MIN_BPM);
  const corr = new Float32Array(maxLag * 2 + 2);
  for (let lag = Math.floor(minLag / 2); lag <= maxLag * 2 && lag < frames; lag += 1) {
    let total = 0;
    for (let f = 0; f + lag < frames; f += 1) total += envelope[f] * envelope[f + lag];
    corr[lag] = total / (frames - lag);
  }

  let bestLag = 0;
  let bestScore = -1;
  let scoreSum = 0;
  let scoreCount = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    const bpm = (60 * frameRate) / lag;
    // Reward lags whose double and half also line up, and lean slightly
    // towards the 100-150 BPM range most chiptune sits in.
    const harmonic = corr[lag] + 0.5 * (corr[lag * 2] || 0) + 0.25 * (corr[Math.round(lag / 2)] || 0);
    const prior = 1 - 0.12 * Math.min(1, Math.abs(Math.log2(bpm / 125)));
    const score = harmonic * prior;
    scoreSum += score;
    scoreCount += 1;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  if (bestLag === 0 || bestScore <= 0) return null;
  const confidence = bestScore / (scoreSum / scoreCount);

  // Fine search on period and phase with a comb over the whole envelope.
  let best = { score: -1, period: bestLag, phase: 0 };
  for (let period = bestLag * 0.97; period <= bestLag * 1.03; period += 0.01) {
    for (let phase = 0; phase < period; phase += 1) {
      const score = combScore(envelope, period, phase);
      if (score > best.score) best = { score, period, phase };
    }
  }
  for (let phase = best.phase - 1; phase <= best.phase + 1; phase += 0.1) {
    const score = combScore(envelope, best.period, phase);
    if (score > best.score) best = { ...best, score, phase };
  }

  let period = best.period / frameRate;
  // Very slow readings are almost always half-time drums.
  if (60 / period < 92) period /= 2;
  // The onset peak sits one frame after the hit.
  let offset = (best.phase - 1) / frameRate;
  while (offset < 0) offset += period;
  return {
    bpm: 60 / period,
    period,
    offset,
    confidence,
  };
}

// The playback rate that puts a track at toBpm on a grid running at
// fromBpm, or null when the tempos are too far apart to blend. Half-time
// and double-time matches count. When lockRate is set (a "no derivatives"
// license on either side), only a near-exact tempo match syncs and the
// rate stays 1, because time-stretching would create a derivative.
export function syncRate(fromBpm, toBpm, lockRate = false) {
  if (!fromBpm || !toBpm) return null;
  const range = lockRate ? 0.004 : 0.08;
  let rate = null;
  for (const multiple of [1, 2, 0.5]) {
    const candidate = fromBpm / (toBpm * multiple);
    if (Math.abs(candidate - 1) < range && (!rate || Math.abs(candidate - 1) < Math.abs(rate - 1))) {
      rate = candidate;
    }
  }
  if (!rate) return null;
  return lockRate ? 1 : rate;
}

// The index of the candidate whose tempo sits closest to fromBpm, or -1
// when no candidate can be beatmatched. Candidates are { index, bpm,
// lockRate }; a bpm of 0 means "no beat grid" and never matches. The DJ
// walks the playlist with this, so the next track is chosen for its tempo
// and not only for its place in the feed order.
export function pickNextByTempo(candidates, fromBpm) {
  let best = -1;
  let bestOff = Infinity;
  for (const candidate of candidates) {
    const rate = syncRate(fromBpm, candidate.bpm, Boolean(candidate.lockRate));
    if (rate === null) continue;
    // A locked rate reports 1, so measure its distance from the raw tempos.
    const off = candidate.lockRate
      ? Math.abs(fromBpm / candidate.bpm - 1)
      : Math.abs(rate - 1);
    if (off < bestOff) {
      bestOff = off;
      best = candidate.index;
    }
  }
  return best;
}

async function decodeHead(url) {
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const decode = async (data) => {
    const ctx = new Offline(1, 1, ANALYSIS_RATE);
    const audio = await ctx.decodeAudioData(data);
    return audio.getChannelData(0);
  };
  const response = await fetch(url, { headers: { Range: `bytes=0-${ANALYSIS_BYTES - 1}` } });
  if (!response.ok) throw new Error(`analysis fetch ${response.status}`);
  const data = await response.arrayBuffer();
  try {
    return await decode(data);
  } catch (_error) {
    // Some formats refuse to decode from a truncated file. Fetch the whole
    // track once and decode that, so the track still gets a beat grid.
    const full = await fetch(url);
    if (!full.ok) throw new Error(`analysis fetch ${full.status}`);
    return decode(await full.arrayBuffer());
  }
}

// Analyses a track once and caches the promise. Never rejects.
export function analyseTrack(id, url) {
  if (!url) return Promise.resolve(null);
  if (cache.has(id)) return cache.get(id).promise;
  const entry = { result: undefined, promise: null };
  entry.promise = decodeHead(url)
    .then((samples) => detectTempo(onsetEnvelope(samples, ANALYSIS_RATE)))
    .then((tempo) => (tempo && tempo.confidence > 1.15 ? tempo : null))
    .catch(() => null)
    .then((tempo) => {
      entry.result = tempo;
      return tempo;
    });
  cache.set(id, entry);
  return entry.promise;
}

// The finished analysis, or undefined while it is still running.
export function tempoFor(id) {
  const entry = cache.get(id);
  return entry ? entry.result : undefined;
}
