// src/lib/use-cluster-change.ts
/**
 * Kept out of cluster-diff.ts so that file can stay pure with no React
 * import — its detectors are unit-tested under `environment: 'node'`.
 */
import { useEffect, useRef, useState } from 'react'
import type { PodFingerprint } from './cluster-diff'

/**
 * Holds the previous fingerprint and reports the first time `test` fires.
 * Latches: once true it stays true for the life of the mount, so a reader who
 * scrolls away and back still sees the step as done.
 *
 * `test` must be stable across renders — a module-level function or a
 * `useCallback` result. An inline arrow is a new identity every render, which
 * would re-run the effect on every render (it is in the dependency array) and
 * defeats the latch's job of firing exactly once.
 */
export function useClusterChange(
  current: PodFingerprint[],
  test: (prev: PodFingerprint[], next: PodFingerprint[]) => boolean,
): boolean {
  const prev = useRef<PodFingerprint[] | null>(null)
  const [fired, setFired] = useState(false)

  useEffect(() => {
    const before = prev.current
    prev.current = current
    if (!before || fired) return
    if (test(before, current)) setFired(true)
  }, [current, fired, test])

  return fired
}
