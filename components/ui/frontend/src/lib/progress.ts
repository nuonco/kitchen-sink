import { useEffect } from 'react'

/**
 * Which checklist steps this visitor has opened, remembered in localStorage
 * the same way the tour remembers its step. "Seen" is the honest claim — the
 * app can prove a page was read, not that its proof was run — so the hub says
 * "explored", never "done".
 */

const KEY = 'kitchen-sink-path-seen'

/**
 * The tour's own resume-point key lives here, not in Landing.tsx: Landing
 * already imports this module, so ProgressStrip importing the key from here
 * instead of from Landing avoids pulling Landing's whole module graph
 * (RelationshipDiagram, prompts, config-data) into every numbered step page,
 * and avoids turning any future Landing → ProgressStrip import into a real
 * initialization cycle.
 */
export const TOUR_KEY = 'kitchen-sink-tour'

export function seenSteps(): Set<string> {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((v): v is string => typeof v === 'string'))
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

/**
 * Start over clears every store that draws part of the path's state:
 * this one (the index's checkmarks) and the tour's resume point below.
 * Completion (lib/completion.ts) is a third, separate store with its own
 * reset().
 */
export function clearSeenSteps() {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // Same story as markStepSeen: without storage there was nothing to forget.
  }
}

export function clearTourKey() {
  try {
    window.localStorage.removeItem(TOUR_KEY)
  } catch {
    // Storage can be unavailable; the tour just won't remember to restart at
    // 'arrive' on the next load.
  }
}
