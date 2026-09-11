// src/lib/test-support.ts
/** Shared test doubles. Its name doesn't end in .test.ts, so vitest.config.ts's
 *  include glob never picks it up and runs it as a suite of its own. */

/** In-memory Storage stand-in so tests need no DOM. */
export function fakeStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed))
  return {
    get length() { return map.size },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => { map.delete(k) },
    setItem: (k: string, v: string) => { map.set(k, v) },
  } as Storage
}
