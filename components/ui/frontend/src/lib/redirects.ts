/**
 * Where the retired hash routes go. Every old step page folded into a proof
 * panel on a case screen; a retired route opens that case with that drawer.
 * The install readme (control-plane.md) still links #/customize/branches and
 * #/customize/agent, so both must resolve here.
 */

export const redirects: ReadonlyArray<{ from: string; to: string }> = [
  { from: '/deployed', to: '/cases/no-egress?panel=workloads' },
  { from: '/map', to: '/cases/byo-vpc?panel=components' },
  { from: '/customize/branches', to: '/cases/single-tenant?panel=rollout' },
  { from: '/customize/health', to: '/cases/single-tenant?panel=health' },
  { from: '/customize/runbooks', to: '/cases/single-tenant?panel=runbooks' },
  { from: '/customize/triggers', to: '/cases/single-tenant?panel=runbooks' },
  { from: '/customize/actions', to: '/cases/single-tenant?panel=runbooks' },
  { from: '/customize/roles', to: '/cases/no-egress?panel=roles' },
  { from: '/customize/agent', to: '/home' },
  { from: '/customize', to: '/cases' },
  { from: '/audit-log', to: '/cases/single-tenant?panel=toggles' },
  { from: '/tictactoe', to: '/cases/single-tenant?panel=toggles' },
  { from: '/operations', to: '/cases' },
  { from: '/ops', to: '/cases' },
]

/** "/day2/runbooks/" -> "/customize/runbooks": the day-2 alias of the
    customize pages, then no query and no trailing slash. */
function normalize(path: string): string {
  let p = path.split('?')[0].replace(/\/+$/, '')
  if (p === '') p = '/'
  if (p === '/day2' || p.startsWith('/day2/')) p = p.replace(/^\/day2/, '/customize')
  return p
}

/** The route a retired path redirects to, or null when the path is live. */
export function redirectFor(path: string): string | null {
  const p = normalize(path)
  const hit = redirects.find((r) => r.from === p)
  if (hit) return hit.to
  // A customize flow that never existed still lands somewhere useful.
  if (p.startsWith('/customize/')) return '/cases'
  return null
}
