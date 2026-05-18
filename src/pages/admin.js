import * as db from '../lib/db.js'
import { createUploadWidget } from '../components/upload.js'
import { playDemo } from '../audio/synth.js'

const CATEGORY_ORDER = ['kick', 'hat', 'snare', 'bass', 'fx']
const CATEGORY_LABEL = { kick: 'Kick', hat: 'Hi-Hat', snare: 'Snare', bass: 'Bass', fx: 'FX' }

export async function render() {
  const main = document.querySelector('.main-content')
  if (!main) return

  main.innerHTML = `
    <div class="page admin-page">
      <div class="page-header">
        <h1>Admin</h1>
        <p class="page-subtitle">Manage reference clips for each sound. Aim for 3–8 clips per sound.</p>
      </div>
      <div id="admin-sounds-list" class="admin-sounds-list">
        <div class="loading-spinner">Loading sounds…</div>
      </div>
    </div>
  `

  const [sounds, allClips] = await Promise.all([
    db.getSounds(),
    db.getAllClips(),
  ])

  // Sort sounds by category then name
  sounds.sort((a, b) => {
    const ci = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    return ci !== 0 ? ci : a.name.localeCompare(b.name)
  })

  // Group clips by sound_id
  const clipsBySound = new Map()
  for (const clip of allClips) {
    if (!clipsBySound.has(clip.sound_id)) clipsBySound.set(clip.sound_id, [])
    clipsBySound.get(clip.sound_id).push(clip)
  }

  const listEl = main.querySelector('#admin-sounds-list')
  listEl.innerHTML = ''

  const byCategory = new Map(CATEGORY_ORDER.map(c => [c, []]))
  for (const sound of sounds) {
    if (!byCategory.has(sound.category)) byCategory.set(sound.category, [])
    byCategory.get(sound.category).push(sound)
  }

  for (const [cat, catSounds] of byCategory) {
    if (catSounds.length === 0) continue

    const section = document.createElement('div')
    section.className = 'admin-category-section'
    section.innerHTML = `<h2 class="admin-category-title">${CATEGORY_LABEL[cat] || cat}</h2>`

    for (const sound of catSounds) {
      const soundClips = clipsBySound.get(sound.id) || []
      section.appendChild(buildSoundPanel(sound, soundClips))
    }

    listEl.appendChild(section)
  }
}

// ─── Sound panel ──────────────────────────────────────────────────────────────

function buildSoundPanel(sound, clips) {
  const panel = document.createElement('div')
  panel.className = 'admin-sound-panel card'
  panel.dataset.soundId = sound.id

  const health = clipHealth(clips.length)

  panel.innerHTML = `
    <div class="admin-sound-header">
      <div class="admin-sound-info">
        <span class="admin-sound-name">${sound.name}</span>
        <span class="badge badge--mono">${sound.symbol}</span>
        <span class="admin-clip-count badge ${health.class}">${clips.length} clip${clips.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="admin-sound-actions">
        <button class="secondary btn-play-synth" data-symbol="${sound.symbol}" title="Play synth demo">▶ Demo</button>
        <button class="secondary btn-toggle-panel" aria-expanded="false">Manage ↓</button>
      </div>
    </div>
    <div class="admin-panel-body" hidden>
      <div class="admin-clips-list" id="clips-${sound.id}"></div>
      <div class="admin-upload-section">
        <h4>Add new clip</h4>
        <div id="upload-mount-${sound.id}"></div>
      </div>
    </div>
  `

  panel.querySelector('.btn-play-synth').addEventListener('click', () => playDemo(sound.symbol))

  const toggleBtn = panel.querySelector('.btn-toggle-panel')
  const body      = panel.querySelector('.admin-panel-body')

  toggleBtn.addEventListener('click', () => {
    const open = body.hidden
    body.hidden = !open
    toggleBtn.textContent = open ? 'Manage ↑' : 'Manage ↓'
    toggleBtn.setAttribute('aria-expanded', String(open))

    if (open) {
      renderClipsList(panel.querySelector(`#clips-${sound.id}`), clips, sound.id)

      const uploadMount = panel.querySelector(`#upload-mount-${sound.id}`)
      if (!uploadMount._widgetMounted) {
        uploadMount._widgetMounted = true
        createUploadWidget(uploadMount, sound.id, {
          onUploaded(newClip) {
            clips.push(newClip)
            renderClipsList(panel.querySelector(`#clips-${sound.id}`), clips, sound.id)
            const countBadge = panel.querySelector('.admin-clip-count')
            const h = clipHealth(clips.length)
            countBadge.textContent = `${clips.length} clip${clips.length !== 1 ? 's' : ''}`
            countBadge.className   = `badge ${h.class}`
          },
        })
      }
    }
  })

  return panel
}

// ─── Clips list ───────────────────────────────────────────────────────────────

function renderClipsList(container, clips, soundId) {
  container.innerHTML = ''

  if (clips.length === 0) {
    container.innerHTML = `<p class="text-muted admin-no-clips">No clips yet — upload one below.</p>`
    return
  }

  const clipMap = new Map(clips.map(c => [c.id, c]))

  for (const clip of [...clips].reverse()) {
    const row = document.createElement('div')
    row.className = 'admin-clip-row'
    row.dataset.clipId = clip.id
    row.innerHTML = `
      <div class="admin-clip-info">
        <span class="admin-clip-label" data-clip-id="${clip.id}">${clip.label || 'No label'}</span>
        <span class="admin-clip-meta text-muted">
          ${clip.duration_ms ? `${(clip.duration_ms / 1000).toFixed(2)}s` : ''}
          · ${new Date(clip.created_at).toLocaleDateString()}
        </span>
      </div>
      <div class="admin-clip-actions">
        <button class="secondary btn-play-clip" data-clip-id="${clip.id}">▶ Play</button>
        <button class="secondary btn-rename-clip" data-clip-id="${clip.id}">Rename</button>
        <button class="danger btn-delete-clip" data-clip-id="${clip.id}">Delete</button>
      </div>
    `
    container.appendChild(row)
  }

  container.addEventListener('click', async (e) => {
    const playBtn = e.target.closest('.btn-play-clip')
    if (playBtn) {
      const clip = clipMap.get(playBtn.dataset.clipId)
      if (!clip?.audio_data) return
      const blob = new Blob([clip.audio_data])
      const url  = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.play().catch(() => {})
      audio.addEventListener('ended', () => URL.revokeObjectURL(url))
      return
    }

    const renameBtn = e.target.closest('.btn-rename-clip')
    if (renameBtn) {
      const clipId   = renameBtn.dataset.clipId
      const clip     = clipMap.get(clipId)
      const labelEl  = container.querySelector(`.admin-clip-label[data-clip-id="${clipId}"]`)
      const newLabel = prompt('Rename clip:', clip.label || '')
      if (newLabel === null || newLabel.trim() === '') return
      clip.label   = newLabel.trim()
      labelEl.textContent = clip.label
      await db.updateClipLabel(clipId, clip.label)
      return
    }

    const delBtn = e.target.closest('.btn-delete-clip')
    if (delBtn) {
      if (!confirm('Delete this reference clip? This cannot be undone.')) return
      const clipId = delBtn.dataset.clipId
      delBtn.disabled    = true
      delBtn.textContent = 'Deleting…'
      await db.deleteClip(clipId)
      const idx = clips.findIndex(c => c.id === clipId)
      if (idx !== -1) clips.splice(idx, 1)
      renderClipsList(container, clips, soundId)
    }
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clipHealth(count) {
  if (count === 0)  return { class: 'red' }
  if (count < 3)    return { class: 'orange' }
  if (count <= 8)   return { class: 'green' }
  return                   { class: 'accent' }
}
