// src/lib/completion.ts
/**
 * Per-step completion, kept deliberately separate from lib/progress.ts.
 *
 * `progress.ts` records that a step was *seen*, and the meter says "explored".
 * That claim stays honest and unchanged. This store records that a step was
 * *completed*, and distinguishes how:
 *
 * - 'advanced' — the reader read the page and moved on. Claims nothing more.
 * - 'verified' — the cluster confirmed the change the page asked for.
 *
 * 'verified' outranks 'advanced' and is never downgraded, so a reader who does
 * the thing and later re-walks the path does not lose the stronger claim.
 */
import { useCallback, useEffect, useState } from 'react'

const KEY = 'kitchen-sink-path-complete'

export type CompletionKind = 'advanced' | 'verified'

export interface CompletionRecord {
  kind: CompletionKind
  at: string
}

export type CompletionMap = Record<string, CompletionRecord>

function store(storage?: Storage): Storage | undefined {
  if (storage) return storage
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

function isRecord(v: unknown): v is CompletionRecord {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return (
    (r.kind === 'advanced' || r.kind === 'verified') && typeof r.at === 'string'
  )
}

export function readCompletion(storage?: Storage): CompletionMap {
  const s = store(storage)
  if (!s) return {}
  try {
    const raw = s.getItem(KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {}
    }
    const out: CompletionMap = {}
    for (const [route, rec] of Object.entries(parsed)) {
      if (isRecord(rec)) out[route] = rec
    }
    return out
  } catch {
    return {}
  }
}

export function markComplete(
  route: string,
  kind: CompletionKind,
  at: string,
  storage?: Storage,
): CompletionMap {
  const s = store(storage)
  const map = readCompletion(storage)
  const existing = map[route]
  // Verified is the stronger claim; never let a later advance erase it.
  if (existing?.kind === 'verified' && kind === 'advanced') return map
  if (existing?.kind === kind) return map
  const next: CompletionMap = { ...map, [route]: { kind, at } }
  try {
    s?.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage unavailable: the session still works, it just does not persist.
  }
  return next
}

export function completionOf(
  map: CompletionMap,
  route: string,
): CompletionRecord | undefined {
  return map[route]
}

export function completedCount(map: CompletionMap, routes: string[]): number {
  return routes.filter((r) => map[r] !== undefined).length
}

export function clearCompletion(storage?: Storage) {
  try {
    store(storage)?.removeItem(KEY)
  } catch {
    // nothing to do
  }
}

/**
 * Subscribes a view to the completion map. Re-reads on mount and whenever this
 * tab writes, which is enough: nothing else mutates the key.
 */
export function useCompletion() {
  const [map, setMap] = useState<CompletionMap>(() => readCompletion())

  const complete = useCallback((route: string, kind: CompletionKind) => {
    setMap(markComplete(route, kind, new Date().toISOString()))
  }, [])

  const reset = useCallback(() => {
    clearCompletion()
    setMap({})
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setMap(readCompletion())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return { map, complete, reset }
}
