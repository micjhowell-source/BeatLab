import * as db from '../lib/db.js'
import { renderGraph, computeUnlocks } from '../components/graph.js'
import { createRecorderUI } from '../components/recorder-ui.js'
import { renderFeedback } from '../components/feedback.js'
import { extractFeatures } from '../audio/analyser.js'
import { scoreFull } from '../audio/similarity.js'
import { playDemo } from '../audio/synth.js'

const MASTERY_THRESHOLD   = 72
const MASTERY_CONSECUTIVE = 2

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function render(params) {
  const main = document.querySelector('.main-content')
  if (!main) return

  if (params?.soundSlug) {
    await renderLesson(main, params.soundSlug)
  } else {
    await renderGraphView(main)
  }
}

// ─── Graph view ───────────────────────────────────────────────────────────────

async function renderGraphView(main) {
  main.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h1>Learn</h1>
        <p class="page-subtitle">Select a sound to start practising. Master it to unlock adjacent skills.</p>
      </div>
      <div id="graph-container" class="graph-container">
        <div class="loading-spinner">Loading skill graph…</div>
      </div>
    </div>
  `

  const [sounds, edges, userProgress, userConnections, userGoals] = await Promise.all([
    db.getSounds(),
    db.getEdges(),
    db.getAllProgress(),
    db.getConnections(),
    db.getGoals(),
  ])

  // Foundation nodes are always unlocked
  const foundationSlugs = new Set(['kick', 'hihat-closed'])
  const foundationIds   = new Set(sounds.filter(s => foundationSlugs.has(s.slug)).map(s => s.id))

  const progressMap = new Map(userProgress.map(p => [p.sound_id, p]))
  for (const id of foundationIds) {
    if (!progressMap.has(id)) {
      progressMap.set(id, { sound_id: id, is_unlocked: true, is_mastered: false, attempt_count: 0 })
    } else {
      progressMap.get(id).is_unlocked = true
    }
  }
  const allProgress = [...progressMap.values()]

  const container = main.querySelector('#graph-container')
  container.innerHTML = ''

  renderGraph(container, {
    sounds,
    edges,
    userProgress: allProgress,
    userConnections,
    userGoals,
    onNodeClick(sound) {
      window.location.hash = `#/learn/${sound.slug}`
    },
    async onGoalToggle(sound, isGoal) {
      if (isGoal) {
        await db.removeGoal(sound.id)
      } else {
        await db.addGoal(sound.id)
      }
      await renderGraphView(main)
    },
    async onAddConnection(fromId, toId) {
      await db.addConnection(fromId, toId)
      await renderGraphView(main)
    },
    async onRemoveConnection(connId) {
      await db.removeConnection(connId)
      await renderGraphView(main)
    },
  })
}

// ─── Lesson view ──────────────────────────────────────────────────────────────

async function renderLesson(main, soundSlug) {
  main.innerHTML = `<div class="page"><div class="loading-spinner">Loading lesson…</div></div>`

  const sounds = await db.getSounds()
  const sound  = sounds.find(s => s.slug === soundSlug)

  if (!sound) {
    main.innerHTML = `<div class="page"><p class="text-muted">Sound not found: ${soundSlug}</p></div>`
    return
  }

  const [refClips, allEdges, progress] = await Promise.all([
    db.getClips(sound.id),
    db.getEdges(),
    db.getProgress(sound.id),
  ])

  const categoryBadgeClass = { kick: 'accent', hat: 'blue', snare: 'orange', bass: 'purple', fx: 'green' }[sound.category] || ''
  const attemptHistory = progress?.score_history?.slice(-10) || []

  main.innerHTML = `
    <div class="page lesson-page">
      <nav class="lesson-breadcrumb">
        <a href="#/learn">← Skill Graph</a>
      </nav>

      <div class="lesson-header">
        <div class="lesson-header-left">
          <h1>${sound.name}</h1>
          <div class="lesson-header-meta">
            <span class="badge badge--mono">${sound.symbol}</span>
            <span class="badge ${categoryBadgeClass}">${sound.category}</span>
            ${progress?.is_mastered ? '<span class="badge green">✓ Mastered</span>' : ''}
          </div>
        </div>
      </div>

      <div class="lesson-section">
        <div class="card technique-card">
          <h3>Technique</h3>
          ${sound.description ? `<p class="technique-desc">${sound.description}</p>` : ''}
          ${(sound.technique || []).length ? `
            <div class="technique-tags">
              ${(sound.technique || []).map(t => `<span class="technique-tag">${t}</span>`).join('')}
            </div>
          ` : ''}
          ${(sound.tips || []).length ? `
            <ul class="tips-list">
              ${(sound.tips || []).map(t => `<li>${t}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      </div>

      <div class="lesson-section">
        <div class="card demo-card">
          <h3>Synthesised Demo</h3>
          <p class="text-muted demo-note">A rough approximation — listen to the reference clips below for the real sound.</p>
          <button id="btn-play-demo" class="secondary">▶ Play demo (${sound.symbol})</button>
        </div>
      </div>

      <div class="lesson-section">
        <div class="card">
          <h3>Reference Clips <span class="badge">${refClips.length}</span></h3>
          ${refClips.length === 0
            ? '<p class="text-muted" style="margin-top:0.75rem">No reference clips yet. Go to Admin to add some.</p>'
            : `<div class="ref-clips-list" id="ref-clips-list"></div>`
          }
        </div>
      </div>

      <div class="lesson-section">
        <div class="card">
          <h3>Your Attempt</h3>
          ${refClips.length === 0
            ? '<p class="text-muted" style="margin-top:0.5rem">Add reference clips in Admin before attempting — they\'re needed for scoring.</p>'
            : '<div id="recorder-mount"></div>'
          }
        </div>
      </div>

      <div class="lesson-section" id="feedback-section"></div>

      ${attemptHistory.length >= 2 ? `
        <div class="lesson-section">
          <div class="card">
            <h3>Attempt History</h3>
            <div id="history-sparkline"></div>
          </div>
        </div>
      ` : ''}

      <div class="lesson-section">
        <div class="card mastery-card" id="mastery-progress"></div>
      </div>
    </div>
  `

  main.querySelector('#btn-play-demo')?.addEventListener('click', () => playDemo(sound.symbol))

  // Reference clips — play via object URL from stored ArrayBuffer
  const refList = main.querySelector('#ref-clips-list')
  if (refList && refClips.length > 0) {
    for (const clip of refClips) {
      const row = document.createElement('div')
      row.className = 'ref-clip-row'
      row.innerHTML = `
        <span class="ref-clip-label">${clip.label || 'Reference'}</span>
        ${clip.duration_ms ? `<span class="ref-clip-dur text-muted">${(clip.duration_ms / 1000).toFixed(1)}s</span>` : ''}
        <button class="secondary btn-play-clip" data-clip-id="${clip.id}">▶ Play</button>
      `
      refList.appendChild(row)
    }

    const clipMap = new Map(refClips.map(c => [c.id, c]))
    refList.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-play-clip')
      if (!btn) return
      const clip = clipMap.get(btn.dataset.clipId)
      if (!clip?.audio_data) return
      const blob = new Blob([clip.audio_data])
      const url  = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.play().catch(() => {})
      audio.addEventListener('ended', () => URL.revokeObjectURL(url))
    })
  }

  const recorderMount  = main.querySelector('#recorder-mount')
  const feedbackSection = main.querySelector('#feedback-section')
  const masteryCard     = main.querySelector('#mastery-progress')

  let consecutiveCount = countConsecutive(progress?.score_history || [], MASTERY_THRESHOLD)
  let currentProgress  = progress || null

  updateMasteryCard(masteryCard, currentProgress, consecutiveCount)

  if (recorderMount && refClips.length > 0) {
    createRecorderUI(recorderMount, {
      async onResult(audioBuffer) {
        feedbackSection.innerHTML = '<div class="card"><p class="text-muted">Scoring…</p></div>'

        let scores
        try {
          const attemptVec = await extractFeatures(audioBuffer)
          const refVecs    = refClips.map(c => c.feature_vector).filter(Boolean).map(v => new Float32Array(v))

          if (refVecs.length === 0) {
            feedbackSection.innerHTML = '<div class="card"><p class="text-muted">No feature vectors on reference clips yet. Re-upload clips in Admin.</p></div>'
            return
          }

          scores = scoreFull(attemptVec, attemptVec, refVecs, refVecs)
        } catch (err) {
          console.error('Scoring error:', err)
          feedbackSection.innerHTML = `<div class="card"><p style="color:var(--red)">Scoring failed: ${err.message}</p></div>`
          return
        }

        if (scores.overall >= MASTERY_THRESHOLD) {
          consecutiveCount++
        } else {
          consecutiveCount = 0
        }

        const newHistory    = [...(currentProgress?.score_history || []), scores.overall].slice(-20)
        const isMasteredNow = consecutiveCount >= MASTERY_CONSECUTIVE

        const progressRow = {
          sound_id:      sound.id,
          is_unlocked:   true,
          is_mastered:   isMasteredNow || (currentProgress?.is_mastered ?? false),
          best_score:    Math.max(scores.overall, currentProgress?.best_score ?? 0),
          attempt_count: (currentProgress?.attempt_count ?? 0) + 1,
          score_history: newHistory,
          last_attempt:  new Date().toISOString(),
        }

        currentProgress = await db.upsertProgress(progressRow)

        if (isMasteredNow && !progress?.is_mastered) {
          await unlockAdjacent(sound.id, allEdges)
        }

        renderFeedback(feedbackSection, scores, {
          attemptHistory:     newHistory.slice(-10),
          consecutiveCount,
          neededConsecutive:  MASTERY_CONSECUTIVE,
          masteryThreshold:   MASTERY_THRESHOLD,
        })

        updateMasteryCard(masteryCard, currentProgress, consecutiveCount)
      },
    })
  }

  const sparklineMount = main.querySelector('#history-sparkline')
  if (sparklineMount && attemptHistory.length >= 2) {
    renderFeedback(sparklineMount, null, { attemptHistory })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countConsecutive(history, threshold) {
  let count = 0
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i] >= threshold) count++
    else break
  }
  return count
}

function updateMasteryCard(el, progress, consecutiveCount) {
  if (!el) return
  const best      = progress?.best_score   || 0
  const attempts  = progress?.attempt_count || 0
  const isMastered = progress?.is_mastered  || false
  const needed    = Math.max(0, MASTERY_CONSECUTIVE - consecutiveCount)

  el.innerHTML = `
    <div class="mastery-row">
      <div class="mastery-stat">
        <span class="mastery-stat-val">${best}</span>
        <span class="mastery-stat-key">best score</span>
      </div>
      <div class="mastery-stat">
        <span class="mastery-stat-val">${attempts}</span>
        <span class="mastery-stat-key">total attempts</span>
      </div>
      <div class="mastery-stat">
        <span class="mastery-stat-val ${isMastered ? 'mastered' : ''}">${isMastered ? '✓' : needed}</span>
        <span class="mastery-stat-key">${isMastered ? 'mastered' : `more ${MASTERY_THRESHOLD}+ needed`}</span>
      </div>
    </div>
  `
}

async function unlockAdjacent(soundId, allEdges) {
  const allProgress = await db.getAllProgress()
  const masteredIds = new Set(allProgress.filter(p => p.is_mastered).map(p => p.sound_id))
  masteredIds.add(soundId)

  const toUnlock = computeUnlocks(masteredIds, allEdges)
  if (toUnlock.size === 0) return

  const existingIds = new Set(allProgress.map(p => p.sound_id))
  for (const id of toUnlock) {
    if (existingIds.has(id)) {
      const existing = allProgress.find(p => p.sound_id === id)
      await db.upsertProgress({ ...existing, is_unlocked: true })
    } else {
      await db.upsertProgress({ sound_id: id, is_unlocked: true, is_mastered: false, attempt_count: 0, score_history: [] })
    }
  }
}
