import { detectOnsets, extractFeatures, extractRawFeatures } from './analyser.js'
import { cosineSimilarity } from './similarity.js'

// ─── Timing score ─────────────────────────────────────────────────────────────
// Returns 0–100 based on how close the detected onset is to the expected time.
// Window: ±200ms = full credit decay, >400ms = 0
function timingScore(detectedSec, expectedSec) {
  const diffMs = Math.abs(detectedSec - expectedSec) * 1000
  if (diffMs <= 50)  return 100
  if (diffMs <= 200) return Math.round(100 - ((diffMs - 50) / 150) * 50)  // 100→50
  if (diffMs <= 400) return Math.round(50  - ((diffMs - 200) / 200) * 50) // 50→0
  return 0
}

// ─── Hit-to-step mapper ───────────────────────────────────────────────────────
// Maps each detected onset (sample position) to the nearest expected step time.
// Returns array of { stepIndex, detectedSec, expectedSec, timingScore }
export function mapHitsToSteps(onsetSamples, sampleRate, stepDurationSec, stepCount) {
  const expectedTimes = Array.from({ length: stepCount }, (_, i) => i * stepDurationSec)
  const hits = []

  for (const samplePos of onsetSamples) {
    const detectedSec = samplePos / sampleRate

    // Find nearest expected step
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < expectedTimes.length; i++) {
      const dist = Math.abs(detectedSec - expectedTimes[i])
      if (dist < bestDist) { bestDist = dist; bestIdx = i }
    }

    hits.push({
      stepIndex:    bestIdx,
      detectedSec,
      expectedSec:  expectedTimes[bestIdx],
      timingScore:  timingScore(detectedSec, expectedTimes[bestIdx]),
    })
  }

  return hits
}

// ─── Per-hit sound scoring ────────────────────────────────────────────────────
// Slices the recording around each onset, extracts features, compares to
// the reference vectors for the expected symbol.
// referenceMap: Map<symbol, Float32Array[]>  (pre-fetched feature vectors)
// Returns hits array with soundScore added to each entry.
export async function scoreHits(audioBuffer, hits, steps, referenceMap) {
  const sr  = audioBuffer.sampleRate
  const WIN = Math.round(sr * 0.15)   // 150ms window per hit

  const scored = []
  for (const hit of hits) {
    const symbol = steps[hit.stepIndex]
    const refs   = referenceMap.get(symbol)

    if (!refs || refs.length === 0 || symbol === '-') {
      scored.push({ ...hit, soundScore: null, symbol })
      continue
    }

    // Slice hit window from full buffer
    const startSample = Math.max(0, Math.round(hit.detectedSec * sr))
    const endSample   = Math.min(audioBuffer.length, startSample + WIN)

    const slicedBuffer = sliceAudioBuffer(audioBuffer, startSample, endSample)
    let soundScore = 0

    try {
      const vec = await extractFeatures(slicedBuffer)
      const mfcc = v => Array.from(v).slice(0, 13)
      const similarities = refs.map(r => cosineSimilarity(mfcc(vec), mfcc(r)))
      const topN = Math.max(1, Math.ceil(similarities.length * 0.6))
      const sorted = [...similarities].sort((a, b) => b - a)
      const mean = sorted.slice(0, topN).reduce((a, b) => a + b, 0) / topN
      soundScore = Math.round(Math.max(0, Math.min(100, Math.pow(Math.max(0, mean), 1.5) * 100)))
    } catch {
      soundScore = 0
    }

    scored.push({ ...hit, soundScore, symbol })
  }

  return scored
}

// ─── Aggregate sequence score ─────────────────────────────────────────────────
// overall = soundScore × 0.6 + timingScore × 0.4 (spec Section 10.3)
// Only counts steps that have a non-rest symbol.
export function aggregateSequenceScore(scoredHits, steps) {
  const nonRestSteps = steps.filter(s => s !== '-').length
  if (nonRestSteps === 0) return { overall: 0, timingScore: 0, soundScore: 0, perHit: scoredHits }

  // Build a per-step result (use best hit per step if multiple mapped to same)
  const perStep = new Map()
  for (const hit of scoredHits) {
    if (steps[hit.stepIndex] === '-') continue
    const prev = perStep.get(hit.stepIndex)
    if (!prev || (hit.soundScore ?? 0) > (prev.soundScore ?? 0)) {
      perStep.set(hit.stepIndex, hit)
    }
  }

  // Steps with no detected hit get score 0
  const allScores = steps.map((sym, i) => {
    if (sym === '-') return null
    const hit = perStep.get(i)
    if (!hit) return { stepIndex: i, symbol: sym, soundScore: 0, timingScore: 0, missed: true }
    return hit
  }).filter(Boolean)

  const avgTiming = allScores.reduce((s, h) => s + (h.timingScore ?? 0), 0) / allScores.length
  const avgSound  = allScores.reduce((s, h) => s + (h.soundScore  ?? 0), 0) / allScores.length
  const overall   = Math.round(avgSound * 0.6 + avgTiming * 0.4)

  return {
    overall,
    timingScore: Math.round(avgTiming),
    soundScore:  Math.round(avgSound),
    perHit:      allScores,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sliceAudioBuffer(buffer, startSample, endSample) {
  const length = endSample - startSample
  if (length <= 0) {
    // Return a minimal silent buffer
    const ctx = new OfflineAudioContext(1, 512, buffer.sampleRate)
    return ctx.createBuffer(1, 512, buffer.sampleRate)
  }
  // Use OfflineAudioContext to create a properly-typed AudioBuffer
  const data = buffer.getChannelData(0).slice(startSample, endSample)
  const offline = new OfflineAudioContext(1, data.length, buffer.sampleRate)
  const sliced  = offline.createBuffer(1, data.length, buffer.sampleRate)
  sliced.getChannelData(0).set(data)
  return sliced
}
