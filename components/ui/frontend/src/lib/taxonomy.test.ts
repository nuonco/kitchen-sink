import { describe, expect, it } from 'vitest'
import { completedCount, markComplete, readCompletion } from './completion'
import { fakeStorage } from './test-support'
import { numberedSteps, pathSteps } from './taxonomy'

describe('numberedSteps', () => {
  it('has nine entries, none of them bonus', () => {
    expect(numberedSteps.length).toBe(9)
    expect(numberedSteps.every((s) => !s.bonus)).toBe(true)
  })

  it('leaves the tic-tac-toe bonus row out, though pathSteps still carries it', () => {
    expect(pathSteps.some((s) => s.to === '/tictactoe')).toBe(true)
    expect(numberedSteps.some((s) => s.to === '/tictactoe')).toBe(false)
  })

  it('is only fully counted when every numbered route is complete', () => {
    const routes = numberedSteps.map((s) => s.to)
    const s = fakeStorage()

    // Every route but the last: not satisfied.
    for (const route of routes.slice(0, -1)) {
      markComplete(route, 'advanced', '2026-09-10T00:00:00Z', s)
    }
    expect(completedCount(readCompletion(s), routes)).toBe(routes.length - 1)
    expect(completedCount(readCompletion(s), routes)).not.toBe(routes.length)

    // /tictactoe instead of the real last route: still not satisfied,
    // because /tictactoe isn't in the numbered route list.
    markComplete('/tictactoe', 'advanced', '2026-09-10T00:00:00Z', s)
    expect(completedCount(readCompletion(s), routes)).toBe(routes.length - 1)

    // The actual last numbered route: now satisfied.
    markComplete(routes[routes.length - 1], 'advanced', '2026-09-10T00:00:00Z', s)
    expect(completedCount(readCompletion(s), routes)).toBe(routes.length)
  })
})
