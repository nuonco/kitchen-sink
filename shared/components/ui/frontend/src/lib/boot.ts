/* ============================================================
   Boot tracking for the loading overlay.

   The overlay covers the app while the first round of API fetches is in
   flight. Fetches register themselves through trackBoot(); once every
   tracked promise has settled the overlay is free to dismiss (it also
   enforces its own minimum display time). After the overlay dismisses,
   endBoot() closes the window so navigation-time fetches are ignored.
   ============================================================ */

let bootOver = false
let started = false
let pending = 0
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

/** Wraps a boot-time fetch so the overlay can wait on it. Pass-through. */
export function trackBoot<T>(promise: Promise<T>): Promise<T> {
  if (bootOver) return promise
  started = true
  pending += 1
  const settle = () => {
    pending -= 1
    notify()
  }
  promise.then(settle, settle)
  return promise
}

/** True once at least one tracked fetch has started and all have settled. */
export function bootSettled(): boolean {
  return bootOver || (started && pending === 0)
}

/** Closes the boot window; later fetches are no longer tracked. */
export function endBoot() {
  bootOver = true
  listeners.clear()
}

export function subscribeBoot(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
