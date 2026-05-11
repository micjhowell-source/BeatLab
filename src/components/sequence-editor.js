/**
 * Sequence editor component — Phase 1 stub.
 * Full step-sequencer grid coming in Phase 5.
 */

/**
 * Create and mount a sequence editor inside the given container.
 * @param {HTMLElement} container
 * @returns {HTMLElement} The created editor element.
 */
export function createSequenceEditor(container) {
  const el = document.createElement('div')
  el.className = 'card'
  el.style.cssText = 'padding:2rem; text-align:center; color:var(--text2);'
  el.innerHTML = `
    <p style="font-family:var(--font-mono); font-size:0.85rem;">
      Sequence editor — coming in Phase 5
    </p>
  `
  container.appendChild(el)
  return el
}
