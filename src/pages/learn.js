/**
 * Learn page — Phase 1 stub.
 * Full skill graph will be implemented in Phase 3.
 */

export function render(params) {
  const app = document.getElementById('app')
  const main = app.querySelector('.main-content')
  if (!main) return

  main.innerHTML = `
    <div class="page">
      <h1>Learn</h1>
      <p>Skill graph coming in Phase 3.</p>
    </div>
  `
}
