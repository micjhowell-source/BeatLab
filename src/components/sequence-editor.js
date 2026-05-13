import { scheduleSound, getSharedContext } from '../audio/synth.js'
import { debounce } from '../lib/utils.js'

// SBN sound library — full palette from spec
export const SBN_SOUNDS = [
  { symbol: 'b',   name: 'Kick',        category: 'kick'  },
  { symbol: 'bm',  name: 'Kick soft',   category: 'kick'  },
  { symbol: 'bmp', name: 'Kick+snare',  category: 'kick'  },
  { symbol: 't',   name: 'Hi-hat cl.',  category: 'hat'   },
  { symbol: 'ts',  name: 'Hi-hat open', category: 'hat'   },
  { symbol: 'tss', name: 'Hi-hat long', category: 'hat'   },
  { symbol: 'ksh', name: 'Crash',       category: 'hat'   },
  { symbol: 'pf',  name: 'Snare',       category: 'snare' },
  { symbol: 'psh', name: 'Snare soft',  category: 'snare' },
  { symbol: 'pff', name: 'Snare hard',  category: 'snare' },
  { symbol: 'ka',  name: 'K-snare',     category: 'snare' },
  { symbol: 'keh', name: 'Rimshot',     category: 'snare' },
  { symbol: 'bmm', name: 'Lip bass',    category: 'bass'  },
  { symbol: 'rrr', name: 'Throat bass', category: 'bass'  },
  { symbol: 'wub', name: 'Wub',         category: 'bass'  },
  { symbol: 'sss', name: 'Shaker',      category: 'fx'    },
  { symbol: 'hh',  name: 'Hum',         category: 'fx'    },
  { symbol: '^',   name: 'Breath in',   category: 'fx'    },
  { symbol: '-',   name: 'Rest',        category: 'fx'    },
]

export const CATEGORY_COLOR = {
  kick:  'var(--accent)',
  hat:   'var(--blue)',
  snare: 'var(--accent2)',
  bass:  'var(--purple)',
  fx:    'var(--green)',
}

const SYMBOL_SET = new Set(SBN_SOUNDS.map(s => s.symbol))
const SOUND_BY_SYMBOL = new Map(SBN_SOUNDS.map(s => [s.symbol, s]))

// Cycle through available sounds (for grid cell click)
const CYCLE_ORDER = SBN_SOUNDS.map(s => s.symbol)

// ─── Parser / serialiser ─────────────────────────────────────────────────────

export function parseNotation(notation) {
  return (notation || '').trim().split(/\s+/).filter(Boolean)
}

export function serialiseSteps(steps) {
  return steps.join(' ')
}

// ─── Playback engine ─────────────────────────────────────────────────────────

class Sequencer {
  constructor() {
    this._steps       = []
    this._bpm         = 90
    this._playing     = false
    this._stepIndex   = 0
    this._nextStepTime = 0
    this._rafId       = null
    this._onStep      = null   // (stepIndex) => void
  }

  set steps(v)   { this._steps = v }
  set bpm(v)     { this._bpm = Math.max(40, Math.min(300, v)) }
  set onStep(fn) { this._onStep = fn }

  get playing() { return this._playing }

  get stepDuration() {
    // Each step = one 16th note at given BPM
    return 60 / this._bpm / 4
  }

  start() {
    if (this._playing || this._steps.length === 0) return
    this._playing     = true
    this._stepIndex   = 0
    const ac = getSharedContext()
    this._nextStepTime = ac.currentTime + 0.05
    this._schedule()
  }

  stop() {
    this._playing = false
    cancelAnimationFrame(this._rafId)
    this._stepIndex = 0
    this._onStep?.(-1)
  }

  _schedule() {
    if (!this._playing) return
    const ac = getSharedContext()

    // Schedule ahead by 100ms
    while (this._nextStepTime < ac.currentTime + 0.1) {
      const symbol = this._steps[this._stepIndex]
      if (symbol && symbol !== '-') {
        scheduleSound(symbol, ac, this._nextStepTime)
      }

      const idx = this._stepIndex
      const t = this._nextStepTime
      // Fire visual callback near the right time
      const delay = Math.max(0, (t - ac.currentTime) * 1000)
      setTimeout(() => { if (this._playing) this._onStep?.(idx) }, delay)

      this._stepIndex = (this._stepIndex + 1) % this._steps.length
      this._nextStepTime += this.stepDuration
    }

    this._rafId = requestAnimationFrame(() => this._schedule())
  }
}

// ─── Sequence editor component ───────────────────────────────────────────────

export function createSequenceEditor(container, {
  initialNotation = 'b - t - b - t -',
  initialBpm      = 90,
  initialSteps    = 16,
  onSave,         // ({ notation, bpm, stepCount, title }) => Promise
  onTitleChange,
  readOnly = false,
} = {}) {
  const seq = new Sequencer()

  let steps    = padOrTrim(parseNotation(initialNotation), initialSteps)
  let bpm      = initialBpm
  let stepCount = initialSteps
  let activeStep = -1
  let titleValue = ''

  const el = document.createElement('div')
  el.className = 'seq-editor'

  el.innerHTML = `
    <div class="seq-toolbar">
      <input class="seq-title-input" type="text" placeholder="Sequence title…" value="${escHtml(titleValue)}" maxlength="80">
      <div class="seq-controls">
        <label class="seq-param-label">BPM
          <input class="seq-bpm-input" type="number" value="${bpm}" min="40" max="300" step="1">
        </label>
        <label class="seq-param-label">Steps
          <input class="seq-steps-input" type="number" value="${stepCount}" min="4" max="64" step="1">
        </label>
        <div class="seq-transport">
          <button class="seq-btn-play secondary" title="Play">▶</button>
          <button class="seq-btn-stop secondary" title="Stop">■</button>
          ${onSave ? '<button class="seq-btn-save" title="Save">Save</button>' : ''}
        </div>
      </div>
    </div>

    <div class="seq-modes">
      <button class="seq-tab active" data-tab="grid">Grid</button>
      <button class="seq-tab" data-tab="text">Text</button>
    </div>

    <div class="seq-panel seq-panel--grid" data-panel="grid">
      <div class="seq-grid" role="grid" aria-label="Step sequencer"></div>
    </div>

    <div class="seq-panel seq-panel--text" data-panel="text" hidden>
      <textarea class="seq-text-input" spellcheck="false" placeholder="e.g. b - t pf b t - pf">${serialiseSteps(steps)}</textarea>
      <p class="seq-text-hint">Space-separated SBN tokens. Use <code>-</code> for rests.</p>
    </div>
  `

  container.appendChild(el)

  // ── Element refs ──
  const titleInput  = el.querySelector('.seq-title-input')
  const bpmInput    = el.querySelector('.seq-bpm-input')
  const stepsInput  = el.querySelector('.seq-steps-input')
  const btnPlay     = el.querySelector('.seq-btn-play')
  const btnStop     = el.querySelector('.seq-btn-stop')
  const btnSave     = el.querySelector('.seq-btn-save')
  const gridEl      = el.querySelector('.seq-grid')
  const textEl      = el.querySelector('.seq-text-input')
  const tabs        = el.querySelectorAll('.seq-tab')
  const panels      = el.querySelectorAll('.seq-panel')

  // ── Render grid ──
  function renderGrid() {
    gridEl.innerHTML = ''
    gridEl.style.setProperty('--step-count', stepCount)

    for (let i = 0; i < stepCount; i++) {
      const symbol = steps[i] || '-'
      const sound  = SOUND_BY_SYMBOL.get(symbol)
      const color  = sound ? CATEGORY_COLOR[sound.category] : 'var(--muted)'
      const isEmpty = symbol === '-'

      const cell = document.createElement('div')
      cell.className = `seq-cell${isEmpty ? ' seq-cell--empty' : ''}${i === activeStep ? ' seq-cell--active' : ''}`
      cell.dataset.index = i
      cell.style.setProperty('--cell-color', color)

      cell.innerHTML = `
        <span class="seq-cell-symbol">${isEmpty ? '' : escHtml(symbol)}</span>
        <span class="seq-cell-index">${i + 1}</span>
      `

      if (!readOnly) {
        cell.addEventListener('click', () => cycleCell(i))
        cell.addEventListener('contextmenu', e => { e.preventDefault(); clearCell(i) })
      }

      gridEl.appendChild(cell)
    }
  }

  function cycleCell(i) {
    const current = steps[i] || '-'
    const idx = CYCLE_ORDER.indexOf(current)
    steps[i] = CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length]
    syncTextFromGrid()
    renderGrid()
    restoreActiveHighlight()
  }

  function clearCell(i) {
    steps[i] = '-'
    syncTextFromGrid()
    renderGrid()
    restoreActiveHighlight()
  }

  function restoreActiveHighlight() {
    if (activeStep >= 0) {
      el.querySelector(`.seq-cell[data-index="${activeStep}"]`)?.classList.add('seq-cell--active')
    }
  }

  // ── Text ↔ grid sync ──
  function syncGridFromText() {
    const parsed = parseNotation(textEl.value)
    steps = padOrTrim(parsed, stepCount)
    renderGrid()
    restoreActiveHighlight()
  }

  function syncTextFromGrid() {
    textEl.value = serialiseSteps(steps)
  }

  const debouncedSyncGrid = debounce(syncGridFromText, 300)
  textEl.addEventListener('input', debouncedSyncGrid)

  // ── BPM / steps ──
  bpmInput.addEventListener('change', () => {
    bpm = Math.max(40, Math.min(300, parseInt(bpmInput.value) || 90))
    bpmInput.value = bpm
    seq.bpm = bpm
  })

  stepsInput.addEventListener('change', () => {
    const n = Math.max(4, Math.min(64, parseInt(stepsInput.value) || 16))
    stepCount = n
    stepsInput.value = n
    steps = padOrTrim(steps, n)
    syncTextFromGrid()
    renderGrid()
  })

  // ── Tabs ──
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === target))
      panels.forEach(p => { p.hidden = p.dataset.panel !== target })
      if (target === 'text') syncTextFromGrid()
      if (target === 'grid') { syncGridFromText(); renderGrid() }
    })
  })

  // ── Transport ──
  seq.bpm = bpm
  seq.onStep = (idx) => {
    activeStep = idx
    el.querySelectorAll('.seq-cell').forEach((c, i) => {
      c.classList.toggle('seq-cell--active', i === idx)
    })
  }

  btnPlay.addEventListener('click', () => {
    seq.steps = [...steps]
    seq.bpm   = bpm
    seq.start()
    btnPlay.classList.add('playing')
  })

  btnStop.addEventListener('click', () => {
    seq.stop()
    btnPlay.classList.remove('playing')
    activeStep = -1
    el.querySelectorAll('.seq-cell--active').forEach(c => c.classList.remove('seq-cell--active'))
  })

  // ── Save ──
  titleInput.addEventListener('input', () => {
    titleValue = titleInput.value
    onTitleChange?.(titleValue)
  })

  btnSave?.addEventListener('click', async () => {
    if (btnSave.disabled) return
    btnSave.disabled = true
    btnSave.textContent = 'Saving…'
    try {
      await onSave?.({
        title:     titleValue || 'Untitled',
        notation:  serialiseSteps(steps),
        bpm,
        stepCount,
      })
      btnSave.textContent = 'Saved ✓'
      setTimeout(() => { btnSave.textContent = 'Save'; btnSave.disabled = false }, 2000)
    } catch (err) {
      btnSave.textContent = 'Error — retry'
      btnSave.disabled = false
    }
  })

  // ── Initial render ──
  renderGrid()

  // ── Public API ──
  return {
    element: el,
    getState()  { return { notation: serialiseSteps(steps), bpm, stepCount, title: titleValue } },
    setTitle(t) { titleValue = t; titleInput.value = t },
    load({ notation, bpm: b, stepCount: sc, title: ti }) {
      if (ti)   { titleValue = ti;    titleInput.value  = ti }
      if (b)    { bpm = b;            bpmInput.value    = b;  seq.bpm = b }
      if (sc)   { stepCount = sc;     stepsInput.value  = sc }
      steps = padOrTrim(parseNotation(notation || ''), stepCount)
      syncTextFromGrid()
      renderGrid()
    },
    stop() { seq.stop(); btnPlay.classList.remove('playing') },
    destroy() { seq.stop() },
  }
}

// ─── SBN chip palette ────────────────────────────────────────────────────────

export function createChipPalette(container, { onChipClick } = {}) {
  const el = document.createElement('div')
  el.className = 'chip-palette'

  const categories = ['kick', 'hat', 'snare', 'bass', 'fx']
  const catLabels   = { kick: 'Kick', hat: 'Hi-Hat', snare: 'Snare', bass: 'Bass', fx: 'FX' }

  for (const cat of categories) {
    const sounds = SBN_SOUNDS.filter(s => s.category === cat)
    if (!sounds.length) continue

    const group = document.createElement('div')
    group.className = 'chip-group'

    const label = document.createElement('span')
    label.className = 'chip-group-label'
    label.textContent = catLabels[cat]
    label.style.color = CATEGORY_COLOR[cat]
    group.appendChild(label)

    const chips = document.createElement('div')
    chips.className = 'chip-row'

    for (const sound of sounds) {
      const chip = document.createElement('button')
      chip.className = 'chip'
      chip.dataset.symbol = sound.symbol
      chip.dataset.category = cat
      chip.style.setProperty('--chip-color', CATEGORY_COLOR[cat])
      chip.title = sound.name
      chip.innerHTML = `<span class="chip-symbol">${escHtml(sound.symbol)}</span><span class="chip-name">${escHtml(sound.name)}</span>`
      chip.addEventListener('click', () => onChipClick?.(sound.symbol))
      chips.appendChild(chip)
    }

    group.appendChild(chips)
    el.appendChild(group)
  }

  container.appendChild(el)
  return { element: el }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function padOrTrim(arr, length) {
  const out = arr.slice(0, length)
  while (out.length < length) out.push('-')
  return out
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
