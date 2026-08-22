import { useEffect } from 'react'

/**
 * Which checklist steps this visitor has opened, remembered in localStorage
 * the same way the tour remembers its step. "Seen" is the honest claim — the
 * app can prove a page was read, not that its proof was run — so the hub says
 * "explored", never "done".
 */

const KEY = 'kitchen-sink-path-seen'

/**
 * The phase-3 routes these steps lived at. Translated on read (the key never
 * changes), so a returning visitor's progress survives the product IA.
 */
const legacyRoutes: Record<string, string> = {
  '/deployed': '/workloads',
  '/map': '/nuon',
  '/audit-log': '/guide/entitlement',
  '/customize/branches': '/guide/branches',
  '/customize/health': '/guide/health',
  '/customize/runbooks': '/guide/runbooks',
  '/customize/actions': '/guide/actions',
  '/customize/triggers': '/guide/triggers',
  '/customize/roles': '/guide/roles',
}

export function seenSteps(): Set<string> {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return new Set(
        parsed
          .filter((v): v is string => typeof v === 'string')
          .map((v) => legacyRoutes[v] ?? v),
      )
    }
  } catch {
    // No storage (private mode) or bad data: the checklist just has no memory.
  }
  return new Set()
}

export function markStepSeen(route: string) {
  try {
    const seen = seenSteps()
    if (seen.has(route)) return
    seen.add(route)
    window.localStorage.setItem(KEY, JSON.stringify([...seen]))
  } catch {
    // Same story as the tour: without storage everything still works.
  }
}

/** Views call this on mount to check themselves off the path. */
export function useMarkStepSeen(route?: string) {
  useEffect(() => {
    if (route) markStepSeen(route)
  }, [route])
}
