import * as db from '../lib/db.js'
import { extractFeatures } from '../audio/analyser.js'

const MIN_DURATION_MS = 200
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
      <span class="upload-drop-hint">.mp3 · .wav · .ogg · .webm · 0.2–3.0s</span>
      <input type="file" class="upload-file-input" accept=".mp3,.wav,.ogg,.webm,audio/*" hidden>
    </div>
    <div class="upload-status" aria-live="polite"></div>
    <div class="upload-feature-summary" hidden></div>
  `

  container.appendChild(el)

  const dropZone      = el.querySelector('.upload-drop-zone')
  const fileInput     = el.querySelector('.upload-file-input')
  const statusEl      = el.querySelector('.upload-status')
  const featureSummary = el.querySelector('.upload-feature-summary')

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

  async function handleFile(file) {
    if (!ACCEPTED_TYPES.has(file.type) && !file.name.match(/\.(mp3|wav|ogg|webm)$/i)) {
      setStatus('Unsupported file type. Use .mp3, .wav, .ogg, or .webm.', 'error')
      return
    }

    setStatus('Decoding audio…', 'info')
    dropZone.style.pointerEvents = 'none'

    let audioBuffer, rawArrayBuffer
    try {
      rawArrayBuffer = await file.arrayBuffer()
      const ac = new AudioContext()
      audioBuffer = await ac.decodeAudioData(rawArrayBuffer.slice(0))
      await ac.close()
    } catch {
      setStatus('Could not decode this audio file.', 'error')
      dropZone.style.pointerEvents = ''
      return
    }

    const durationMs = Math.round(audioBuffer.duration * 1000)

    if (durationMs < MIN_DURATION_MS) {
      setStatus(`Clip too short (${durationMs}ms). Minimum is ${MIN_DURATION_MS}ms.`, 'error')
      dropZone.style.pointerEvents = ''
      return
    }
    if (durationMs > MAX_DURATION_MS) {
      setStatus(`Clip too long (${(durationMs/1000).toFixed(2)}s). Maximum is ${MAX_DURATION_MS/1000}s.`, 'error')
      dropZone.style.pointerEvents = ''
      return
    }

    const rms = computeRms(audioBuffer)
    if (rms < NOISE_FLOOR_RMS) {
      setStatus(`Clip is too quiet (RMS ${rms.toFixed(4)}). Move closer to the mic.`, 'error')
      dropZone.style.pointerEvents = ''
      return
    }

    setStatus('Extracting features…', 'info')

    let featureVector
    try {
      const vec = await extractFeatures(audioBuffer)
      featureVector = Array.from(vec)
    } catch (err) {
      setStatus(`Feature extraction failed: ${err.message}`, 'error')
      dropZone.style.pointerEvents = ''
      return
    }

    setStatus('Saving…', 'info')

    // Use filename (without extension) as label; deduplicate if needed
    const baseName = file.name.replace(/\.[^.]+$/, '')
    const label    = await uniqueLabel(soundId, baseName)

    let clip
    try {
      clip = await db.insertClip({
        sound_id:       soundId,
        label,
        feature_vector: featureVector,
        audio_data:     rawArrayBuffer,
        duration_ms:    durationMs,
      })
    } catch (err) {
      setStatus(`Save failed: ${err.message}`, 'error')
      dropZone.style.pointerEvents = ''
      return
    }

    featureSummary.hidden = false
    featureSummary.innerHTML = `
      <p class="feature-summary-title">Saved as <em>${label}</em> · ${(durationMs/1000).toFixed(2)}s · RMS ${rms.toFixed(3)}</p>
    `

    setStatus('✓ Saved!', 'success')
    dropZone.style.pointerEvents = ''
    onUploaded?.(clip)

    // Reset after a moment so another file can be dropped
    setTimeout(() => {
      setStatus('', '')
      featureSummary.hidden = true
    }, 3000)
  }

  function setStatus(msg, type) {
    statusEl.textContent = msg
    statusEl.className   = 'upload-status' + (type ? ` upload-status--${type}` : '')
  }

  return { element: el }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function uniqueLabel(soundId, baseName) {
  const existing = await db.getClips(soundId)
  const labels   = new Set(existing.map(c => c.label))
  if (!labels.has(baseName)) return baseName
  let i = 2
  while (labels.has(`${baseName} (${i})`)) i++
  return `${baseName} (${i})`
}

function computeRms(audioBuffer) {
  const data = audioBuffer.getChannelData(0)
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
  return Math.sqrt(sum / data.length)
}
