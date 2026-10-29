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

// --------------------------------------------------------------------- key

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const KEY_PROFILES = {
  major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
  minor: [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
};
const SCALE_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

export function keyName(key) {
  if (!key) return "";
  return `${NOTE_NAMES[key.tonic]} ${key.mode.toUpperCase()}`;
}

function correlation(left, right) {
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  let top = 0;
  let leftSq = 0;
  let rightSq = 0;
  for (let i = 0; i < left.length; i += 1) {
    const a = left[i] - leftMean;
    const b = right[i] - rightMean;
    top += a * b;
    leftSq += a * a;
    rightSq += b * b;
  }
  return leftSq > 0 && rightSq > 0 ? top / Math.sqrt(leftSq * rightSq) : 0;
}

// Estimates the musical key from decoded mono samples. Each frame gets a
// chroma vector from Goertzel filters on MIDI notes 36-83. Harmonic
// weights come down, so a square-wave fifth does not read as a new tonic.
// The best Krumhansl profile by correlation is the key. Returns null when
// the sound has too little pitch data.
export function detectKey(samples, sampleRate) {
  const frameSize = 8192;
  const maxSamples = Math.min(samples.length, Math.floor(sampleRate * 75));
  const chroma = new Float64Array(12);
  const notes = [];
  for (let midi = 36; midi <= 83; midi += 1) {
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    notes.push({ midi, coeff: 2 * Math.cos((2 * Math.PI * freq) / sampleRate) });
  }
  const window = new Float64Array(frameSize);
  let frames = 0;
  for (let start = 0; start + frameSize <= maxSamples; start += frameSize) {
    let squareSum = 0;
    for (let i = 0; i < frameSize; i += 1) {
      const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frameSize - 1));
      const value = samples[start + i] * hann;
      window[i] = value;
      squareSum += samples[start + i] * samples[start + i];
    }
    if (Math.sqrt(squareSum / frameSize) < 0.01) continue;
    frames += 1;

    const magnitudes = new Float64Array(notes.length);
    for (let n = 0; n < notes.length; n += 1) {
      const { coeff } = notes[n];
      let s1 = 0;
      let s2 = 0;
      for (let i = 0; i < frameSize; i += 1) {
        const s0 = window[i] + coeff * s1 - s2;
        s2 = s1;
        s1 = s0;
      }
      const power = Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2);
      magnitudes[n] = Math.sqrt(power) / frameSize;
    }
    for (let n = 0; n < notes.length; n += 1) {
      let value = magnitudes[n];
      if (n >= 19) value -= 0.3 * magnitudes[n - 19];
      if (n >= 28) value -= 0.18 * magnitudes[n - 28];
      if (n >= 31) value -= 0.12 * magnitudes[n - 31];
      if (value <= 0) continue;
      const midi = notes[n].midi;
      const weight = midi < 48 ? 1.15 : midi > 72 ? 0.75 : 1;
      chroma[midi % 12] += Math.pow(value, 1.2) * weight;
    }
  }
  const total = chroma.reduce((sum, value) => sum + value, 0);
  if (frames < 4 || total <= 0) return null;
  const normalized = Array.from(chroma, (value) => value / total);

  const candidates = [];
  for (const mode of ["major", "minor"]) {
    const profile = KEY_PROFILES[mode];
    for (let tonic = 0; tonic < 12; tonic += 1) {
      // Correlate in tonic order: rotate the chroma to the tonic.
      const chromaAtTonic = normalized.map((_, i) => normalized[(i + tonic) % 12]);
      candidates.push({ tonic, mode, score: correlation(chromaAtTonic, profile) });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best || best.score < 0.45) return null;
  return {
    tonic: best.tonic,
    mode: best.mode,
    confidence: best.score,
    margin: best.score - (candidates[1] ? candidates[1].score : 0),
  };
}

function scalePitchClasses(key) {
  return new Set(SCALE_INTERVALS[key.mode].map((step) => (key.tonic + step) % 12));
}

// How many scale notes two keys do not share, counted on both sides.
// Same key and relative major/minor give 0. A fifth step gives 2. A
// tritone gives a high count. Null means one key is unknown.
export function harmonicDistance(left, right) {
  if (!left || !right) return null;
  const a = scalePitchClasses(left);
  const b = scalePitchClasses(right);
  let distance = 0;
  for (const note of a) if (!b.has(note)) distance += 1;
  for (const note of b) if (!a.has(note)) distance += 1;
  return distance;
}

// Mean loudness of the decoded head. It gives the DJ a simple guard
// against a hard jump from a quiet track to a loud one in a long overlap.
export function trackEnergy(samples) {
  if (!samples.length) return 0;
  let squareSum = 0;
  for (let i = 0; i < samples.length; i += 1) squareSum += samples[i] * samples[i];
  return Math.sqrt(squareSum / samples.length);
}

function tempoDistance(fromBpm, toBpm) {
  const raw = Math.abs(Math.log2(fromBpm / toBpm));
  return Math.min(raw, Math.abs(raw - 1));
}

// Full pair fit for two analysed tracks: sync rate, key distance and
// energy ratio. longMix is true only when all three fit well. Score is
// low for a good next track. Returns null when the tempos cannot sync.
export function pairCompatibility(from, to, lockRate = false) {
  if (!from || !to) return null;
  const rate = syncRate(from.bpm, to.bpm, lockRate);
  if (rate === null) return null;
  const harmonic = harmonicDistance(from.key, to.key);
  const energyRatio = from.energy > 0 && to.energy > 0 ? to.energy / from.energy : null;
  const keyConfidence = Math.min(
    from.key ? from.key.confidence : 0,
    to.key ? to.key.confidence : 0,
  );
  const score =
    tempoDistance(from.bpm, to.bpm) * 4 +
    (harmonic === null ? 1.2 : harmonic * 0.28) +
    (energyRatio === null ? 0.15 : Math.abs(Math.log(energyRatio)) * 0.45);
  const longMix =
    harmonic !== null &&
    harmonic <= 2 &&
    keyConfidence >= 0.55 &&
    tempoDistance(from.bpm, to.bpm) <= 0.09 &&
    (energyRatio === null || (energyRatio >= 0.6 && energyRatio <= 1.7));
  return { rate, harmonic, energyRatio, keyConfidence, score, longMix };
}

// True when one candidate can share a long overlap with the current track.
export function hasLongMix(candidates, from) {
  return candidates.some((candidate) => {
    const fit = pairCompatibility(from, candidate, Boolean(candidate.lockRate));
    return Boolean(fit && fit.longMix);
  });
}

// The candidate that fits the current track best as a full pair. A long
// mix fit wins first. Then key distance wins over a small tempo gain.
export function pickNextByFit(candidates, from) {
  let best = -1;
  let bestRank = null;
  for (const candidate of candidates) {
    const fit = pairCompatibility(from, candidate, Boolean(candidate.lockRate));
    if (!fit) continue;
    const rank = [fit.longMix ? 0 : 1, fit.harmonic === null ? 99 : fit.harmonic, fit.score];
    if (
      !bestRank ||
      rank[0] < bestRank[0] ||
      (rank[0] === bestRank[0] && rank[1] < bestRank[1]) ||
      (rank[0] === bestRank[0] && rank[1] === bestRank[1] && rank[2] < bestRank[2])
    ) {
      bestRank = rank;
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
    .then((samples) => {
      const tempo = detectTempo(onsetEnvelope(samples, ANALYSIS_RATE));
      if (!tempo || tempo.confidence <= 1.15) return null;
      return {
        ...tempo,
        key: detectKey(samples, ANALYSIS_RATE),
        energy: trackEnergy(samples),
      };
    })
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
