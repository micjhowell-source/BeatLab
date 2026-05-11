/**
 * Admin page — Phase 1 stub.
 * Full admin panel (sound management, reference clip uploads) coming in Phase 2.
 */

export function render(params) {
  const app = document.getElementById('app')
  const main = app.querySelector('.main-content')
  if (!main) return

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  const currentUser = app._currentUser || null
  const isAdmin = currentUser && adminEmail && currentUser.email === adminEmail

  if (!isAdmin) {
    main.innerHTML = `
      <div class="page">
        <h1>Admin</h1>
        <div class="card" style="max-width:400px; margin-top:1.5rem;">
          <p style="color:var(--red); font-weight:600;">Access denied.</p>
          <p style="color:var(--text2); margin-top:0.5rem; font-size:0.875rem;">
            You must be signed in as an admin to access this area.
          </p>
        </div>
      </div>
    `
    return
  }

  main.innerHTML = `
    <div class="page">
      <h1>Admin Panel</h1>
      <div class="card" style="margin-top:1.5rem;">
        <p style="color:var(--text2);">Sound management and reference clip upload coming in Phase 2.</p>
        <p style="margin-top:0.75rem; font-size:0.8rem; font-family:var(--font-mono); color:var(--muted);">
          Signed in as: ${currentUser.email}
        </p>
      </div>
    </div>
  `
}
