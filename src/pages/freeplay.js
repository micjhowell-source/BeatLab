/**
 * Free Play page — Phase 1 stub.
 * Full sequence builder will be implemented in Phase 5.
 */

export function render(params) {
  const app = document.getElementById('app')
  const main = app.querySelector('.main-content')
  if (!main) return

  main.innerHTML = `
    <div class="page">
      <h1>Free Play</h1>
      <p>Sequence builder coming in Phase 5.</p>
    </div>
  `
}
