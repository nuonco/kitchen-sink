import { describe, expect, it } from 'vitest'
import { cases } from './cases'
import { panelIds } from './panels'
import { redirectFor, redirects } from './redirects'

/** Every hash route the app served before the fold. */
const retired = [
  '/deployed',
  '/map',
  '/customize',
  '/customize/branches',
  '/customize/agent',
  '/customize/health',
  '/customize/runbooks',
  '/customize/triggers',
  '/customize/roles',
  '/day2/branches',
  '/day2/runbooks',
  '/audit-log',
  '/tictactoe',
  '/operations',
  '/ops',
]

describe('redirects', () => {
  it('resolves every retired route', () => {
    for (const from of retired) {
      expect(redirectFor(from), from).not.toBeNull()
    }
  })

  it('leaves live routes alone', () => {
    for (const live of ['/', '/home', '/intro', '/cases', '/cases/no-egress', '/cases/no-egress?panel=roles', '/try']) {
      expect(redirectFor(live), live).toBeNull()
    }
  })

  it('ignores a query string and a trailing slash', () => {
    expect(redirectFor('/customize/runbooks/?x=1')).toBe(redirectFor('/customize/runbooks'))
  })

  it('points every case target at a real case and a mounted panel', () => {
    for (const { to } of redirects) {
      const m = /^\/cases\/([^?]+)(?:\?panel=(.+))?$/.exec(to)
      if (!m) continue
      const def = cases.find((c) => c.branch === m[1])
      expect(def, to).toBeDefined()
      if (m[2]) {
        expect(panelIds, to).toContain(m[2])
        expect(def!.panels, to).toContain(m[2])
      }
    }
  })

  it('keeps the install readme links working', () => {
    expect(redirectFor('/customize/branches')).toMatch(/^\/cases\//)
    expect(redirectFor('/customize/agent')).toBe('/home')
  })
})
