import './style.css'
import { router } from './lib/router.js'
import { loadStaticClips } from './audio/clip-loader.js'

// Load any new clips from src/clips/ folders on every startup
loadStaticClips().catch(console.warn)
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
  </nav>
  <div class="main-content" style="flex:1;"></div>
`

// ── Active nav link highlighting ──────────────────────────────────────────────

function updateActiveLink() {
  const hash = window.location.hash || '#/'
  document.querySelectorAll('.nav__link').forEach(link => {
    const route = link.getAttribute('data-route')
    link.classList.toggle('active', hash.startsWith('#' + route))
  })
}

window.addEventListener('hashchange', updateActiveLink)
updateActiveLink()

// ── Routes ────────────────────────────────────────────────────────────────────

router.register('/', () => { window.location.hash = '#/learn' })

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
