/**
 * The sidebar model and the route-alias table: the navigation spine of the
 * product shell. Two groups — the product pages, and the Nuon layer under
 * its own caption — plus the canonicalizer that keeps every old hash
 * working after the IA change.
 */

export type NavGroup = 'product' | 'nuon'

export interface NavItem {
  /** Canonical route, first segment only (Dashboard is '/'). */
  to: string
  label: string
  group: NavGroup
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', group: 'product' },
  { to: '/pipelines', label: 'Pipelines', group: 'product' },
  { to: '/destinations', label: 'Destinations', group: 'product' },
  { to: '/deployment', label: 'Deployment', group: 'nuon' },
  { to: '/operate', label: 'Operations', group: 'nuon' },
  { to: '/system', label: 'System', group: 'nuon' },
]

/**
 * Maps an old hash's segments onto the canonical route. Every route this app
 * has ever served keeps rendering something sensible:
 *
 *   #/map, #/customize/branches, #/day2/branches -> /deployment
 *   #/compliance, #/audit-log              -> /destinations
 *   #/under-the-hood[/:s], #/deployed[/:s] -> /system[/:s]
 *   #/ops, #/customize, #/day2             -> /operate
 *   #/customize/:flow, #/day2/:flow        -> /operate/:flow
 */
export function canonicalize(parts: string[]): string[] {
  const [head, ...rest] = parts
  switch (head) {
    case 'map':
      return ['deployment']
    case 'compliance':
    case 'audit-log':
      return ['destinations']
    case 'under-the-hood':
    case 'deployed':
      return ['system', ...rest]
    case 'ops':
      return ['operate']
    case 'customize':
    case 'day2':
      // The ship/version surface lives on Deployment now.
      if (rest[0] === 'branches') return ['deployment']
      return ['operate', ...rest]
    default:
      return parts
  }
}

/** The nav item a canonical path belongs to (pipeline detail lights Pipelines). */
export function activeNavItem(parts: string[]): string | undefined {
  if (parts.length === 0) return '/'
  const to = `/${parts[0]}`
  return navItems.some((item) => item.to === to) ? to : undefined
}
