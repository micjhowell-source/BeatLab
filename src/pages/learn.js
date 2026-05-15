import { supabase } from '../supabase.js'
import { renderGraph, computeUnlocks } from '../components/graph.js'
import { createRecorderUI } from '../components/recorder-ui.js'
import { renderFeedback } from '../components/feedback.js'
import { extractFeatures } from '../audio/analyser.js'
import { scoreFull } from '../audio/similarity.js'
import { playDemo } from '../audio/synth.js'

const MASTERY_THRESHOLD = 72
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

  const [soundsRes, edgesRes] = await Promise.all([
    supabase.from('sounds').select('*').order('created_at'),
    supabase.from('skill_edges').select('*'),
  ])

  const sounds = soundsRes.data || []
  const edges  = edgesRes.data  || []

  // Foundation nodes are always unlocked (kick, hihat-closed)
  const foundationSlugs = new Set(['kick', 'hihat-closed'])
  const foundationIds   = new Set(sounds.filter(s => foundationSlugs.has(s.slug)).map(s => s.id))

  const { data: { user } } = await supabase.auth.getUser()

  let userProgress = []
  let userConnections = []
  let userGoals = []

  if (user) {
    const [pRes, cRes, gRes] = await Promise.all([
      supabase.from('user_progress').select('*').eq('user_id', user.id),
      supabase.from('user_skill_connections').select('*').eq('user_id', user.id),
      supabase.from('user_goals').select('*').eq('user_id', user.id),
    ])
    userProgress    = pRes.data    || []
    userConnections = cRes.data    || []
    userGoals       = gRes.data    || []
  }

  // Ensure foundation nodes exist in progress as unlocked
  const progressMap = new Map(userProgress.map(p => [p.sound_id, p]))
  for (const id of foundationIds) {
    if (!progressMap.has(id)) {
      progressMap.set(id, { sound_id: id, is_unlocked: true, is_mastered: false, attempt_count: 0 })
    } else {
      progressMap.get(id).is_unlocked = true
    }
  }
  userProgress = [...progressMap.values()]

  const container = main.querySelector('#graph-container')
  container.innerHTML = ''

  renderGraph(container, {
    sounds,
    edges,
    userProgress,
    userConnections,
    userGoals,
    onNodeClick(sound) {
      window.location.hash = `#/learn/${sound.slug}`
    },
    async onGoalToggle(sound, isGoal) {
      if (!user) { alert('Sign in to set goals.'); return }
      if (isGoal) {
        await supabase.from('user_goals').delete().match({ user_id: user.id, sound_id: sound.id })
      } else {
        await supabase.from('user_goals').insert({ user_id: user.id, sound_id: sound.id })
      }
      await renderGraphView(main)
    },
    async onAddConnection(fromId, toId) {
      if (!user) { alert('Sign in to add connections.'); return }
      await supabase.from('user_skill_connections').insert({
        user_id: user.id, from_sound_id: fromId, to_sound_id: toId,
      })
      await renderGraphView(main)
    },
    async onRemoveConnection(connId) {
      if (!user) return
      await supabase.from('user_skill_connections').delete().eq('id', connId)
      await renderGraphView(main)
    },
  })
}

// ─── Lesson view ──────────────────────────────────────────────────────────────

async function renderLesson(main, soundSlug) {
  main.innerHTML = `<div class="page"><div class="loading-spinner">Loading lesson…</div></div>`

  const { data: sounds } = await supabase.from('sounds').select('*').eq('slug', soundSlug).limit(1)
  const sound = sounds?.[0]

  if (!sound) {
    main.innerHTML = `<div class="page"><p class="text-muted">Sound not found: ${soundSlug}</p></div>`
    return
  }

  const [clipsRes, allEdgesRes] = await Promise.all([
    supabase.from('reference_clips').select('*').eq('sound_id', sound.id),
    supabase.from('skill_edges').select('*'),
  ])
  const refClips = clipsRes.data  || []
  const allEdges = allEdgesRes.data || []

  const { data: { user } } = await supabase.auth.getUser()

  let progress = null
  if (user) {
    const { data } = await supabase.from('user_progress').select('*')
      .eq('user_id', user.id).eq('sound_id', sound.id).limit(1)
    progress = data?.[0] || null
  }

  const categoryBadgeClass = { kick: 'accent', hat: 'blue', snare: 'orange', bass: 'purple', fx: 'green' }[sound.category] || ''
  const attemptHistory = progress?.score_history?.slice(-10) || []

  main.innerHTML = `
    <div class="page lesson-page">
      <nav class="lesson-breadcrumb">
        <a href="#/learn">← Skill Graph</a>
      </nav>

      <!-- 1. Header -->
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

      <!-- 2. Technique card -->
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

      <!-- 3. Demo section -->
      <div class="lesson-section">
        <div class="card demo-card">
          <h3>Synthesised Demo</h3>
          <p class="text-muted demo-note">A rough approximation — listen to the reference clips below for the real sound.</p>
          <button id="btn-play-demo" class="secondary">▶ Play demo (${sound.symbol})</button>
        </div>
      </div>

      <!-- 4. Reference clips -->
      <div class="lesson-section">
        <div class="card">
          <h3>Reference Clips <span class="badge">${refClips.length}</span></h3>
          ${refClips.length === 0
            ? '<p class="text-muted" style="margin-top:0.75rem">No reference clips uploaded yet. Ask the admin to add some.</p>'
            : `<div class="ref-clips-list" id="ref-clips-list"></div>`
          }
        </div>
      </div>

      <!-- 5. Attempt section -->
      <div class="lesson-section">
        <div class="card">
          <h3>Your Attempt</h3>
          ${refClips.length === 0
            ? '<p class="text-muted" style="margin-top:0.5rem">Add reference clips before attempting — they\'re needed for scoring.</p>'
            : '<div id="recorder-mount"></div>'
          }
        </div>
      </div>

      <!-- 6. Feedback -->
      <div class="lesson-section" id="feedback-section"></div>

      <!-- 7. Attempt history -->
      ${attemptHistory.length >= 2 ? `
        <div class="lesson-section">
          <div class="card">
            <h3>Attempt History</h3>
            <div id="history-sparkline"></div>
          </div>
        </div>
      ` : ''}

      <!-- 8. Progress to mastery -->
      <div class="lesson-section">
        <div class="card mastery-card" id="mastery-progress"></div>
      </div>

      ${!user ? `
        <div class="save-progress-banner" id="save-banner" style="display:none">
          <p>Sign in to save your progress and track your improvement.</p>
          <button id="btn-banner-signin">Sign in with email</button>
        </div>
      ` : ''}
    </div>
  `

  // ── Demo button ──
  main.querySelector('#btn-play-demo')?.addEventListener('click', () => {
    playDemo(sound.symbol)
  })

  // ── Reference clips ──
  const refList = main.querySelector('#ref-clips-list')
  if (refList && refClips.length > 0) {
    for (const clip of refClips) {
      const row = document.createElement('div')
      row.className = 'ref-clip-row'
      row.innerHTML = `
        <span class="ref-clip-label">${clip.label || 'Reference'}</span>
        ${clip.duration_ms ? `<span class="ref-clip-dur text-muted">${(clip.duration_ms / 1000).toFixed(1)}s</span>` : ''}
        <button class="secondary btn-play-clip" data-path="${clip.storage_path}">▶ Play</button>
      `
      refList.appendChild(row)
    }

    refList.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-play-clip')
      if (!btn) return
      const { data } = supabase.storage.from('reference-audio').getPublicUrl(btn.dataset.path)
      if (!data?.publicUrl) return
      const audio = new Audio(data.publicUrl)
      audio.play().catch(() => {})
    })
  }

  // ── Recorder & scoring ──
  const recorderMount = main.querySelector('#recorder-mount')
  const feedbackSection = main.querySelector('#feedback-section')
  const masteryCard = main.querySelector('#mastery-progress')

  let sessionAttempts = 0  // for sign-in prompt tracking
  let consecutiveCount = countConsecutive(progress?.score_history || [], MASTERY_THRESHOLD)

  updateMasteryCard(masteryCard, progress, consecutiveCount)

  if (recorderMount && refClips.length > 0) {
    createRecorderUI(recorderMount, {
      async onResult(audioBuffer) {
        feedbackSection.innerHTML = '<div class="card"><p class="text-muted">Scoring…</p></div>'

        let scores
        try {
          const attemptVec = await extractFeatures(audioBuffer)
          const attemptRaw = attemptVec   // same vector; sub-scores use indices 13-16

          const refVecs = refClips.map(c => c.feature_vector).filter(Boolean)
          const refRaws = refVecs         // same stored vectors used for sub-score comparisons

          if (refVecs.length === 0) {
            feedbackSection.innerHTML = '<div class="card"><p class="text-muted">No feature vectors on reference clips yet.</p></div>'
            return
          }

          scores = scoreFull(attemptVec, attemptRaw, refVecs, refRaws)
        } catch (err) {
          console.error('Scoring error:', err)
          feedbackSection.innerHTML = `<div class="card"><p style="color:var(--red)">Scoring failed: ${err.message}</p></div>`
          return
        }

        sessionAttempts++

        // Update consecutive count
        if (scores.overall >= MASTERY_THRESHOLD) {
          consecutiveCount++
        } else {
          consecutiveCount = 0
        }

        // Persist progress
        if (user) {
          const newHistory = [...(progress?.score_history || []), scores.overall].slice(-20)
          const isMasteredNow = consecutiveCount >= MASTERY_CONSECUTIVE

          const progressRow = {
            user_id: user.id,
            sound_id: sound.id,
            is_unlocked: true,
            is_mastered: isMasteredNow || (progress?.is_mastered ?? false),
            best_score: Math.max(scores.overall, progress?.best_score ?? 0),
            attempt_count: (progress?.attempt_count ?? 0) + 1,
            score_history: newHistory,
            last_attempt: new Date().toISOString(),
          }

          const { data: upserted } = await supabase
            .from('user_progress')
            .upsert(progressRow, { onConflict: 'user_id,sound_id' })
            .select()
            .single()

          progress = upserted || { ...progressRow }

          // Unlock adjacent sounds if newly mastered
          if (isMasteredNow && !progress?.is_mastered) {
            await unlockAdjacent(user.id, sound.id, allEdges)
          }
        }

        // Render feedback
        renderFeedback(feedbackSection, scores, {
          attemptHistory: progress?.score_history?.slice(-10) || [scores.overall],
          consecutiveCount,
          neededConsecutive: MASTERY_CONSECUTIVE,
          masteryThreshold: MASTERY_THRESHOLD,
        })

        updateMasteryCard(masteryCard, progress, consecutiveCount)

        // Sign-in prompt after 3 attempts or score > 60
        if (!user && (sessionAttempts >= 3 || scores.overall > 60)) {
          main.querySelector('#save-banner')?.style.removeProperty('display')
        }
      },
    })
  }

  // ── History sparkline (standalone) ──
  const sparklineMount = main.querySelector('#history-sparkline')
  if (sparklineMount && attemptHistory.length >= 2) {
    // Rendered inside feedback component — just import standalone version
    const { default: _ } = await import('../components/feedback.js').catch(() => ({}))
    renderFeedback(sparklineMount, null, { attemptHistory })
  }

  // ── Sign-in banner ──
  main.querySelector('#btn-banner-signin')?.addEventListener('click', () => {
    const email = prompt('Enter your email address:')
    if (!email) return
    supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
      .then(({ error }) => {
        if (error) alert('Error: ' + error.message)
        else alert('Check your email for a magic link!')
      })
  })
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
  const best = progress?.best_score || 0
  const attempts = progress?.attempt_count || 0
  const isMastered = progress?.is_mastered || false
  const needed = Math.max(0, MASTERY_CONSECUTIVE - consecutiveCount)

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

async function unlockAdjacent(userId, soundId, allEdges) {
  const { data: allProgress } = await supabase
    .from('user_progress').select('*').eq('user_id', userId)

  const masteredIds = new Set((allProgress || []).filter(p => p.is_mastered).map(p => p.sound_id))
  masteredIds.add(soundId)

  const toUnlock = computeUnlocks(masteredIds, allEdges)
  if (toUnlock.size === 0) return

  const existingIds = new Set((allProgress || []).map(p => p.sound_id))
  const inserts = []
  const updates = []

  for (const id of toUnlock) {
    if (existingIds.has(id)) {
      updates.push(supabase.from('user_progress')
        .update({ is_unlocked: true })
        .match({ user_id: userId, sound_id: id }))
    } else {
      inserts.push({ user_id: userId, sound_id: id, is_unlocked: true })
    }
  }

  await Promise.all([
    ...updates,
    inserts.length ? supabase.from('user_progress').insert(inserts) : Promise.resolve(),
  ])
}
