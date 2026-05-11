/**
 * Recorder UI component — Phase 1 stub.
 * Full waveform visualiser + record/stop controls coming in Phase 2.
 */

/**
 * Create and mount a recorder UI inside the given container.
 * @param {HTMLElement} container
 * @returns {HTMLElement} The created UI element.
 */
export function createRecorderUI(container) {
  const el = document.createElement('div')
  el.className = 'card'
  el.style.cssText = 'padding:2rem; text-align:center; color:var(--text2);'
  el.innerHTML = `
    <p style="font-family:var(--font-mono); font-size:0.85rem;">
      Recorder UI — coming in Phase 2
    </p>
  `
  container.appendChild(el)
  return el
}
