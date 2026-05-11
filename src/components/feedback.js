import { scoreLabel, scoreColor } from '../lib/utils.js'

// scores: { overall, soundMatch, brightness, sharpness, volume, feedback }
// opts:   { attemptHistory: int[], masteryThreshold: int, consecutiveCount: int }
export function renderFeedback(container, scores, opts = {}) {
  if (!scores) { container.innerHTML = ''; return }

  const {
    overall = 0,
    soundMatch = 0,
    brightness = 0,
    sharpness = 0,
    volume = 0,
    feedback = '',
  } = scores

  const {
    attemptHistory = [],
    masteryThreshold = 72,
    consecutiveCount = 0,   // how many consecutive 72+ scores user has
    neededConsecutive = 2,
  } = opts

  const label = scoreLabel(overall)
  const color = scoreColor(overall)

  const masteredNow = overall >= masteryThreshold
  const consecutiveLeft = Math.max(0, neededConsecutive - consecutiveCount)

  container.innerHTML = `
    <div class="feedback-panel card">
      <div class="feedback-score-row">
        <div class="feedback-score-big" style="color:${color}">${overall}</div>
        <div class="feedback-score-meta">
          <span class="feedback-score-label" style="color:${color}">${label}</span>
          <span class="feedback-score-sub">out of 100</span>
        </div>
      </div>

      <div class="feedback-bars">
        ${bar('Sound Match', soundMatch)}
        ${bar('Brightness',  brightness)}
        ${bar('Sharpness',   sharpness)}
        ${bar('Volume',      volume)}
      </div>

      ${feedback ? `<p class="feedback-text">${feedback}</p>` : ''}

      ${sparkline(attemptHistory)}

      <p class="feedback-mastery-hint ${masteredNow ? 'mastered' : ''}">
        ${masteryHint(masteredNow, consecutiveLeft, masteryThreshold, overall)}
      </p>
    </div>
  `
}

function bar(label, value) {
  const pct = Math.max(0, Math.min(100, value))
  const color = pct >= 72 ? 'var(--green)' : pct >= 48 ? 'var(--accent)' : pct >= 25 ? 'var(--accent2)' : 'var(--red)'
  return `
    <div class="score-bar-row">
      <span class="score-bar-label">${label}</span>
      <div class="score-bar-track">
        <div class="score-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <span class="score-bar-value" style="color:${color}">${pct}</span>
    </div>
  `
}

function sparkline(history) {
  if (!history || history.length < 2) return ''

  const W = 240, H = 44, PAD = 6
  const inner_w = W - PAD * 2
  const inner_h = H - PAD * 2
  const xStep = inner_w / (history.length - 1)

  const pts = history.map((v, i) => {
    const x = PAD + i * xStep
    const y = PAD + inner_h - (Math.max(0, Math.min(100, v)) / 100) * inner_h
    return { x, y, v }
  })

  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')

  const dots = pts.map(p => {
    const c = p.v >= 72 ? 'var(--green)' : p.v >= 48 ? 'var(--accent)' : 'var(--red)'
    return `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${c}"/>`
  }).join('')

  // Threshold line at y corresponding to score 72
  const threshY = PAD + inner_h - (72 / 100) * inner_h

  return `
    <div class="sparkline-wrap">
      <span class="sparkline-label">Last ${history.length} attempt${history.length !== 1 ? 's' : ''}</span>
      <svg class="sparkline" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <line x1="${PAD}" y1="${threshY}" x2="${W - PAD}" y2="${threshY}"
              stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>
        <polyline points="${polyline}" fill="none" stroke="var(--border)" stroke-width="1.5"/>
        ${dots}
      </svg>
    </div>
  `
}

function masteryHint(masteredNow, consecutiveLeft, threshold, score) {
  if (masteredNow && consecutiveLeft <= 0) {
    return '✓ You\'ve mastered this sound! Adjacent sounds are now unlocked.'
  }
  if (score >= threshold) {
    const more = consecutiveLeft === 1 ? '1 more time' : `${consecutiveLeft} more times`
    return `Score ${threshold}+ ${more} in a row to master this sound.`
  }
  return `Score ${threshold}+ on ${consecutiveLeft} consecutive attempt${consecutiveLeft !== 1 ? 's' : ''} to master this sound.`
}
