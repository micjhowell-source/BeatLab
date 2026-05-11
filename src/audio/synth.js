// Web Audio synthesiser for all SBN beatbox sounds.
// Each function accepts an AudioContext and returns immediately after scheduling nodes.

function ctx() {
  // Lazy shared context — created on first user gesture
  if (!_ctx || _ctx.state === 'closed') _ctx = new AudioContext()
  if (_ctx.state === 'suspended') _ctx.resume()
  return _ctx
}

let _ctx = null

export function getSharedContext() {
  return ctx()
}

// ─── Primitive builders ─────────────────────────────────────────────────────

function osc(ac, type, freq, start, end, gainStart = 1, gainEnd = 0) {
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, start)
  g.gain.setValueAtTime(gainStart, start)
  g.gain.exponentialRampToValueAtTime(Math.max(gainEnd, 0.0001), end)
  o.connect(g)
  g.connect(ac.destination)
  o.start(start)
  o.stop(end + 0.01)
  return { osc: o, gain: g }
}

function noise(ac, start, duration, gainPeak = 0.6, filterFreq = 8000, filterQ = 1) {
  const bufSize = Math.ceil(ac.sampleRate * duration)
  const buf = ac.createBuffer(1, bufSize, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1

  const src = ac.createBufferSource()
  src.buffer = buf

  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = filterFreq
  filter.Q.value = filterQ

  const g = ac.createGain()
  g.gain.setValueAtTime(gainPeak, start)
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  src.connect(filter)
  filter.connect(g)
  g.connect(ac.destination)
  src.start(start)
  src.stop(start + duration + 0.01)
  return { src, filter, gain: g }
}

function click(ac, start, gainPeak = 0.8, freq = 200) {
  // Short sine burst to simulate a click/pop
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(freq, start)
  g.gain.setValueAtTime(gainPeak, start)
  g.gain.exponentialRampToValueAtTime(0.0001, start + 0.02)
  o.connect(g)
  g.connect(ac.destination)
  o.start(start)
  o.stop(start + 0.03)
}

// ─── Sound synthesisers ─────────────────────────────────────────────────────

function synthKick(ac, t = 0) {
  // Punchy sine sweep from ~150 Hz down to ~50 Hz
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(150, t)
  o.frequency.exponentialRampToValueAtTime(50, t + 0.12)
  g.gain.setValueAtTime(0.9, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
  o.connect(g); g.connect(ac.destination)
  o.start(t); o.stop(t + 0.3)

  // Attack click
  click(ac, t, 0.5, 180)
}

function synthKickSoft(ac, t = 0) {
  // Softer kick — lower attack, quicker decay
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(120, t)
  o.frequency.exponentialRampToValueAtTime(50, t + 0.08)
  g.gain.setValueAtTime(0.5, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
  o.connect(g); g.connect(ac.destination)
  o.start(t); o.stop(t + 0.22)
}

function synthKickSnare(ac, t = 0) {
  synthKick(ac, t)
  synthSnare(ac, t + 0.02) // slight snare layer
}

function synthHihatClosed(ac, t = 0) {
  noise(ac, t, 0.06, 0.5, 9000, 2)
  click(ac, t, 0.3, 6000)
}

function synthHihatOpen(ac, t = 0) {
  noise(ac, t, 0.18, 0.45, 8000, 1.5)
  click(ac, t, 0.2, 6000)
}

function synthHihatLong(ac, t = 0) {
  noise(ac, t, 0.45, 0.4, 7500, 1.2)
  click(ac, t, 0.15, 6000)
}

function synthCrash(ac, t = 0) {
  // Loud noise burst with slow decay + high-freq shimmer
  noise(ac, t, 0.08, 0.9, 5000, 0.5)
  noise(ac, t, 0.8, 0.35, 12000, 0.3)
  click(ac, t, 0.6, 3000)
}

function synthSnare(ac, t = 0) {
  // Lip slap = low sine pop + noise burst
  const o = ac.createOscillator()
  const og = ac.createGain()
  o.type = 'triangle'
  o.frequency.setValueAtTime(200, t)
  o.frequency.exponentialRampToValueAtTime(80, t + 0.05)
  og.gain.setValueAtTime(0.7, t)
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
  o.connect(og); og.connect(ac.destination)
  o.start(t); o.stop(t + 0.1)

  noise(ac, t, 0.1, 0.5, 4000, 1.5)
}

function synthSnareHard(ac, t = 0) {
  const o = ac.createOscillator()
  const og = ac.createGain()
  o.type = 'triangle'
  o.frequency.setValueAtTime(220, t)
  o.frequency.exponentialRampToValueAtTime(80, t + 0.06)
  og.gain.setValueAtTime(0.9, t)
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
  o.connect(og); og.connect(ac.destination)
  o.start(t); o.stop(t + 0.12)

  noise(ac, t, 0.14, 0.7, 4500, 1.5)
}

function synthSnareSoft(ac, t = 0) {
  // Brushed snare — very soft
  const o = ac.createOscillator()
  const og = ac.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(160, t)
  o.frequency.exponentialRampToValueAtTime(80, t + 0.04)
  og.gain.setValueAtTime(0.3, t)
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
  o.connect(og); og.connect(ac.destination)
  o.start(t); o.stop(t + 0.1)

  noise(ac, t, 0.12, 0.2, 3500, 2)
}

function synthKSnare(ac, t = 0) {
  // Back-of-throat click + forward burst
  click(ac, t, 0.6, 1200)
  noise(ac, t + 0.01, 0.08, 0.4, 3000, 1)
  const o = ac.createOscillator()
  const og = ac.createGain()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(300, t + 0.01)
  o.frequency.exponentialRampToValueAtTime(100, t + 0.07)
  og.gain.setValueAtTime(0.4, t + 0.01)
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
  o.connect(og); og.connect(ac.destination)
  o.start(t + 0.01); o.stop(t + 0.12)
}

function synthRimshot(ac, t = 0) {
  click(ac, t, 0.7, 900)
  noise(ac, t, 0.05, 0.3, 2500, 3)
}

function synthLipBass(ac, t = 0) {
  // Buzzing lip oscillation at ~80 Hz
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(80, t)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.6, t + 0.02)
  g.gain.setValueAtTime(0.6, t + 0.2)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)

  // Slight formant shaping
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 400

  o.connect(filter); filter.connect(g); g.connect(ac.destination)
  o.start(t); o.stop(t + 0.3)
}

function synthThroatBass(ac, t = 0) {
  // Growling sawtooth with distortion-like harmonics
  const o = ac.createOscillator()
  const o2 = ac.createOscillator()
  const g = ac.createGain()
  o.type = 'sawtooth'
  o2.type = 'square'
  o.frequency.setValueAtTime(100, t)
  o2.frequency.setValueAtTime(200, t)

  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.5, t + 0.03)
  g.gain.setValueAtTime(0.5, t + 0.25)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)

  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 600

  const g2 = ac.createGain()
  g2.gain.value = 0.15

  o.connect(filter); filter.connect(g); g.connect(ac.destination)
  o2.connect(g2); g2.connect(ac.destination)
  o.start(t); o.stop(t + 0.38)
  o2.start(t); o2.stop(t + 0.38)
}

function synthWub(ac, t = 0) {
  // LFO-modulated bass — wub wub effect
  const o = ac.createOscillator()
  const filter = ac.createBiquadFilter()
  const lfo = ac.createOscillator()
  const lfoGain = ac.createGain()
  const g = ac.createGain()

  o.type = 'sawtooth'
  o.frequency.value = 80

  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(400, t)
  filter.Q.value = 8

  lfo.frequency.value = 6  // 6 Hz wobble
  lfoGain.gain.value = 600 // modulation depth

  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.7, t + 0.02)
  g.gain.setValueAtTime(0.7, t + 0.35)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)

  lfo.connect(lfoGain); lfoGain.connect(filter.frequency)
  o.connect(filter); filter.connect(g); g.connect(ac.destination)

  o.start(t); o.stop(t + 0.48)
  lfo.start(t); lfo.stop(t + 0.48)
}

function synthShaker(ac, t = 0) {
  // Sustained high-frequency hiss through teeth
  noise(ac, t, 0.3, 0.3, 10000, 0.5)
  noise(ac, t, 0.3, 0.15, 14000, 0.3)
}

function synthHum(ac, t = 0) {
  osc(ac, 'sine', 220, t, t + 0.35, 0.4, 0.0001)
  // Slight vibrato
  const lfo = ac.createOscillator()
  const lfoG = ac.createGain()
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = 'sine'
  o.frequency.value = 220
  lfo.frequency.value = 5
  lfoG.gain.value = 8
  g.gain.setValueAtTime(0.4, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
  lfo.connect(lfoG); lfoG.connect(o.frequency)
  o.connect(g); g.connect(ac.destination)
  o.start(t); o.stop(t + 0.42)
  lfo.start(t); lfo.stop(t + 0.42)
}

function synthBreathIn(ac, t = 0) {
  // Inward breath — high-pass filtered noise with rising gain
  const bufSize = Math.ceil(ac.sampleRate * 0.25)
  const buf = ac.createBuffer(1, bufSize, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1

  const src = ac.createBufferSource()
  src.buffer = buf

  const filter = ac.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 3000

  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.35, t + 0.12)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)

  src.connect(filter); filter.connect(g); g.connect(ac.destination)
  src.start(t); src.stop(t + 0.27)
}

// ─── Symbol → synth map ─────────────────────────────────────────────────────

const SYNTH_MAP = {
  'b':    synthKick,
  'bm':   synthKickSoft,
  'bmp':  synthKickSnare,
  't':    synthHihatClosed,
  'ts':   synthHihatOpen,
  'tss':  synthHihatLong,
  'ksh':  synthCrash,
  'chish':synthCrash,
  'pf':   synthSnare,
  'pff':  synthSnareHard,
  'psh':  synthSnareSoft,
  'ka':   synthKSnare,
  'keh':  synthRimshot,
  'bmm':  synthLipBass,
  'rrr':  synthThroatBass,
  'wub':  synthWub,
  'sss':  synthShaker,
  'hh':   synthHum,
  '^':    synthBreathIn,
}

// Play a demo sound immediately. Uses a shared AudioContext.
export function playDemo(symbol) {
  const ac = ctx()
  const fn = SYNTH_MAP[symbol]
  if (!fn) return
  fn(ac, ac.currentTime + 0.01)
}

// Schedule a sound at a specific AudioContext time (for sequencer playback)
export function scheduleSound(symbol, audioContext, time) {
  const fn = SYNTH_MAP[symbol]
  if (fn) fn(audioContext, time)
}

export { SYNTH_MAP }
