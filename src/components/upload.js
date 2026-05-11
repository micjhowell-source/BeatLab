import { supabase } from '../supabase.js'
import { extractFeatures } from '../audio/analyser.js'

const MIN_DURATION_MS = 300
const MAX_DURATION_MS = 3000
const NOISE_FLOOR_RMS  = 0.01   // reject clips quieter than this
const ACCEPTED_TYPES   = new Set(['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp3'])

// ─── Upload widget ────────────────────────────────────────────────────────────
// Creates a self-contained upload panel for a single sound.
// onUploaded(clip) is called after successful DB insert.

export function createUploadWidget(container, soundId, { onUploaded } = {}) {
  const el = document.createElement('div')
  el.className = 'upload-widget'
  el.innerHTML = `
    <div class="upload-drop-zone" tabindex="0" role="button" aria-label="Drop audio file or click to browse">
      <span class="upload-drop-icon">🎵</span>
      <span class="upload-drop-text">Drop audio here or <u>browse</u></span>
      <span class="upload-drop-hint">.mp3 · .wav · .ogg · .webm · 0.3–3.0s</span>
      <input type="file" class="upload-file-input" accept=".mp3,.wav,.ogg,.webm,audio/*" hidden>
    </div>
    <div class="upload-form" hidden>
      <div class="upload-preview">
        <span class="upload-preview-name"></span>
        <span class="upload-preview-dur"></span>
        <button class="secondary upload-btn-clear" type="button">✕</button>
      </div>
      <div class="upload-label-row">
        <input class="upload-label-input" type="text" placeholder='Label e.g. "male voice — UK style"' maxlength="80">
      </div>
      <div class="upload-actions">
        <button class="upload-btn-submit" type="button">Upload clip</button>
      </div>
    </div>
    <div class="upload-status" aria-live="polite"></div>
    <div class="upload-feature-summary" hidden></div>
  `

  container.appendChild(el)

  const dropZone      = el.querySelector('.upload-drop-zone')
  const fileInput     = el.querySelector('.upload-file-input')
  const form          = el.querySelector('.upload-form')
  const previewName   = el.querySelector('.upload-preview-name')
  const previewDur    = el.querySelector('.upload-preview-dur')
  const btnClear      = el.querySelector('.upload-btn-clear')
  const labelInput    = el.querySelector('.upload-label-input')
  const btnSubmit     = el.querySelector('.upload-btn-submit')
  const statusEl      = el.querySelector('.upload-status')
  const featureSummary = el.querySelector('.upload-feature-summary')

  let pendingFile   = null
  let pendingBuffer = null   // decoded AudioBuffer

  // ── Drop zone events ──
  dropZone.addEventListener('click', () => fileInput.click())
  dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click() })

  dropZone.addEventListener('dragover', e => {
    e.preventDefault()
    dropZone.classList.add('dragover')
  })
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'))
  dropZone.addEventListener('drop', e => {
    e.preventDefault()
    dropZone.classList.remove('dragover')
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  })

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0])
    fileInput.value = ''
  })

  btnClear.addEventListener('click', resetForm)

  btnSubmit.addEventListener('click', doUpload)

  // ── File handling ──
  async function handleFile(file) {
    setStatus('', '')

    if (!ACCEPTED_TYPES.has(file.type) && !file.name.match(/\.(mp3|wav|ogg|webm)$/i)) {
      setStatus('Unsupported file type. Use .mp3, .wav, .ogg, or .webm.', 'error')
      return
    }

    setStatus('Decoding audio…', 'info')

    let audioBuffer
    try {
      const arrayBuffer = await file.arrayBuffer()
      const ac = new AudioContext()
      audioBuffer = await ac.decodeAudioData(arrayBuffer)
      await ac.close()
    } catch {
      setStatus('Could not decode this audio file.', 'error')
      return
    }

    const durationMs = Math.round(audioBuffer.duration * 1000)

    if (durationMs < MIN_DURATION_MS) {
      setStatus(`Clip too short (${durationMs}ms). Minimum is ${MIN_DURATION_MS}ms.`, 'error')
      return
    }
    if (durationMs > MAX_DURATION_MS) {
      setStatus(`Clip too long (${(durationMs/1000).toFixed(2)}s). Maximum is ${MAX_DURATION_MS/1000}s.`, 'error')
      return
    }

    // Check noise floor
    const rms = computeRms(audioBuffer)
    if (rms < NOISE_FLOOR_RMS) {
      setStatus(`Clip is too quiet (RMS ${rms.toFixed(4)}). Move closer to the mic.`, 'error')
      return
    }

    pendingFile   = file
    pendingBuffer = audioBuffer

    previewName.textContent = file.name
    previewDur.textContent  = `${(durationMs / 1000).toFixed(2)}s · RMS ${rms.toFixed(3)}`
    dropZone.hidden = true
    form.hidden     = false
    featureSummary.hidden = true

    setStatus('File looks good. Add a label and click Upload.', 'success')
  }

  // ── Upload ──
  async function doUpload() {
    if (!pendingFile || !pendingBuffer) return

    btnSubmit.disabled = true
    btnSubmit.textContent = 'Extracting features…'
    setStatus('Running Meyda feature extraction…', 'info')

    let featureVector
    try {
      const vec = await extractFeatures(pendingBuffer)
      featureVector = Array.from(vec)
    } catch (err) {
      setStatus(`Feature extraction failed: ${err.message}`, 'error')
      btnSubmit.disabled = false
      btnSubmit.textContent = 'Upload clip'
      return
    }

    setStatus('Uploading audio file…', 'info')
    btnSubmit.textContent = 'Uploading…'

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setStatus('You must be signed in to upload.', 'error')
      resetForm()
      return
    }

    const ext = pendingFile.name.split('.').pop().toLowerCase()
    const storagePath = `${soundId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: storageErr } = await supabase.storage
      .from('reference-audio')
      .upload(storagePath, pendingFile, { contentType: pendingFile.type, upsert: false })

    if (storageErr) {
      setStatus(`Storage upload failed: ${storageErr.message}`, 'error')
      btnSubmit.disabled = false
      btnSubmit.textContent = 'Upload clip'
      return
    }

    const durationMs = Math.round(pendingBuffer.duration * 1000)
    const label = labelInput.value.trim() || null

    const { data: clip, error: dbErr } = await supabase
      .from('reference_clips')
      .insert({
        sound_id: soundId,
        storage_path: storagePath,
        label,
        feature_vector: featureVector,
        duration_ms: durationMs,
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (dbErr) {
      setStatus(`Database insert failed: ${dbErr.message}`, 'error')
      btnSubmit.disabled = false
      btnSubmit.textContent = 'Upload clip'
      return
    }

    // Show feature vector summary
    featureSummary.hidden = false
    featureSummary.innerHTML = `
      <p class="feature-summary-title">Feature vector (17 values)</p>
      <code class="feature-summary-values">${featureVector.map(v => v.toFixed(3)).join('  ')}</code>
    `

    setStatus('✓ Clip uploaded successfully!', 'success')
    resetForm(false)
    onUploaded?.(clip)
  }

  function resetForm(clearStatus = true) {
    pendingFile   = null
    pendingBuffer = null
    dropZone.hidden = false
    form.hidden     = true
    labelInput.value = ''
    btnSubmit.disabled  = false
    btnSubmit.textContent = 'Upload clip'
    if (clearStatus) { setStatus('', ''); featureSummary.hidden = true }
  }

  function setStatus(msg, type) {
    statusEl.textContent = msg
    statusEl.className = 'upload-status' + (type ? ` upload-status--${type}` : '')
  }

  return { element: el }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeRms(audioBuffer) {
  const data = audioBuffer.getChannelData(0)
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
  return Math.sqrt(sum / data.length)
}
