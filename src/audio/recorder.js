let _stream = null
let _mediaRecorder = null
let _chunks = []
let _resolveStop = null
let _audioContext = null

// Shared AudioContext — callers can import this for analysis
export function getAudioContext() {
  if (!_audioContext || _audioContext.state === 'closed') {
    _audioContext = new AudioContext()
  }
  return _audioContext
}

export async function startRecording() {
  if (_mediaRecorder && _mediaRecorder.state === 'recording') return

  _stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  _chunks = []

  _mediaRecorder = new MediaRecorder(_stream)
  _mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) _chunks.push(e.data)
  }
  _mediaRecorder.start(100) // collect in 100ms chunks
}

// Returns decoded AudioBuffer of the recording
export async function stopRecording() {
  if (!_mediaRecorder || _mediaRecorder.state === 'inactive') return null

  return new Promise(resolve => {
    _mediaRecorder.onstop = async () => {
      const blob = new Blob(_chunks, { type: _mediaRecorder.mimeType })
      const arrayBuffer = await blob.arrayBuffer()
      const ctx = getAudioContext()
      try {
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
        resolve(audioBuffer)
      } catch {
        resolve(null)
      } finally {
        _stream.getTracks().forEach(t => t.stop())
        _stream = null
      }
    }
    _mediaRecorder.stop()
  })
}

export function isRecording() {
  return _mediaRecorder?.state === 'recording'
}

// Draws a live waveform onto a canvas element while recording.
// Returns a stop function — call it to cancel the animation loop.
export function startWaveformDraw(canvas) {
  const ctx = getAudioContext()
  const source = ctx.createMediaStreamSource(_stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 1024
  source.connect(analyser)

  const bufLen = analyser.frequencyBinCount
  const dataArr = new Uint8Array(bufLen)
  const c = canvas.getContext('2d')
  let rafId

  function draw() {
    rafId = requestAnimationFrame(draw)
    analyser.getByteTimeDomainData(dataArr)

    c.clearRect(0, 0, canvas.width, canvas.height)
    c.lineWidth = 2
    c.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent2').trim() || '#FF6B35'
    c.beginPath()

    const sliceW = canvas.width / bufLen
    let x = 0
    for (let i = 0; i < bufLen; i++) {
      const v = dataArr[i] / 128
      const y = (v * canvas.height) / 2
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)
      x += sliceW
    }
    c.lineTo(canvas.width, canvas.height / 2)
    c.stroke()
  }

  draw()
  return () => {
    cancelAnimationFrame(rafId)
    source.disconnect()
  }
}

// Draws a live frequency spectrum onto a canvas element while recording.
// Returns a stop function.
export function startSpectrumDraw(canvas) {
  const ctx = getAudioContext()
  const source = ctx.createMediaStreamSource(_stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048
  source.connect(analyser)

  const bufLen = analyser.frequencyBinCount
  const dataArr = new Uint8Array(bufLen)
  const c = canvas.getContext('2d')
  let rafId

  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent').trim() || '#E8FF3A'

  function draw() {
    rafId = requestAnimationFrame(draw)
    analyser.getByteFrequencyData(dataArr)

    c.clearRect(0, 0, canvas.width, canvas.height)

    const barW = (canvas.width / bufLen) * 2.5
    let x = 0
    for (let i = 0; i < bufLen; i++) {
      const barH = (dataArr[i] / 255) * canvas.height
      const alpha = 0.4 + (dataArr[i] / 255) * 0.6
      c.fillStyle = accent
      c.globalAlpha = alpha
      c.fillRect(x, canvas.height - barH, barW, barH)
      x += barW + 1
    }
    c.globalAlpha = 1
  }

  draw()
  return () => {
    cancelAnimationFrame(rafId)
    source.disconnect()
  }
}
