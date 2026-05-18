import { SOUNDS, EDGES } from '../data/seed.js'

const DB_NAME    = 'beatlab'
const DB_VERSION = 1

let _db = null

function openDB() {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = e.target.result

      if (!db.objectStoreNames.contains('sounds')) {
        db.createObjectStore('sounds', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('edges')) {
        db.createObjectStore('edges', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('clips')) {
        const store = db.createObjectStore('clips', { keyPath: 'id' })
        store.createIndex('sound_id', 'sound_id', { unique: false })
      }
      if (!db.objectStoreNames.contains('progress')) {
        db.createObjectStore('progress', { keyPath: 'sound_id' })
      }
      if (!db.objectStoreNames.contains('goals')) {
        db.createObjectStore('goals', { keyPath: 'sound_id' })
      }
      if (!db.objectStoreNames.contains('connections')) {
        const store = db.createObjectStore('connections', { keyPath: 'id' })
        store.createIndex('from_sound_id', 'from_sound_id', { unique: false })
      }
      if (!db.objectStoreNames.contains('sequences')) {
        db.createObjectStore('sequences', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('sequence_attempts')) {
        const store = db.createObjectStore('sequence_attempts', { keyPath: 'id', autoIncrement: true })
        store.createIndex('sequence_id', 'sequence_id', { unique: false })
      }
    }

    req.onsuccess = async (e) => {
      _db = e.target.result
      await seedIfEmpty(_db)
      resolve(_db)
    }

    req.onerror = () => reject(req.error)
  })
}

async function seedIfEmpty(db) {
  const count = await idbCount(db, 'sounds')
  if (count > 0) return
  const tx = db.transaction(['sounds', 'edges'], 'readwrite')
  for (const s of SOUNDS) tx.objectStore('sounds').put(s)
  for (const e of EDGES)  tx.objectStore('edges').put(e)
  await txDone(tx)
}

// ─── Low-level helpers ────────────────────────────────────────────────────────

function idbCount(db, store) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve
    tx.onerror    = () => reject(tx.error)
    tx.onabort    = () => reject(tx.error)
  })
}

function idbGet(db, store, key) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

function idbGetAll(db, store) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

function idbPut(db, store, value) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).put(value)
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

function idbDelete(db, store, key) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).delete(key)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

function idbGetByIndex(db, store, indexName, value) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).index(indexName).getAll(value)
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getSounds() {
  const db = await openDB()
  return idbGetAll(db, 'sounds')
}

export async function getEdges() {
  const db = await openDB()
  return idbGetAll(db, 'edges')
}

export async function getClips(soundId) {
  const db = await openDB()
  return idbGetByIndex(db, 'clips', 'sound_id', soundId)
}

export async function getAllClips() {
  const db = await openDB()
  return idbGetAll(db, 'clips')
}

// clip.audio_data should be an ArrayBuffer.
// Pass id to use a specific key (e.g. static clips use path-based IDs).
export async function insertClip({ id, sound_id, label, feature_vector, audio_data, duration_ms }) {
  const db = await openDB()
  const clip = {
    id: id || crypto.randomUUID(),
    sound_id,
    label: label || null,
    feature_vector,
    audio_data,
    duration_ms,
    created_at: new Date().toISOString(),
  }
  await idbPut(db, 'clips', clip)
  return clip
}

export async function getClipById(id) {
  const db = await openDB()
  return idbGet(db, 'clips', id)
}

export async function updateClipLabel(id, label) {
  const db   = await openDB()
  const clip = await idbGet(db, 'clips', id)
  if (!clip) return
  await idbPut(db, 'clips', { ...clip, label })
}

export async function updateClipFeatures(id, featureVector) {
  const db   = await openDB()
  const clip = await idbGet(db, 'clips', id)
  if (!clip) return
  await idbPut(db, 'clips', { ...clip, feature_vector: featureVector })
}

export async function deleteClip(id) {
  const db = await openDB()
  await idbDelete(db, 'clips', id)
}

export async function getAllProgress() {
  const db = await openDB()
  return idbGetAll(db, 'progress')
}

export async function getProgress(soundId) {
  const db = await openDB()
  return idbGet(db, 'progress', soundId)
}

export async function upsertProgress(row) {
  const db = await openDB()
  await idbPut(db, 'progress', row)
  return row
}

export async function getGoals() {
  const db = await openDB()
  return idbGetAll(db, 'goals')
}

export async function addGoal(soundId) {
  const db = await openDB()
  await idbPut(db, 'goals', { sound_id: soundId })
}

export async function removeGoal(soundId) {
  const db = await openDB()
  await idbDelete(db, 'goals', soundId)
}

export async function getConnections() {
  const db = await openDB()
  return idbGetAll(db, 'connections')
}

export async function addConnection(fromId, toId) {
  const db = await openDB()
  const conn = { id: crypto.randomUUID(), from_sound_id: fromId, to_sound_id: toId }
  await idbPut(db, 'connections', conn)
  return conn
}

export async function removeConnection(id) {
  const db = await openDB()
  await idbDelete(db, 'connections', id)
}

export async function getSequences() {
  const db = await openDB()
  const all = await idbGetAll(db, 'sequences')
  return all.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export async function getSequence(id) {
  const db = await openDB()
  return idbGet(db, 'sequences', id)
}

export async function saveSequence({ id, title, notation, bpm, step_count }) {
  const db = await openDB()
  const existing = id ? await idbGet(db, 'sequences', id) : null
  const seq = {
    id:         existing?.id || crypto.randomUUID(),
    title,
    notation,
    bpm,
    step_count,
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  await idbPut(db, 'sequences', seq)
  return seq
}

export async function deleteSequence(id) {
  const db = await openDB()
  await idbDelete(db, 'sequences', id)
}

export async function insertSequenceAttempt(attempt) {
  const db  = await openDB()
  const row = { ...attempt, created_at: new Date().toISOString() }
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('sequence_attempts', 'readwrite')
    const req = tx.objectStore('sequence_attempts').add(row)
    tx.oncomplete = () => resolve({ ...row, id: req.result })
    tx.onerror    = () => reject(tx.error)
  })
}
