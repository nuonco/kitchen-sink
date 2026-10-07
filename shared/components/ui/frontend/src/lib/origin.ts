/**
 * Which hub the visitor last passed through: the landing checklist (/) or
 * the BYOC operations index (/operations). Feature pages reachable from both
 * use it to point their breadcrumb back at the right one. Tracked from the
 * route stream (App.tsx), so step-to-step navigation keeps the hub you
 * entered from; sessionStorage carries it across a reload within the tab.
 */

const KEY = 'kitchen-sink-last-hub'

export type Hub = '/' | '/operations'

let hub: Hub | undefined

export function recordHub(path: string) {
  if (path !== '/' && path !== '/operations') return
  hub = path
  try {
    window.sessionStorage.setItem(KEY, path)
  } catch {
    // No storage (private mode): the in-memory value still covers this visit.
  }
}

export function lastHub(): Hub {
  if (hub) return hub
  try {
    if (window.sessionStorage.getItem(KEY) === '/operations') {
      return '/operations'
    }
  } catch {
    // Fall through to the default.
  }
  return '/'
}
