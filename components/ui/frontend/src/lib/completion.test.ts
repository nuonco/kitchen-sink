// src/lib/completion.test.ts
import { describe, expect, it } from 'vitest'
import {
  clearCompletion,
  completedCount,
  completionOf,
  markComplete,
  readCompletion,
} from './completion'
import { fakeStorage } from './test-support'

describe('completion store', () => {
  it('starts empty', () => {
    expect(readCompletion(fakeStorage())).toEqual({})
  })

  it('records an advance with its timestamp', () => {
    const s = fakeStorage()
    markComplete('/deployed', 'advanced', '2026-09-10T00:00:00Z', s)
    expect(completionOf(readCompletion(s), '/deployed')).toEqual({
      kind: 'advanced',
      at: '2026-09-10T00:00:00Z',
    })
  })

  it('upgrades advanced to verified', () => {
    const s = fakeStorage()
    markComplete('/audit-log', 'advanced', '2026-09-10T00:00:00Z', s)
    markComplete('/audit-log', 'verified', '2026-09-10T00:05:00Z', s)
    expect(completionOf(readCompletion(s), '/audit-log')?.kind).toBe('verified')
  })

  it('never downgrades verified to advanced', () => {
    const s = fakeStorage()
    markComplete('/audit-log', 'verified', '2026-09-10T00:00:00Z', s)
    markComplete('/audit-log', 'advanced', '2026-09-10T00:05:00Z', s)
    const rec = completionOf(readCompletion(s), '/audit-log')
    expect(rec?.kind).toBe('verified')
    expect(rec?.at).toBe('2026-09-10T00:00:00Z')
  })

  it('counts only routes on the given path', () => {
    const s = fakeStorage()
    markComplete('/deployed', 'advanced', '2026-09-10T00:00:00Z', s)
    markComplete('/not-a-step', 'advanced', '2026-09-10T00:00:00Z', s)
    expect(completedCount(readCompletion(s), ['/deployed', '/map'])).toBe(1)
  })

  it('survives corrupt storage instead of throwing', () => {
    expect(readCompletion(fakeStorage({ 'kitchen-sink-path-complete': 'not json' }))).toEqual({})
    expect(readCompletion(fakeStorage({ 'kitchen-sink-path-complete': '["array"]' }))).toEqual({})
  })

  it('clears', () => {
    const s = fakeStorage()
    markComplete('/deployed', 'verified', '2026-09-10T00:00:00Z', s)
    clearCompletion(s)
    expect(readCompletion(s)).toEqual({})
  })
})
