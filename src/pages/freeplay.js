import * as db from '../lib/db.js'
import { createSequenceEditor, createChipPalette } from '../components/sequence-editor.js'
import { createPracticeUI, loadReferenceMap } from '../components/practice-ui.js'

export async function render(params) {
  const main = document.querySelector('.main-content')
  if (!main) return

  main.innerHTML = `
    <div class="page freeplay-page">
      <div class="freeplay-layout">
        <div class="freeplay-main">
          <div class="page-header">
            <h1>Free Play</h1>
            <p class="page-subtitle">Build sequences with Standard Beatbox Notation and practise them.</p>
          </div>
          <div id="editor-mount"></div>
          <div id="practice-mount"></div>
          <div id="chip-mount" class="chip-palette-section">
            <h3 class="section-label">Sound Library — click to insert at cursor</h3>
          </div>
        </div>
        <aside class="freeplay-sidebar">
          <div class="sidebar-header">
            <h3>My Sequences</h3>
            <button class="secondary btn-new-sequence" id="btn-new">+ New</button>
          </div>
          <div id="sequences-list" class="sequences-list">
            <p class="text-muted" style="font-size:0.85rem">Loading…</p>
          </div>
        </aside>
      </div>
    </div>
  `

  let currentSequenceId = params?.sequenceId || null
  let editorInstance    = null

  function mountEditor(opts = {}) {
    const mount = main.querySelector('#editor-mount')
    mount.innerHTML = ''
    if (editorInstance) editorInstance.destroy()

    editorInstance = createSequenceEditor(mount, {
      initialNotation: opts.notation  || 'b - t - b - t -',
      initialBpm:      opts.bpm       || 90,
      initialSteps:    opts.stepCount || 16,
      onSave: saveSequence,
    })

    if (opts.title) editorInstance.setTitle(opts.title)
    mountPracticeButton(opts)
  }

  function mountPracticeButton(opts = {}) {
    const mount = main.querySelector('#practice-mount')
    mount.innerHTML = ''

    const wrapper = document.createElement('div')
    wrapper.className = 'practice-launch-wrap'
    wrapper.innerHTML = `
      <button class="practice-launch-btn secondary" id="btn-practice">
        🥁 Practice this sequence
      </button>
      <div id="practice-panel-mount"></div>
    `
    mount.appendChild(wrapper)

    wrapper.querySelector('#btn-practice').addEventListener('click', async () => {
      const btnEl     = wrapper.querySelector('#btn-practice')
      const panelMount = wrapper.querySelector('#practice-panel-mount')

      if (panelMount.children.length > 0) {
        panelMount.innerHTML = ''
        btnEl.textContent = '🥁 Practice this sequence'
        return
      }

      btnEl.disabled    = true
      btnEl.textContent = 'Loading references…'

      const state     = editorInstance?.getState() || {}
      const notation  = state.notation  || opts.notation  || 'b - t - b - t -'
      const bpm       = state.bpm       || opts.bpm       || 90
      const stepCount = state.stepCount || opts.stepCount || 16

      const refMap = await loadReferenceMap(notation)

      panelMount.innerHTML = ''
      createPracticeUI(panelMount, { id: currentSequenceId, notation, bpm, stepCount }, refMap)

      btnEl.disabled    = false
      btnEl.textContent = '✕ Close practice'
    })
  }

  // Chip palette
  const chipMount = main.querySelector('#chip-mount')
  createChipPalette(chipMount, {
    onChipClick(symbol) {
      const textArea = main.querySelector('.seq-text-input')
      if (!textArea) return
      const start  = textArea.selectionStart
      const end    = textArea.selectionEnd
      const val    = textArea.value
      const insert = (start > 0 && val[start - 1] !== ' ' ? ' ' : '') + symbol + ' '
      textArea.value = val.slice(0, start) + insert + val.slice(end)
      textArea.selectionStart = textArea.selectionEnd = start + insert.length
      textArea.dispatchEvent(new Event('input'))
      textArea.focus()
    },
  })

  main.querySelector('#btn-new').addEventListener('click', () => {
    currentSequenceId = null
    mountEditor()
    highlightActive(null)
  })

  async function loadSequencesList() {
    const listEl    = main.querySelector('#sequences-list')
    const sequences = await db.getSequences()

    if (!sequences.length) {
      listEl.innerHTML = `<p class="text-muted" style="font-size:0.85rem">No sequences yet. Build one and save it!</p>`
      return
    }

    listEl.innerHTML = ''
    for (const seq of sequences) {
      const row = document.createElement('div')
      row.className = `seq-list-row${seq.id === currentSequenceId ? ' active' : ''}`
      row.dataset.id = seq.id
      row.innerHTML = `
        <div class="seq-list-info">
          <span class="seq-list-title">${escHtml(seq.title)}</span>
          <span class="seq-list-meta">${seq.bpm} BPM · ${seq.step_count} steps</span>
        </div>
        <div class="seq-list-actions">
          <button class="secondary seq-btn-load" data-id="${seq.id}" title="Load">↗</button>
          <button class="danger seq-btn-delete" data-id="${seq.id}" title="Delete">✕</button>
        </div>
      `
      listEl.appendChild(row)
    }

    listEl.addEventListener('click', async (e) => {
      const loadBtn = e.target.closest('.seq-btn-load')
      if (loadBtn) {
        const id  = loadBtn.dataset.id
        const seq = sequences.find(s => s.id === id)
        if (!seq) return
        currentSequenceId = id
        mountEditor({ notation: seq.notation, bpm: seq.bpm, stepCount: seq.step_count, title: seq.title })
        history.replaceState(null, '', `#/freeplay/${id}`)
        highlightActive(id)
        return
      }

      const delBtn = e.target.closest('.seq-btn-delete')
      if (delBtn) {
        if (!confirm('Delete this sequence?')) return
        const id = delBtn.dataset.id
        await db.deleteSequence(id)
        if (currentSequenceId === id) {
          currentSequenceId = null
          mountEditor()
          history.replaceState(null, '', '#/freeplay')
        }
        await loadSequencesList()
      }
    })
  }

  function highlightActive(id) {
    main.querySelectorAll('.seq-list-row').forEach(r => {
      r.classList.toggle('active', r.dataset.id === id)
    })
  }

  async function saveSequence({ title, notation, bpm, stepCount }) {
    const seq = await db.saveSequence({
      id:         currentSequenceId,
      title,
      notation,
      bpm,
      step_count: stepCount,
    })
    currentSequenceId = seq.id
    history.replaceState(null, '', `#/freeplay/${seq.id}`)
    await loadSequencesList()
    highlightActive(currentSequenceId)
  }

  async function maybeLoadFromUrl() {
    if (!params?.sequenceId) return
    const seq = await db.getSequence(params.sequenceId)
    if (seq) {
      currentSequenceId = seq.id
      mountEditor({ notation: seq.notation, bpm: seq.bpm, stepCount: seq.step_count, title: seq.title })
    }
  }

  mountEditor()
  await Promise.all([loadSequencesList(), maybeLoadFromUrl()])
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
