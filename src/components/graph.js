import { supabase } from '../supabase.js'

const NODE_R = 30
const LAYER_H = 150
const H_SEP = 120
const SVG_PAD = 48

// ─── Layout ──────────────────────────────────────────────────────────────────

function computeLayers(nodes, edges) {
  const inEdges = new Map(nodes.map(n => [n.id, []]))
  for (const e of edges) {
    if (inEdges.has(e.to_sound_id)) inEdges.get(e.to_sound_id).push(e.from_sound_id)
  }

  const layers = new Map()

  function layerOf(id, visiting = new Set()) {
    if (layers.has(id)) return layers.get(id)
    if (visiting.has(id)) return 0
    visiting.add(id)
    const preds = inEdges.get(id) || []
    const l = preds.length === 0 ? 0 : Math.max(...preds.map(p => layerOf(p, new Set(visiting)))) + 1
    layers.set(id, l)
    return l
  }

  for (const n of nodes) layerOf(n.id)
  return layers
}

function computePositions(nodes, edges) {
  const layers = computeLayers(nodes, edges)

  const byLayer = new Map()
  for (const [id, l] of layers) {
    if (!byLayer.has(l)) byLayer.set(l, [])
    byLayer.get(l).push(id)
  }

  let maxCount = 0
  for (const [, ids] of byLayer) maxCount = Math.max(maxCount, ids.length)

  const totalWidth = Math.max(maxCount * H_SEP + H_SEP, 560)
  const maxLayer = layers.size > 0 ? Math.max(...layers.values()) : 0
  const totalHeight = (maxLayer + 1) * LAYER_H + NODE_R * 2 + SVG_PAD * 2

  const positions = new Map()
  for (const [l, ids] of byLayer) {
    const rowW = ids.length * H_SEP
    const startX = (totalWidth - rowW) / 2 + H_SEP / 2
    ids.forEach((id, i) => {
      positions.set(id, { x: startX + i * H_SEP, y: SVG_PAD + l * LAYER_H + NODE_R })
    })
  }

  return { positions, totalWidth, totalHeight }
}

// ─── SVG helpers ─────────────────────────────────────────────────────────────

const NS = 'http://www.w3.org/2000/svg'

function el(tag, attrs = {}, children = []) {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  for (const c of children) e.appendChild(c)
  return e
}

function arrowPath(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist === 0) return ''
  const ux = dx / dist, uy = dy / dist
  // Start/end offset by node radius + arrowhead size
  const sx = x1 + ux * (NODE_R + 2)
  const sy = y1 + uy * (NODE_R + 2)
  const ex = x2 - ux * (NODE_R + 10)
  const ey = y2 - uy * (NODE_R + 10)
  // Cubic bezier with vertical midpoint
  const mx = (sx + ex) / 2
  const my = (sy + ey) / 2 - Math.abs(ey - sy) * 0.2
  return `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`
}

// ─── Node state helpers ───────────────────────────────────────────────────────

function nodeState(nodeId, progressMap) {
  const p = progressMap.get(nodeId)
  if (!p) return 'locked'
  if (p.is_mastered) return 'mastered'
  if (p.attempt_count > 0) return 'in-progress'
  if (p.is_unlocked) return 'unlocked'
  return 'locked'
}

function stateStyle(state) {
  switch (state) {
    case 'mastered':     return { fill: 'var(--accent)',   stroke: 'var(--accent)', textColor: '#000' }
    case 'in-progress':  return { fill: 'var(--card)',     stroke: 'var(--accent)', textColor: 'var(--text)' }
    case 'unlocked':     return { fill: 'var(--card)',     stroke: 'var(--border)', textColor: 'var(--text)' }
    default:             return { fill: '#0D0D0D',         stroke: 'var(--border)', textColor: 'var(--muted)' }
  }
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export function renderGraph(container, {
  sounds,
  edges,
  userProgress = [],
  userConnections = [],
  userGoals = [],
  onNodeClick,
  onGoalToggle,
  onAddConnection,
  onRemoveConnection,
}) {
  container.innerHTML = ''

  if (!sounds || sounds.length === 0) {
    container.innerHTML = `<p class="text-muted" style="padding:2rem 0;font-family:var(--font-mono);font-size:0.85rem;">
      Could not load skill graph — check your Supabase connection and that the migrations have been run.
    </p>`
    return
  }

  const progressMap = new Map(userProgress.map(p => [p.sound_id, p]))
  const goalSet = new Set(userGoals.map(g => g.sound_id))

  const { positions, totalWidth, totalHeight } = computePositions(sounds, edges)

  // ── SVG root ──
  const svg = el('svg', {
    viewBox: `0 0 ${totalWidth} ${totalHeight}`,
    width: totalWidth,
    height: totalHeight,
    class: 'graph-svg',
  })

  // ── Defs: arrowheads ──
  const defs = el('defs')

  function makeMarker(id, color) {
    const marker = el('marker', {
      id,
      markerWidth: '8', markerHeight: '8',
      refX: '6', refY: '3',
      orient: 'auto',
    })
    marker.appendChild(el('path', { d: 'M0,0 L0,6 L8,3 z', fill: color }))
    return marker
  }

  defs.appendChild(makeMarker('arrow-locked',   '#333'))
  defs.appendChild(makeMarker('arrow-unlocked', 'var(--muted)'))
  defs.appendChild(makeMarker('arrow-mastered', 'var(--accent)'))
  defs.appendChild(makeMarker('arrow-user',     'var(--accent)'))
  svg.appendChild(defs)

  // ── Curated edges ──
  for (const edge of edges) {
    const from = positions.get(edge.from_sound_id)
    const to   = positions.get(edge.to_sound_id)
    if (!from || !to) continue

    const fromState = nodeState(edge.from_sound_id, progressMap)
    const toState   = nodeState(edge.to_sound_id, progressMap)
    const bothUnlocked = fromState !== 'locked' && toState !== 'locked'
    const bothMastered = fromState === 'mastered'

    const pathD = arrowPath(from.x, from.y, to.x, to.y)
    const stroke = bothMastered ? 'var(--accent)' : bothUnlocked ? 'var(--muted)' : '#2A2A2A'
    const marker = bothMastered ? 'url(#arrow-mastered)' : bothUnlocked ? 'url(#arrow-unlocked)' : 'url(#arrow-locked)'
    const dasharray = bothUnlocked ? '' : '5 4'

    svg.appendChild(el('path', {
      d: pathD,
      stroke,
      'stroke-width': '1.5',
      fill: 'none',
      'stroke-dasharray': dasharray,
      'marker-end': marker,
    }))
  }

  // ── User-defined edges ──
  for (const uc of userConnections) {
    const from = positions.get(uc.from_sound_id)
    const to   = positions.get(uc.to_sound_id)
    if (!from || !to) continue

    const pathD = arrowPath(from.x, from.y, to.x, to.y)
    svg.appendChild(el('path', {
      d: pathD,
      stroke: 'var(--accent)',
      'stroke-width': '1.5',
      fill: 'none',
      'stroke-dasharray': '4 3',
      opacity: '0.6',
      'marker-end': 'url(#arrow-user)',
    }))
  }

  // ── Node groups ──
  let pendingFromId = null // for connection drawing mode

  for (const sound of sounds) {
    const pos = positions.get(sound.id)
    if (!pos) continue

    const state = nodeState(sound.id, progressMap)
    const { fill, stroke, textColor } = stateStyle(state)
    const isGoal = goalSet.has(sound.id)
    const progress = progressMap.get(sound.id)
    const isLocked = state === 'locked'

    const g = el('g', {
      class: `graph-node graph-node--${state}${isGoal ? ' graph-node--goal' : ''}`,
      transform: `translate(${pos.x},${pos.y})`,
      style: isLocked ? 'cursor:default' : 'cursor:pointer',
    })

    // Shadow / glow for goal nodes
    if (isGoal && !isLocked) {
      g.appendChild(el('circle', {
        r: NODE_R + 6,
        fill: 'none',
        stroke: 'var(--accent)',
        'stroke-width': '2',
        opacity: '0.35',
      }))
    }

    // Main circle
    const strokeWidth = state === 'in-progress' ? '2.5' : '1.5'
    const strokeDash  = isLocked ? '4 3' : ''
    g.appendChild(el('circle', {
      r: NODE_R,
      fill,
      stroke,
      'stroke-width': strokeWidth,
      'stroke-dasharray': strokeDash,
    }))

    // Symbol label
    const symEl = el('text', {
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      y: isGoal ? '-4' : '0',
      fill: textColor,
      'font-family': 'var(--font-mono)',
      'font-size': '13',
      'font-weight': '600',
    })
    symEl.textContent = sound.symbol
    g.appendChild(symEl)

    // Sound name below circle
    const nameEl = el('text', {
      'text-anchor': 'middle',
      y: NODE_R + 16,
      fill: isLocked ? 'var(--muted)' : 'var(--text2)',
      'font-family': 'var(--font-body)',
      'font-size': '11',
    })
    nameEl.textContent = sound.name
    g.appendChild(nameEl)

    // Mastered checkmark
    if (state === 'mastered') {
      const ck = el('text', {
        'text-anchor': 'middle',
        y: NODE_R + 28,
        fill: 'var(--accent)',
        'font-size': '10',
        'font-family': 'var(--font-body)',
      })
      ck.textContent = '✓ mastered'
      g.appendChild(ck)
    }

    // In-progress attempt count
    if (state === 'in-progress' && progress) {
      const at = el('text', {
        'text-anchor': 'middle',
        y: NODE_R + 28,
        fill: 'var(--text2)',
        'font-size': '10',
        'font-family': 'var(--font-mono)',
      })
      at.textContent = `${progress.attempt_count} attempts`
      g.appendChild(at)
    }

    // Lock icon for locked nodes
    if (isLocked) {
      const lockEl = el('text', {
        'text-anchor': 'middle',
        y: NODE_R + 28,
        fill: 'var(--muted)',
        'font-size': '12',
      })
      lockEl.textContent = '🔒'
      g.appendChild(lockEl)
    }

    // Goal star badge
    if (isGoal) {
      const star = el('text', {
        'text-anchor': 'middle',
        y: '10',
        fill: 'var(--accent)',
        'font-size': '11',
      })
      star.textContent = '★'
      g.appendChild(star)
    }

    // ── Events ──
    if (!isLocked) {
      g.addEventListener('click', (e) => {
        e.stopPropagation()

        if (pendingFromId !== null && pendingFromId !== sound.id) {
          // Complete a user connection
          onAddConnection?.(pendingFromId, sound.id)
          pendingFromId = null
          svg.querySelectorAll('.graph-node--connecting').forEach(n => n.classList.remove('graph-node--connecting'))
          return
        }

        onNodeClick?.(sound)
      })

      g.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        e.stopPropagation()
        showContextMenu(e, sound, isGoal, progressMap.get(sound.id), userConnections, {
          onGoalToggle,
          onStartConnect: () => {
            pendingFromId = sound.id
            g.classList.add('graph-node--connecting')
          },
          onRemoveConnection,
        })
      })

      // Long-press → context menu on mobile
      let longPressTimer = null
      g.addEventListener('touchstart', (e) => {
        longPressTimer = setTimeout(() => {
          const touch = e.touches[0]
          const fakeEvent = { clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {}, stopPropagation: () => {} }
          showContextMenu(fakeEvent, sound, isGoal, progressMap.get(sound.id), userConnections, {
            onGoalToggle,
            onStartConnect: () => {
              pendingFromId = sound.id
              g.classList.add('graph-node--connecting')
            },
            onRemoveConnection,
          })
        }, 500)
      }, { passive: true })
      g.addEventListener('touchend', () => clearTimeout(longPressTimer), { passive: true })
    }

    svg.appendChild(g)
  }

  // Cancel pending connection on background click
  svg.addEventListener('click', () => {
    if (pendingFromId !== null) {
      pendingFromId = null
      svg.querySelectorAll('.graph-node--connecting').forEach(n => n.classList.remove('graph-node--connecting'))
    }
  })

  container.appendChild(svg)
}

// ─── Context menu ─────────────────────────────────────────────────────────────

function showContextMenu(e, sound, isGoal, progress, userConnections, { onGoalToggle, onStartConnect, onRemoveConnection }) {
  document.querySelectorAll('.graph-context-menu').forEach(m => m.remove())

  const menu = document.createElement('div')
  menu.className = 'graph-context-menu card'
  menu.style.cssText = `position:fixed;left:${e.clientX + 8}px;top:${e.clientY}px;z-index:500;min-width:180px;padding:0.5rem 0;`

  const items = []

  items.push({ label: isGoal ? '★ Remove goal' : '☆ Set as goal', action: () => onGoalToggle?.(sound, isGoal) })
  items.push({ label: '→ Connect from here', action: () => onStartConnect?.() })

  // Show remove options for user connections from this node
  const fromHere = userConnections.filter(c => c.from_sound_id === sound.id)
  for (const conn of fromHere) {
    items.push({
      label: `✕ Remove connection`,
      action: () => onRemoveConnection?.(conn.id),
      danger: true,
    })
  }

  for (const item of items) {
    const btn = document.createElement('button')
    btn.className = 'context-menu-item' + (item.danger ? ' danger' : '')
    btn.textContent = item.label
    btn.addEventListener('click', () => {
      menu.remove()
      item.action()
    })
    menu.appendChild(btn)
  }

  document.body.appendChild(menu)

  // Auto-dismiss
  const dismiss = (ev) => {
    if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', dismiss) }
  }
  setTimeout(() => document.addEventListener('click', dismiss), 10)
}

// ─── Unlock logic (used by learn.js) ─────────────────────────────────────────

// Returns the set of sound IDs that should be unlocked given current mastery state.
// masteredIds: Set of sound IDs the user has mastered
// allEdges: all skill_edges rows
export function computeUnlocks(masteredIds, allEdges) {
  const unlocked = new Set()

  for (const edge of allEdges) {
    if (!masteredIds.has(edge.from_sound_id)) continue

    const cond = edge.condition_value || {}
    if (cond.also_requires && !masteredIds.has(cond.also_requires)) continue

    unlocked.add(edge.to_sound_id)
  }

  return unlocked
}
