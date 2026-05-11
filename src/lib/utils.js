export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

export function debounce(fn, delay) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export function formatScore(score) {
  return Math.round(clamp(score, 0, 100))
}

export function scoreLabel(score) {
  if (score >= 72) return 'Mastered'
  if (score >= 48) return 'Getting there'
  if (score >= 25) return 'Recognisable'
  return 'Keep practising'
}

export function scoreColor(score) {
  if (score >= 72) return 'var(--green)'
  if (score >= 48) return 'var(--accent)'
  if (score >= 25) return 'var(--accent2)'
  return 'var(--red)'
}
