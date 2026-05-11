import { supabase } from '../supabase.js'
import { createUploadWidget } from '../components/upload.js'
import { playDemo } from '../audio/synth.js'

const CATEGORY_ORDER = ['kick', 'hat', 'snare', 'bass', 'fx']
const CATEGORY_LABEL = { kick: 'Kick', hat: 'Hi-Hat', snare: 'Snare', bass: 'Bass', fx: 'FX' }

export async function render(params) {
  const app  = document.getElementById('app')
  const main = app.querySelector('.main-content')
  if (!main) return

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  const { data: { user } } = await supabase.auth.getUser()
  const isAdmin = user && adminEmail && user.email === adminEmail

  if (!isAdmin) {
    main.innerHTML = `
      <div class="page">
        <h1>Admin</h1>
        <div class="card" style="max-width:420px;margin-top:1.5rem;">
          <p style="color:var(--red);font-weight:600;">Access denied.</p>
          <p class="text-muted" style="margin-top:0.5rem;font-size:0.875rem;">
            ${user ? `Signed in as ${user.email} — not an admin account.` : 'Sign in as the admin account to access this area.'}
          </p>
        </div>
      </div>
    `
    return
  }

  main.innerHTML = `
    <div class="page admin-page">
      <div class="page-header">
        <h1>Admin</h1>
        <p class="page-subtitle">Manage reference clips for each sound. Aim for 3–8 clips per sound.</p>
        <p class="admin-user-badge">Signed in as <span class="text-mono">${user.email}</span></p>
      </div>
      <div id="admin-sounds-list" class="admin-sounds-list">
        <div class="loading-spinner">Loading sounds…</div>
      </div>
    </div>
  `

  const [soundsRes, clipsRes] = await Promise.all([
    supabase.from('sounds').select('*').order('category').order('name'),
    supabase.from('reference_clips').select('*').order('created_at'),
  ])

  const sounds = soundsRes.data || []
  const clips  = clipsRes.data  || []

  // Group clips by sound_id
  const clipsBySound = new Map()
  for (const clip of clips) {
    if (!clipsBySound.has(clip.sound_id)) clipsBySound.set(clip.sound_id, [])
    clipsBySound.get(clip.sound_id).push(clip)
  }

  const listEl = main.querySelector('#admin-sounds-list')
  listEl.innerHTML = ''

  // Render grouped by category
  const byCategory = new Map(CATEGORY_ORDER.map(c => [c, []]))
  for (const sound of sounds) {
    const cat = sound.category
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat).push(sound)
  }

  for (const [cat, catSounds] of byCategory) {
    if (catSounds.length === 0) continue

    const section = document.createElement('div')
    section.className = 'admin-category-section'
    section.innerHTML = `<h2 class="admin-category-title">${CATEGORY_LABEL[cat] || cat}</h2>`

    for (const sound of catSounds) {
      const soundClips = clipsBySound.get(sound.id) || []
      const panel = buildSoundPanel(sound, soundClips, user)
      section.appendChild(panel)
    }

    listEl.appendChild(section)
  }
}

// ─── Sound panel ──────────────────────────────────────────────────────────────

function buildSoundPanel(sound, clips, user) {
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

  // Synth demo
  panel.querySelector('.btn-play-synth').addEventListener('click', () => playDemo(sound.symbol))

  // Toggle expand/collapse
  const toggleBtn  = panel.querySelector('.btn-toggle-panel')
  const body       = panel.querySelector('.admin-panel-body')
  toggleBtn.addEventListener('click', () => {
    const open = body.hidden
    body.hidden = !open
    toggleBtn.textContent = open ? 'Manage ↑' : 'Manage ↓'
    toggleBtn.setAttribute('aria-expanded', String(open))

    if (open) {
      // Render clips list on first open
      renderClipsList(panel.querySelector(`#clips-${sound.id}`), clips, sound.id)

      // Mount upload widget
      const uploadMount = panel.querySelector(`#upload-mount-${sound.id}`)
      if (!uploadMount._widgetMounted) {
        uploadMount._widgetMounted = true
        createUploadWidget(uploadMount, sound.id, {
          onUploaded(newClip) {
            clips.push(newClip)
            renderClipsList(panel.querySelector(`#clips-${sound.id}`), clips, sound.id)
            // Update clip count badge
            const countBadge = panel.querySelector('.admin-clip-count')
            const h = clipHealth(clips.length)
            countBadge.textContent = `${clips.length} clip${clips.length !== 1 ? 's' : ''}`
            countBadge.className = `badge ${h.class}`
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

  for (const clip of [...clips].reverse()) {  // newest first
    const row = document.createElement('div')
    row.className = 'admin-clip-row'
    row.dataset.clipId = clip.id
    row.innerHTML = `
      <div class="admin-clip-info">
        <span class="admin-clip-label">${clip.label || '<em>No label</em>'}</span>
        <span class="admin-clip-meta text-muted">
          ${clip.duration_ms ? `${(clip.duration_ms / 1000).toFixed(2)}s` : ''}
          · ${clip.feature_vector?.length ?? 0} features
          · ${new Date(clip.created_at).toLocaleDateString()}
        </span>
      </div>
      <div class="admin-clip-actions">
        <button class="secondary btn-play-clip" data-path="${clip.storage_path}">▶ Play</button>
        <button class="danger btn-delete-clip" data-clip-id="${clip.id}" data-path="${clip.storage_path}">Delete</button>
      </div>
    `
    container.appendChild(row)
  }

  // Play button
  container.addEventListener('click', async (e) => {
    const playBtn = e.target.closest('.btn-play-clip')
    if (playBtn) {
      const { data } = supabase.storage.from('reference-audio').getPublicUrl(playBtn.dataset.path)
      if (data?.publicUrl) new Audio(data.publicUrl).play().catch(() => {})
      return
    }

    const delBtn = e.target.closest('.btn-delete-clip')
    if (delBtn) {
      const clipId   = delBtn.dataset.clipId
      const clipPath = delBtn.dataset.path
      if (!confirm('Delete this reference clip? This cannot be undone.')) return

      delBtn.disabled = true
      delBtn.textContent = 'Deleting…'

      // Delete from storage
      await supabase.storage.from('reference-audio').remove([clipPath])
      // Delete DB row
      await supabase.from('reference_clips').delete().eq('id', clipId)

      // Remove from local array and re-render
      const idx = clips.findIndex(c => c.id === clipId)
      if (idx !== -1) clips.splice(idx, 1)
      renderClipsList(container, clips, soundId)
    }
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clipHealth(count) {
  if (count === 0)      return { class: 'red',    label: 'No clips' }
  if (count < 3)        return { class: 'orange',  label: 'Few clips' }
  if (count <= 8)       return { class: 'green',   label: 'Good' }
  return                       { class: 'accent',  label: 'Many' }
}
