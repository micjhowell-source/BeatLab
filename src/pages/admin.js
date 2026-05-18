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
        <div class="admin-backup-bar">
          <button class="secondary" id="btn-export">⬇ Export all clips</button>
          <label class="secondary admin-import-label">
            ⬆ Import clips
            <input type="file" id="input-import" accept=".json" hidden>
          </label>
          <span class="admin-backup-hint text-muted">Back up your clips so you can restore them after switching devices or URLs.</span>
        </div>
      </div>
      <div id="admin-sounds-list" class="admin-sounds-list">
        <div class="loading-spinner">Loading sounds…</div>
      </div>
    </div>
  `

  main.querySelector('#btn-export').addEventListener('click', exportClips)
  main.querySelector('#input-import').addEventListener('change', e => {
    if (e.target.files[0]) importClips(e.target.files[0], main)
    e.target.value = ''
  })

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
        <button class="secondary btn-play-clip">▶ Play</button>
        <button class="secondary btn-rename-clip">Rename</button>
        <button class="danger btn-delete-clip">Delete</button>
      </div>
    `

    row.querySelector('.btn-play-clip').addEventListener('click', () => {
      if (!clip.audio_data) return
      const blob  = new Blob([clip.audio_data])
      const url   = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.play().catch(() => {})
      audio.addEventListener('ended', () => URL.revokeObjectURL(url))
    })

    row.querySelector('.btn-rename-clip').addEventListener('click', async () => {
      const labelEl  = row.querySelector('.admin-clip-label')
      const newLabel = prompt('Rename clip:', clip.label || '')
      if (newLabel === null || newLabel.trim() === '') return
      clip.label = newLabel.trim()
      labelEl.textContent = clip.label
      await db.updateClipLabel(clip.id, clip.label)
    })

    row.querySelector('.btn-delete-clip').addEventListener('click', async (e) => {
      const btn = e.currentTarget
      if (!confirm('Delete this reference clip? This cannot be undone.')) return
      btn.disabled    = true
      btn.textContent = 'Deleting…'
      await db.deleteClip(clip.id)
      const idx = clips.findIndex(c => c.id === clip.id)
      if (idx !== -1) clips.splice(idx, 1)
      renderClipsList(container, clips, soundId)
    })

    container.appendChild(row)
  }
}

// ─── Export / Import ──────────────────────────────────────────────────────────

async function exportClips() {
  const clips = await db.getAllClips()
  if (clips.length === 0) {
    alert('No clips to export.')
    return
  }

  // Encode audio_data ArrayBuffer as base64 for JSON portability
  const payload = {
    version:     1,
    exported_at: new Date().toISOString(),
    clips: clips.map(c => ({
      ...c,
      audio_data: c.audio_data ? arrayBufferToBase64(c.audio_data) : null,
    })),
  }

  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `beatlab-clips-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function importClips(file, main) {
  let payload
  try {
    payload = JSON.parse(await file.text())
  } catch {
    alert('Could not read file — make sure it is a BeatLab export.')
    return
  }

  if (!payload?.clips?.length) {
    alert('No clips found in this file.')
    return
  }

  const existing = await db.getAllClips()
  const existingIds = new Set(existing.map(c => c.id))
  let imported = 0

  for (const clip of payload.clips) {
    if (existingIds.has(clip.id)) continue  // skip duplicates
    await db.insertClip({
      ...clip,
      // Restore ArrayBuffer from base64
      audio_data: clip.audio_data ? base64ToArrayBuffer(clip.audio_data) : null,
    })
    imported++
  }

  alert(`Imported ${imported} clip${imported !== 1 ? 's' : ''} (${payload.clips.length - imported} already existed).`)
  // Re-render to show new clips
  await render()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clipHealth(count) {
  if (count === 0)  return { class: 'red' }
  if (count < 3)    return { class: 'orange' }
  if (count <= 8)   return { class: 'green' }
  return                   { class: 'accent' }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary  = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}
