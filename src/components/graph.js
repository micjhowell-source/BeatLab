/**
 * Skill graph renderer — Phase 1 stub.
 * Full D3/canvas implementation coming in Phase 3.
 */

/**
 * Render the skill graph into the given container.
 * @param {HTMLElement} container
 * @param {Array} nodes  Array of sound node objects
 * @param {Array} edges  Array of skill edge objects
 */
export function renderGraph(container, nodes, edges) {
  container.innerHTML = `
    <div class="card" style="padding:2rem; text-align:center; color:var(--text2);">
      <p style="font-family:var(--font-mono); font-size:0.85rem;">
        Skill graph — coming in Phase 3
      </p>
      <p style="font-size:0.75rem; margin-top:0.5rem; color:var(--muted);">
        ${nodes.length} nodes · ${edges.length} edges
      </p>
    </div>
  `
}
