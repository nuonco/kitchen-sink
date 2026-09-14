import { describe, expect, it } from 'vitest'
import { caseBranch, cases, shipsTo } from './cases'

const config = { install_id: 'inl-test-install', app_id: 'app-test', links: {} }

describe('cases', () => {
  it('has a branch record with at least one changed file for every case', () => {
    for (const c of cases) {
      const b = caseBranch(c.branch)
      expect(b, c.branch).toBeDefined()
      expect(b!.files.length, c.branch).toBeGreaterThan(0)
      expect(b!.files.some((f) => f.minus.length + f.plus.length > 0), c.branch).toBe(true)
    }
  })

  it("names itself in its own branch.toml and tracks its own git branch", () => {
    for (const c of cases) {
      const b = caseBranch(c.branch)!
      expect(b.branchName).toBe(c.branch)
      expect(b.trackedBranch).toBe(c.branch)
    }
  })

  it('ships to exactly one group, read from the branch', () => {
    for (const c of cases) {
      expect(caseBranch(c.branch)!.groups.length, c.branch).toBe(1)
      expect(shipsTo(c.branch)?.name, c.branch).toBeTruthy()
    }
  })

  it('every headline prompt names the install id', () => {
    for (const c of cases) {
      expect(c.prompt(config)).toContain(config.install_id)
    }
  })
})
