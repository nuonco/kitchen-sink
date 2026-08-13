import { useCallback, useEffect, useState } from 'react'

/**
 * Hash routing, deliberately. The Go server embeds the built frontend and
 * serves it with a plain file server, so a real path like /day2/runbooks has to
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

export function navigate(to: string) {
  window.location.hash = to
  window.scrollTo({ top: 0 })
}

export function useNavigate() {
  return useCallback((to: string) => navigate(to), [])
}

/** Splits "/day2/runbooks" into ["day2", "runbooks"]. */
export function segments(path: string): string[] {
  return path.split('/').filter(Boolean)
}
