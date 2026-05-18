import Meyda from 'meyda'

const WINDOW_SIZE = 2048
const HOP_SIZE = 512
const NUM_MFCC = 13
// Feature vector layout: [mfcc×13, spectralCentroid, zcr, spectralFlux, rms] = 17 values
const VECTOR_LENGTH = 17

function sliceIntoFrames(audioBuffer, windowSize, hopSize) {
  const samples = audioBuffer.getChannelData(0)
  const frames = []
  for (let i = 0; i + windowSize <= samples.length; i += hopSize) {
    frames.push(samples.slice(i, i + windowSize))
  }
  // Always include at least one frame even if buffer is short
  if (frames.length === 0) {
    const padded = new Float32Array(windowSize)
    padded.set(samples.slice(0, Math.min(samples.length, windowSize)))
    frames.push(padded)
  }
  return frames
}

function extractFrameFeatures(frame, prevFrame = null) {
  // spectralFlux needs a previous frame — compute manually if available,
  // otherwise 0 (Meyda's stateless extract throws without prior context)
  const features = Meyda.extract(
    ['mfcc', 'spectralCentroid', 'zcr', 'rms'],
    frame
  )
  if (!features) return null

  const mfcc = features.mfcc || new Array(NUM_MFCC).fill(0)
  const vec = new Float32Array(VECTOR_LENGTH)
  for (let i = 0; i < NUM_MFCC; i++) vec[i] = mfcc[i] ?? 0
  vec[13] = features.spectralCentroid ?? 0
  vec[14] = features.zcr ?? 0
  vec[15] = prevFrame ? spectralFluxBetween(prevFrame, frame) : 0
  vec[16] = features.rms ?? 0
  return vec
}

function averageFrameFeatures(frameVectors) {
  const valid = frameVectors.filter(Boolean)
  if (valid.length === 0) return new Float32Array(VECTOR_LENGTH)

  const sum = new Float32Array(VECTOR_LENGTH)
  for (const v of valid) {
    for (let i = 0; i < VECTOR_LENGTH; i++) sum[i] += v[i]
  }
  for (let i = 0; i < VECTOR_LENGTH; i++) sum[i] /= valid.length
  return sum
}

function zScoreNormalise(vec) {
  const mean = vec.reduce((a, b) => a + b, 0) / vec.length
  const variance = vec.reduce((a, b) => a + (b - mean) ** 2, 0) / vec.length
  const std = Math.sqrt(variance) || 1
  const out = new Float32Array(vec.length)
  for (let i = 0; i < vec.length; i++) out[i] = (vec[i] - mean) / std
  return out
}

// Returns the raw mean feature vector as Float32Array[17].
// We do NOT z-score normalise here — cosine similarity handles scale invariance,
// and z-scoring a mixed-scale vector (MFCCs + centroid in Hz + RMS) produces
// near-zero similarities even for matching sounds.
export async function extractFeatures(audioBuffer) {
  const frames = sliceIntoFrames(audioBuffer, WINDOW_SIZE, HOP_SIZE)
  const frameVectors = frames.map((frame, i) => extractFrameFeatures(frame, i > 0 ? frames[i - 1] : null))
  return averageFrameFeatures(frameVectors)
}

// Alias kept for call-sites that import extractRawFeatures
export const extractRawFeatures = extractFeatures

// ─── Onset detection ───────────────────────────────────────────────────────

function spectralFluxBetween(prevFrame, currFrame) {
  // Sum of positive differences in magnitude spectrum
  const prevMag = new Float32Array(prevFrame.length)
  const currMag = new Float32Array(currFrame.length)
  for (let i = 0; i < prevFrame.length; i++) {
    prevMag[i] = Math.abs(prevFrame[i])
    currMag[i] = Math.abs(currFrame[i])
  }
  let flux = 0
  for (let i = 0; i < currMag.length; i++) {
    const diff = currMag[i] - prevMag[i]
    if (diff > 0) flux += diff
  }
  return flux
}

function peakPick(values, threshold) {
  const peaks = []
  for (let i = 1; i < values.length - 1; i++) {
    if (
      values[i] > threshold &&
      values[i] > values[i - 1] &&
      values[i] > values[i + 1]
    ) {
      peaks.push(i)
    }
  }
  return peaks
}

// Returns array of sample positions (onset times) where new sounds begin
export function detectOnsets(audioBuffer, threshold = 0.3) {
  const frameSize = 512
  const hopSize = 256
  const frames = sliceIntoFrames(audioBuffer, frameSize, hopSize)

  const flux = frames.map((frame, i) =>
    i === 0 ? 0 : spectralFluxBetween(frames[i - 1], frame)
  )

  // Normalise flux
  const maxFlux = Math.max(...flux) || 1
  const normFlux = flux.map(f => f / maxFlux)

  const peakFrames = peakPick(normFlux, threshold)
  // Convert frame indices to sample positions
  return peakFrames.map(idx => idx * hopSize)
}
