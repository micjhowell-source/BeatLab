import * as db from '../lib/db.js'
import { extractFeatures } from '../audio/analyser.js'

const MIN_DURATION_MS = 300
const MAX_DURATION_MS = 3000
const NOISE_FLOOR_RMS  = 0.01
const ACCEPTED_TYPES   = new Set(['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp3'])

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
        <button class="upload-btn-submit" type="button">Save clip</button>
      </div>
    </div>
    <div class="upload-status" aria-live="polite"></div>
    <div class="upload-feature-summary" hidden></div>
  `

  container.appendChild(el)

  const dropZone       = el.querySelector('.upload-drop-zone')
  const fileInput      = el.querySelector('.upload-file-input')
  const form           = el.querySelector('.upload-form')
  const previewName    = el.querySelector('.upload-preview-name')
  const previewDur     = el.querySelector('.upload-preview-dur')
  const btnClear       = el.querySelector('.upload-btn-clear')
  const labelInput     = el.querySelector('.upload-label-input')
  const btnSubmit      = el.querySelector('.upload-btn-submit')
  const statusEl       = el.querySelector('.upload-status')
  const featureSummary = el.querySelector('.upload-feature-summary')

  let pendingFile       = null
  let pendingBuffer     = null
  let pendingArrayBuffer = null

  dropZone.addEventListener('click', () => fileInput.click())
  dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click() })

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover') })
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
  btnSubmit.addEventListener('click', doSave)

  async function handleFile(file) {
    setStatus('', '')

    if (!ACCEPTED_TYPES.has(file.type) && !file.name.match(/\.(mp3|wav|ogg|webm)$/i)) {
      setStatus('Unsupported file type. Use .mp3, .wav, .ogg, or .webm.', 'error')
      return
    }

    setStatus('Decoding audio…', 'info')

    let audioBuffer, rawArrayBuffer
    try {
      rawArrayBuffer = await file.arrayBuffer()
      const ac = new AudioContext()
      audioBuffer = await ac.decodeAudioData(rawArrayBuffer.slice(0))
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

    const rms = computeRms(audioBuffer)
    if (rms < NOISE_FLOOR_RMS) {
      setStatus(`Clip is too quiet (RMS ${rms.toFixed(4)}). Move closer to the mic.`, 'error')
      return
    }

    pendingFile        = file
    pendingBuffer      = audioBuffer
    pendingArrayBuffer = rawArrayBuffer

    previewName.textContent = file.name
    previewDur.textContent  = `${(durationMs / 1000).toFixed(2)}s · RMS ${rms.toFixed(3)}`
    dropZone.hidden = true
    form.hidden     = false
    featureSummary.hidden = true

    setStatus('File looks good. Add a label and click Save.', 'success')
  }

  async function doSave() {
    if (!pendingFile || !pendingBuffer) return

    btnSubmit.disabled    = true
    btnSubmit.textContent = 'Extracting features…'
    setStatus('Running Meyda feature extraction…', 'info')

    let featureVector
    try {
      const vec = await extractFeatures(pendingBuffer)
      featureVector = Array.from(vec)
    } catch (err) {
      setStatus(`Feature extraction failed: ${err.message}`, 'error')
      btnSubmit.disabled    = false
      btnSubmit.textContent = 'Save clip'
      return
    }

    setStatus('Saving…', 'info')
    btnSubmit.textContent = 'Saving…'

    const durationMs = Math.round(pendingBuffer.duration * 1000)
    const label      = labelInput.value.trim() || null

    let clip
    try {
      clip = await db.insertClip({
        sound_id:       soundId,
        label,
        feature_vector: featureVector,
        audio_data:     pendingArrayBuffer,
        duration_ms:    durationMs,
      })
    } catch (err) {
      setStatus(`Save failed: ${err.message}`, 'error')
      btnSubmit.disabled    = false
      btnSubmit.textContent = 'Save clip'
      return
    }

    featureSummary.hidden = false
    featureSummary.innerHTML = `
      <p class="feature-summary-title">Feature vector (17 values)</p>
      <code class="feature-summary-values">${featureVector.map(v => v.toFixed(3)).join('  ')}</code>
    `

    setStatus('✓ Clip saved!', 'success')
    resetForm(false)
    onUploaded?.(clip)
  }

  function resetForm(clearStatus = true) {
    pendingFile = pendingBuffer = pendingArrayBuffer = null
    dropZone.hidden = false
    form.hidden     = true
    labelInput.value      = ''
    btnSubmit.disabled    = false
    btnSubmit.textContent = 'Save clip'
    if (clearStatus) { setStatus('', ''); featureSummary.hidden = true }
  }

  function setStatus(msg, type) {
    statusEl.textContent = msg
    statusEl.className   = 'upload-status' + (type ? ` upload-status--${type}` : '')
  }

  return { element: el }
}

function computeRms(audioBuffer) {
  const data = audioBuffer.getChannelData(0)
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
  return Math.sqrt(sum / data.length)
}
