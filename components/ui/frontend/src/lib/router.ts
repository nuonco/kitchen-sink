import { useCallback, useEffect, useState } from 'react'

/**
 * Hash routing, deliberately. The Go server embeds the built frontend and
 * serves it with a plain file server, so a real path like /cases/no-egress has to
 * be handled by a fallback; a hash keeps every deep link working even if that
 * fallback is ever removed.
 */
function currentPath(): string {
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw || raw === '/') return '/'
  return raw.startsWith('/') ? raw : `/${raw}`
}

export function useRoute(): string {
  const [path, setPath] = useState(currentPath)

  useEffect(() => {
    const onChange = () => setPath(currentPath())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return path
}

export function navigate(to: string, opts: { keepScroll?: boolean } = {}) {
  window.location.hash = to
  if (!opts.keepScroll) window.scrollTo({ top: 0 })
}

/** Like navigate(), without a history entry: for redirects from retired routes. */
export function replace(to: string) {
  window.location.replace(`#${to}`)
}

export function useNavigate() {
  return useCallback((to: string, opts?: { keepScroll?: boolean }) => navigate(to, opts), [])
}

/** Splits "/cases/no-egress?panel=roles" into ["cases", "no-egress"]. */
export function segments(path: string): string[] {
  return path.split('?')[0].split('/').filter(Boolean)
}

/** The query part of a hash route: "?panel=roles" on "/cases/no-egress?panel=roles". */
export function query(path: string): URLSearchParams {
  const i = path.indexOf('?')
  return new URLSearchParams(i === -1 ? '' : path.slice(i + 1))
}
