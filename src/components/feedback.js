/**
 * Score feedback component — Phase 1 stub.
 * Full score breakdown visualisation coming in Phase 2.
 */

/**
 * Render score feedback into the given container.
 * @param {HTMLElement} container
 * @param {Object} scores  e.g. { overall: 85, timing: 80, sound: 90 }
 */
export function renderFeedback(container, scores) {
  container.innerHTML = `
    <div class="card" style="padding:1.5rem; color:var(--text2);">
      <p style="font-family:var(--font-mono); font-size:0.85rem;">
        Feedback panel — coming in Phase 2
      </p>
    </div>
  `
}
