import {
  startRecording,
  stopRecording,
  startWaveformDraw,
  startSpectrumDraw,
  isRecording,
} from '../audio/recorder.js'

const AUTO_STOP_MS = 4000

export function createRecorderUI(container, { onResult } = {}) {
  const el = document.createElement('div')
  el.className = 'recorder-ui'
  el.innerHTML = `
    <div class="recorder-canvases">
      <canvas class="recorder-waveform" width="600" height="70"></canvas>
      <canvas class="recorder-spectrum" width="600" height="50"></canvas>
    </div>
    <div class="recorder-controls">
      <button class="btn-record" type="button">
        <span class="record-dot"></span>
        <span class="btn-record-label">Record</span>
      </button>
      <div class="recorder-timer">0.0s / 4.0s</div>
      <div class="recorder-status"></div>
    </div>
  `
  container.appendChild(el)

  const waveCanvas   = el.querySelector('.recorder-waveform')
  const specCanvas   = el.querySelector('.recorder-spectrum')
  const btn          = el.querySelector('.btn-record')
  const timerEl      = el.querySelector('.recorder-timer')
  const statusEl     = el.querySelector('.recorder-status')
  const labelEl      = el.querySelector('.btn-record-label')
  const dotEl        = el.querySelector('.record-dot')

  let stopWaveform   = null
  let stopSpectrum   = null
  let timerInterval  = null
  let autoStopTimer  = null
  let startTime      = null

  function setStatus(msg, color = 'var(--text2)') {
    statusEl.textContent = msg
    statusEl.style.color = color
  }

  async function beginRecording() {
    try {
      await startRecording()
    } catch (err) {
      setStatus('Microphone access denied — check browser permissions.', 'var(--red)')
      return
    }

    btn.classList.add('recording')
    dotEl.classList.add('recording')
    labelEl.textContent = 'Stop'
    setStatus('Recording…', 'var(--accent2)')

    startTime = Date.now()
    timerInterval = setInterval(() => {
      const elapsed = Math.min((Date.now() - startTime) / 1000, 4)
      timerEl.textContent = `${elapsed.toFixed(1)}s / 4.0s`
    }, 100)

    stopWaveform = startWaveformDraw(waveCanvas)
    stopSpectrum = startSpectrumDraw(specCanvas)

    autoStopTimer = setTimeout(endRecording, AUTO_STOP_MS)
  }

  async function endRecording() {
    if (!isRecording()) return
    clearTimeout(autoStopTimer)
    clearInterval(timerInterval)
    if (stopWaveform) { stopWaveform(); stopWaveform = null }
    if (stopSpectrum) { stopSpectrum(); stopSpectrum = null }

    btn.disabled = true
    btn.classList.remove('recording')
    dotEl.classList.remove('recording')
    labelEl.textContent = 'Analysing…'
    setStatus('Extracting features…', 'var(--text2)')

    const audioBuffer = await stopRecording()

    btn.disabled = false
    labelEl.textContent = 'Record again'
    timerEl.textContent = '0.0s / 4.0s'

    if (!audioBuffer) {
      setStatus('Recording was empty — try again.', 'var(--red)')
      return
    }

    setStatus('Done — see feedback below.', 'var(--green)')

    if (onResult) await onResult(audioBuffer)
  }

  btn.addEventListener('click', () => {
    if (isRecording()) endRecording()
    else beginRecording()
  })

  return {
    element: el,
    destroy() {
      clearTimeout(autoStopTimer)
      clearInterval(timerInterval)
      if (stopWaveform) stopWaveform()
      if (stopSpectrum) stopSpectrum()
    },
  }
}
