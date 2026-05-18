// Feature vector layout (17 values):
// [0–12] MFCCs, [13] spectralCentroid, [14] zcr, [15] spectralFlux, [16] rms
const IDX_CENTROID = 13
const IDX_ZCR      = 14
const IDX_FLUX     = 15
const IDX_RMS      = 16

export function cosineSimilarity(vecA, vecB) {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < vecA.length; i++) {
    dot  += vecA[i] * vecB[i]
    magA += vecA[i] * vecA[i]
    magB += vecB[i] * vecB[i]
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

// Mean of top 60% of similarity scores against a reference set — 0–100.
// Only compares the 13 MFCC dimensions (indices 0-12) — they are all cepstral
// coefficients on comparable scales, so cosine similarity is meaningful.
// The spectral/RMS features (indices 13-16) are reserved for sub-scores only.
// Result is mapped from [-1,1] → [0,100] and clamped so we never show negatives.
export function aggregateSimilarity(attemptVector, referenceVectors) {
  const mfcc = v => Array.from(v).slice(0, 13)
  const scores = referenceVectors
    .map(ref => cosineSimilarity(mfcc(attemptVector), mfcc(ref)))
    .sort((a, b) => b - a)
  const topN = Math.max(1, Math.ceil(scores.length * 0.6))
  const mean = scores.slice(0, topN).reduce((a, b) => a + b, 0) / topN
  // Power curve: mean^1.5 creates real separation between correct (0.85→78)
  // and wrong sounds (0.65→52, 0.50→35). Linear was too forgiving.
  return Math.round(Math.max(0, Math.min(100, Math.pow(Math.max(0, mean), 1.5) * 100)))
}

// ─── Sub-score helpers ──────────────────────────────────────────────────────
// Each returns 0–100 based on how closely the attempt matches the reference mean.

function ratioScore(attemptVal, refMean) {
  if (refMean === 0) return 50
  const ratio = attemptVal / refMean
  // Score peaks at ratio=1, falls off symmetrically. Clamp to [0,1].
  const deviation = Math.abs(ratio - 1)
  return Math.round(Math.max(0, 1 - deviation) * 100)
}

// brightness: spectral centroid vs reference mean centroid
export function brightnessScore(attemptRaw, referenceRaws) {
  const refMean = referenceRaws.reduce((s, v) => s + v[IDX_CENTROID], 0) / referenceRaws.length
  return ratioScore(attemptRaw[IDX_CENTROID], refMean)
}

// sharpness: spectral flux vs reference mean flux (onset energy)
export function sharpnessScore(attemptRaw, referenceRaws) {
  const refMean = referenceRaws.reduce((s, v) => s + v[IDX_FLUX], 0) / referenceRaws.length
  return ratioScore(attemptRaw[IDX_FLUX], refMean)
}

// volume: RMS vs reference mean RMS
export function volumeScore(attemptRaw, referenceRaws) {
  const refMean = referenceRaws.reduce((s, v) => s + v[IDX_RMS], 0) / referenceRaws.length
  return ratioScore(attemptRaw[IDX_RMS], refMean)
}

// ─── Full scored result ─────────────────────────────────────────────────────

// Returns { overall, soundMatch, brightness, sharpness, volume, feedback }
// attemptVec: z-score normalised Float32Array[17]
// attemptRaw: unnormalised Float32Array[17]
// referenceVecs: array of z-score normalised vectors
// referenceRaws: array of unnormalised vectors
export function scoreFull(attemptVec, attemptRaw, referenceVecs, referenceRaws) {
  const soundMatch = aggregateSimilarity(attemptVec, referenceVecs)
  const brightness = brightnessScore(attemptRaw, referenceRaws)
  const sharpness  = sharpnessScore(attemptRaw, referenceRaws)
  const volume     = volumeScore(attemptRaw, referenceRaws)

  // overall = soundMatch weighted most heavily
  const overall = Math.round(soundMatch * 0.6 + brightness * 0.15 + sharpness * 0.15 + volume * 0.1)

  return {
    overall,
    soundMatch,
    brightness,
    sharpness,
    volume,
    feedback: buildFeedback({ soundMatch, brightness, sharpness, volume, attemptRaw, referenceRaws })
  }
}

function buildFeedback({ soundMatch, brightness, sharpness, volume, attemptRaw, referenceRaws }) {
  const lines = []

  if (soundMatch >= 72) {
    lines.push("Great match — your sound closely resembles the reference.")
  } else if (soundMatch >= 48) {
    lines.push("You're getting the right idea. Keep refining the core technique.")
  } else if (soundMatch >= 25) {
    lines.push("Recognisable, but your sound needs more work to match the target.")
  } else {
    lines.push("This doesn't match the target sound yet — focus on the technique cues.")
  }

  const refCentroidMean = referenceRaws.reduce((s, v) => s + v[IDX_CENTROID], 0) / referenceRaws.length
  const centroidRatio = refCentroidMean > 0 ? attemptRaw[IDX_CENTROID] / refCentroidMean : 1
  if (centroidRatio > 1.3) {
    lines.push("Your sound is too bright — there's excess high-frequency hiss. Try pushing air from your chest rather than letting it escape through your teeth.")
  } else if (centroidRatio < 0.7) {
    lines.push("Your sound is too dark — lacking high-frequency presence. Open your mouth slightly more and let more air through.")
  }

  const refFluxMean = referenceRaws.reduce((s, v) => s + v[IDX_FLUX], 0) / referenceRaws.length
  const fluxRatio = refFluxMean > 0 ? attemptRaw[IDX_FLUX] / refFluxMean : 1
  if (fluxRatio < 0.5) {
    lines.push("Your attack is too soft — the sound needs a sharper, more percussive onset. Snap or pop rather than easing in.")
  } else if (fluxRatio > 2) {
    lines.push("Your attack is very strong — that's good energy, but ensure the sustain follows cleanly.")
  }

  const refRmsMean = referenceRaws.reduce((s, v) => s + v[IDX_RMS], 0) / referenceRaws.length
  const rmsRatio = refRmsMean > 0 ? attemptRaw[IDX_RMS] / refRmsMean : 1
  if (rmsRatio < 0.4) {
    lines.push("Your volume is low — move closer to the mic and use more air pressure.")
  } else if (rmsRatio > 2.5) {
    lines.push("Your volume is very high — back off the mic slightly to avoid clipping.")
  }

  return lines.join(' ')
}
