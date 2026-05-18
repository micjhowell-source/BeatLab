import * as db from '../lib/db.js'
import { extractFeatures } from './analyser.js'

// Vite discovers all audio files under src/clips/ at build time.
// Folder name = sound slug, e.g. src/clips/kick/recording.wav
const STATIC_CLIPS = import.meta.glob(
  '../clips/**/*.{mp3,wav,ogg,webm}',
  { query: '?url', import: 'default' }
)

// Loads any clips from src/clips/ that aren't already in IndexedDB.
// Safe to call multiple times — skips clips already present by path ID.
export async function loadStaticClips() {
  const paths = Object.keys(STATIC_CLIPS)
  if (paths.length === 0) return 0

  const sounds     = await db.getSounds()
  const slugToId   = new Map(sounds.map(s => [s.slug, s.id]))
  let loaded = 0

  for (const path of paths) {
    const parts   = path.split('/')
    const slug    = parts.at(-2)
    const soundId = slugToId.get(slug)
    if (!soundId) continue

    const clipId   = `static:${path}`
    const existing = await db.getClipById(clipId)
    if (existing) continue

    try {
      const url         = await STATIC_CLIPS[path]()
      const response    = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      const ac          = new AudioContext()
      const audioBuffer = await ac.decodeAudioData(arrayBuffer.slice(0))
      await ac.close()

      const featureVector = Array.from(await extractFeatures(audioBuffer))
      const durationMs    = Math.round(audioBuffer.duration * 1000)
      const label         = parts.at(-1).replace(/\.[^.]+$/, '')

      await db.insertClip({
        id:             clipId,
        sound_id:       soundId,
        label,
        feature_vector: featureVector,
        audio_data:     arrayBuffer,
        duration_ms:    durationMs,
      })

      loaded++
    } catch (err) {
      console.warn(`clip-loader: skipping ${path}:`, err.message)
    }
  }

  return loaded
}
