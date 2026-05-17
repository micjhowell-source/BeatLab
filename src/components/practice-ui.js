import * as db from '../lib/db.js'
import { startRecording, stopRecording, startWaveformDraw } from '../audio/recorder.js'
import { scheduleSound, getSharedContext } from '../audio/synth.js'
import { detectOnsets } from '../audio/analyser.js'
import { mapHitsToSteps, scoreHits, aggregateSequenceScore } from '../audio/practice.js'
import { parseNotation } from './sequence-editor.js'
import { scoreColor } from '../lib/utils.js'

const MAX_LOOPS   = 3
const COUNTDOWN_S = 3

export function createPracticeUI(container, sequence, referenceMap) {
  const el = document.createElement('div')
  el.className = 'practice-ui card'
  el.innerHTML = `
    <div class="practice-header">
      <h3>Practice this sequence</h3>
      <p class="practice-desc text-muted">
        Listen first, then mimic it — record up to ${MAX_LOOPS} loops.
      </p>
    </div>
    <div class="practice-body">
      <div class="practice-phase" id="phase-idle">
        <button class="practice-btn-start">▶ Start practice</button>
      </div>
      <div class="practice-phase" id="phase-listen" hidden>
        <p class="practice-phase-label">Listen…</p>
        <div class="practice-progress-bar"><div class="practice-progress-fill" id="listen-fill"></div></div>
      </div>
      <div class="practice-phase" id="phase-countdown" hidden>
        <div class="practice-countdown" id="countdown-num">3</div>
      </div>
      <div class="practice-phase" id="phase-record" hidden>
        <p class="practice-phase-label recording-label">● Recording — mimic the sequence</p>
        <canvas class="practice-waveform" width="600" height="60"></canvas>
        <div class="practice-loop-info">
          Loop <span id="loop-num">1</span> / ${MAX_LOOPS} &nbsp;·&nbsp;
          <button class="secondary practice-btn-stop-rec" style="font-size:0.8rem;padding:0.25rem 0.7rem">Stop early</button>
        </div>
      </div>
      <div class="practice-phase" id="phase-scoring" hidden>
        <p class="practice-phase-label">Analysing your recording…</p>
      </div>
      <div class="practice-phase" id="phase-results" hidden></div>
    </div>
  `

  container.appendChild(el)

  const btnStart   = el.querySelector('.practice-btn-start')
  const btnStopRec = el.querySelector('.practice-btn-stop-rec')
  const waveCanvas = el.querySelector('.practice-waveform')

  btnStart.addEventListener('click', () => startPractice())
  btnStopRec.addEventListener('click', () => stopRecordingEarly())

  let stopWaveform  = null
  let recordTimeout = null

  function showPhase(id) {
    el.querySelectorAll('.practice-phase').forEach(p => { p.hidden = p.id !== id })
  }

  async function startPractice() {
    showPhase('phase-listen')
    const steps      = parseNotation(sequence.notation)
    const stepDurSec = 60 / sequence.bpm / 4
    const totalSec   = steps.length * stepDurSec

    const ac     = getSharedContext()
    const startT = ac.currentTime + 0.1

    steps.forEach((sym, i) => {
      if (sym !== '-') scheduleSound(sym, ac, startT + i * stepDurSec)
    })

    const fill = el.querySelector('#listen-fill')
    const t0   = performance.now()
    function animateFill() {
      const pct = Math.min(100, ((performance.now() - t0) / 1000 / totalSec) * 100)
      fill.style.width = pct + '%'
      if (pct < 100) requestAnimationFrame(animateFill)
    }
    animateFill()

    await sleep(totalSec * 1000 + 200)
    await doCountdown()
  }

  async function doCountdown() {
    showPhase('phase-countdown')
    const numEl = el.querySelector('#countdown-num')
    for (let i = COUNTDOWN_S; i >= 1; i--) {
      numEl.textContent = i
      numEl.classList.remove('pop')
      void numEl.offsetWidth
      numEl.classList.add('pop')
      await sleep(1000)
    }
    numEl.textContent = 'GO!'
    numEl.classList.remove('pop')
    void numEl.offsetWidth
    numEl.classList.add('pop')
    await sleep(600)
    await startRecordingPhase()
  }

  async function startRecordingPhase() {
    showPhase('phase-record')
    const steps      = parseNotation(sequence.notation)
    const stepDurSec = 60 / sequence.bpm / 4
    const loopSec    = steps.length * stepDurSec
    const totalSec   = loopSec * MAX_LOOPS
    const loopNumEl  = el.querySelector('#loop-num')

    try {
      await startRecording()
    } catch {
      showPhase('phase-idle')
      return
    }

    stopWaveform = startWaveformDraw(waveCanvas)

    const ac     = getSharedContext()
    const startT = ac.currentTime + 0.05
    for (let loop = 0; loop < MAX_LOOPS; loop++) {
      const loopOffset = startT + loop * loopSec
      steps.forEach((sym, i) => {
        if (sym !== '-') scheduleSound(sym, ac, loopOffset + i * stepDurSec)
      })
      setTimeout(() => { loopNumEl.textContent = loop + 1 }, loop * loopSec * 1000)
    }

    recordTimeout = setTimeout(finishRecording, totalSec * 1000 + 300)
  }

  async function stopRecordingEarly() {
    clearTimeout(recordTimeout)
    await finishRecording()
  }

  async function finishRecording() {
    if (stopWaveform) { stopWaveform(); stopWaveform = null }
    clearTimeout(recordTimeout)

    showPhase('phase-scoring')

    const audioBuffer = await stopRecording()
    if (!audioBuffer) { showPhase('phase-idle'); return }

    const steps      = parseNotation(sequence.notation)
    const stepDurSec = 60 / sequence.bpm / 4

    const onsets     = detectOnsets(audioBuffer, 0.25)
    const hits       = mapHitsToSteps(onsets, audioBuffer.sampleRate, stepDurSec, steps.length)
    const scoredHits = await scoreHits(audioBuffer, hits, steps, referenceMap)
    const result     = aggregateSequenceScore(scoredHits, steps)

    // Persist attempt locally
    if (sequence.id) {
      await db.insertSequenceAttempt({
        sequence_id:   sequence.id,
        overall_score: result.overall,
        timing_score:  result.timingScore,
        sound_score:   result.soundScore,
        per_hit_scores: result.perHit,
      })
    }

    renderResults(result, steps)
  }

  function renderResults(result, steps) {
    showPhase('phase-results')
    const phase        = el.querySelector('#phase-results')
    const overallColor = scoreColor(result.overall)
    const hitByStep    = new Map(result.perHit.map(h => [h.stepIndex, h]))

    const stepCells = steps.map((sym, i) => {
      if (sym === '-') {
        return `<div class="result-cell result-cell--rest"><span class="result-cell-sym">–</span></div>`
      }
      const hit      = hitByStep.get(i)
      const ss       = hit?.soundScore  ?? 0
      const ts       = hit?.timingScore ?? 0
      const combined = hit ? Math.round(ss * 0.6 + ts * 0.4) : 0
      const color    = combined >= 72 ? 'var(--green)' : combined >= 48 ? 'var(--accent)' : combined >= 25 ? 'var(--accent2)' : 'var(--red)'
      const missed   = hit?.missed ? ' result-cell--missed' : ''
      return `<div class="result-cell${missed}" style="--result-color:${color}" title="${sym}: sound ${ss} · timing ${ts}">
        <span class="result-cell-sym">${escHtml(sym)}</span>
        <span class="result-cell-score">${combined}</span>
        ${hit?.missed ? '<span class="result-cell-miss">✕</span>' : ''}
      </div>`
    }).join('')

    phase.innerHTML = `
      <div class="result-header">
        <div class="result-score-big" style="color:${overallColor}">${result.overall}</div>
        <div class="result-score-detail">
          <span class="result-label" style="color:${overallColor}">${scoreLabel(result.overall)}</span>
          <div class="result-sub-scores">
            <span>Sound <b>${result.soundScore}</b></span>
            <span>Timing <b>${result.timingScore}</b></span>
          </div>
        </div>
      </div>
      <div class="result-timeline">
        <p class="result-timeline-label">Per-step breakdown</p>
        <div class="result-step-grid">${stepCells}</div>
        <div class="result-legend">
          <span class="legend-item" style="--lc:var(--green)">■ Mastered (72+)</span>
          <span class="legend-item" style="--lc:var(--accent)">■ Good (48+)</span>
          <span class="legend-item" style="--lc:var(--accent2)">■ OK (25+)</span>
          <span class="legend-item" style="--lc:var(--red)">■ Missed</span>
        </div>
      </div>
      <div class="result-actions">
        <button class="practice-btn-retry secondary">↺ Try again</button>
      </div>
    `

    phase.querySelector('.practice-btn-retry').addEventListener('click', () => showPhase('phase-idle'))
  }
}

// ─── Reference map loader ─────────────────────────────────────────────────────
// Returns Map<symbol, Float32Array[]> from locally stored clips

export async function loadReferenceMap(notation) {
  const symbols = [...new Set(parseNotation(notation).filter(s => s !== '-'))]
  if (symbols.length === 0) return new Map()

  const sounds = await db.getSounds()
  const symbolToId = new Map(sounds.map(s => [s.symbol, s.id]))

  const map = new Map()
  for (const sym of symbols) {
    const soundId = symbolToId.get(sym)
    if (!soundId) continue
    const clips = await db.getClips(soundId)
    const vecs  = clips.map(c => c.feature_vector).filter(Boolean).map(v => new Float32Array(v))
    if (vecs.length > 0) map.set(sym, vecs)
  }

  return map
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function scoreLabel(score) {
  if (score >= 72) return 'Excellent'
  if (score >= 48) return 'Getting there'
  if (score >= 25) return 'Needs work'
  return 'Keep practising'
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
