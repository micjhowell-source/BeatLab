/**
 * Minimal hash-based router.
 *
 * Supported route patterns:
 *   #/
 *   #/learn
 *   #/learn/:soundSlug
 *   #/freeplay
 *   #/freeplay/:sequenceId
 *   #/admin
 */

export class Router {
  constructor() {
    this._routes = []
  }

  /**
   * Register a route pattern and its handler.
   * @param {string} pattern  e.g. '/learn/:soundSlug'
   * @param {Function} handler  called with parsed params object
   */
  register(pattern, handler) {
    // Convert pattern like '/learn/:soundSlug' into a RegExp
    const keys = []
    const regexStr = pattern
      .replace(/\//g, '\\/')
      .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, key) => {
        keys.push(key)
        return '([^/]+)'
      })
    const regex = new RegExp(`^${regexStr}$`)
    this._routes.push({ pattern, regex, keys, handler })
  }

  /**
   * Resolve the current hash and fire the matching handler.
   */
  _resolve() {
    // Strip the leading '#' and default to '/'
    const hash = window.location.hash
    const path = hash.startsWith('#') ? hash.slice(1) : '/'
    const normalised = path || '/'

    for (const route of this._routes) {
      const match = normalised.match(route.regex)
      if (match) {
        const params = {}
        route.keys.forEach((key, i) => {
          params[key] = decodeURIComponent(match[i + 1])
        })
        route.handler(params)
        return
      }
    }

    // No route matched — fall back to '/'
    const fallback = this._routes.find(r => r.pattern === '/')
    if (fallback) fallback.handler({})
  }

  /**
   * Start listening for hash changes and resolve the initial route.
   */
  init() {
    window.addEventListener('hashchange', () => this._resolve())
    this._resolve()
  }
}

export const router = new Router()
export default router
