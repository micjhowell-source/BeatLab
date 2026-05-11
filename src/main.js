import './style.css'
import { router } from './lib/router.js'
import { supabase } from './supabase.js'
import { render as renderLearn } from './pages/learn.js'
import { render as renderFreeplay } from './pages/freeplay.js'
import { render as renderAdmin } from './pages/admin.js'

// ── Bootstrap shell ───────────────────────────────────────────────────────────

const appEl = document.getElementById('app')
appEl.className = 'app'

appEl.innerHTML = `
  <nav class="nav">
    <a href="#/" class="nav__brand">BEATLAB</a>
    <div class="nav__links">
      <a href="#/learn"    class="nav__link" data-route="/learn">Learn</a>
      <a href="#/freeplay" class="nav__link" data-route="/freeplay">Free Play</a>
      <a href="#/admin"    class="nav__link" data-route="/admin">Admin</a>
    </div>
    <div class="nav__user" id="nav-user">
      <button id="btn-signin" class="secondary" style="font-size:0.8rem; padding:0.35rem 0.9rem;">Sign in</button>
    </div>
  </nav>
  <div class="main-content" style="flex:1;"></div>
`

// ── Active nav link highlighting ──────────────────────────────────────────────

function updateActiveLink() {
  const hash = window.location.hash || '#/'
  document.querySelectorAll('.nav__link').forEach(link => {
    const route = link.getAttribute('data-route')
    const active = hash.startsWith('#' + route)
    link.classList.toggle('active', active)
  })
}

window.addEventListener('hashchange', updateActiveLink)
updateActiveLink()

// ── Auth UI ───────────────────────────────────────────────────────────────────

function updateNavUser(user) {
  // Stash current user on app element so page modules can access it
  appEl._currentUser = user || null

  const navUser = document.getElementById('nav-user')
  if (!navUser) return

  if (user) {
    navUser.innerHTML = `
      <span class="nav__email">${user.email}</span>
      <button id="btn-signout" class="secondary" style="font-size:0.8rem; padding:0.35rem 0.9rem;">Sign out</button>
    `
    document.getElementById('btn-signout')?.addEventListener('click', async () => {
      await supabase.auth.signOut()
    })
  } else {
    navUser.innerHTML = `
      <button id="btn-signin" class="secondary" style="font-size:0.8rem; padding:0.35rem 0.9rem;">Sign in</button>
    `
    document.getElementById('btn-signin')?.addEventListener('click', () => {
      const email = prompt('Enter your email address:')
      if (!email) return
      supabase.auth.signInWithOtp({ email })
        .then(({ error }) => {
          if (error) alert('Sign-in error: ' + error.message)
          else alert('Check your email for a magic link!')
        })
    })
  }
}

supabase.auth.onAuthStateChange((_event, session) => {
  updateNavUser(session?.user ?? null)
  // Re-render current page so admin access reflects auth state
  router._resolve()
})

// Initialise with current session
supabase.auth.getSession().then(({ data: { session } }) => {
  updateNavUser(session?.user ?? null)
})

// ── Routes ────────────────────────────────────────────────────────────────────

router.register('/', (params) => {
  // Default: redirect to learn
  window.location.hash = '#/learn'
})

router.register('/learn', (params) => {
  updateActiveLink()
  renderLearn(params)
})

router.register('/learn/:soundSlug', (params) => {
  updateActiveLink()
  renderLearn(params)
})

router.register('/freeplay', (params) => {
  updateActiveLink()
  renderFreeplay(params)
})

router.register('/freeplay/:sequenceId', (params) => {
  updateActiveLink()
  renderFreeplay(params)
})

router.register('/admin', (params) => {
  updateActiveLink()
  renderAdmin(params)
})

router.init()
