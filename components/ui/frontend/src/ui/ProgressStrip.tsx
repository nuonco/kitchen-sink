// src/ui/ProgressStrip.tsx
/**
 * The wizard shell. Sits under the top bar on every numbered step page so a
 * reader always knows where they are — the old design put the path only on the
 * hub, which is why people lost the thread.
 *
 * Renders nothing off-path (the tour, the hub, tic-tac-toe): there is no
 * position to report there.
 */
import { useState } from 'react'
import { useCompletion, completedCount } from '../lib/completion'
import { navigate, useRoute } from '../lib/router'
import { pathSteps } from '../lib/taxonomy'

const numbered = pathSteps.filter((s) => !s.bonus)

export function ProgressStrip() {
  // Normalised so a trailing slash or a stray query string still matches the
  // step it points at instead of silently hiding the strip.
  const route = useRoute().replace(/[?#].*$/, '').replace(/\/+$/, '') || '/'
  const { map } = useCompletion()
  const [open, setOpen] = useState(false)

  const idx = numbered.findIndex((s) => s.to === route)
  if (idx === -1) return null

  const step = numbered[idx]
  const done = completedCount(map, numbered.map((s) => s.to))

  return (
    <nav className="pstrip" aria-label="Walkthrough progress">
      <button
        className="pstrip__head"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="pstrip-path"
      >
        <span className="pstrip__pos">
          Step {String(idx + 1).padStart(2, '0')} of{' '}
          {String(numbered.length).padStart(2, '0')}
        </span>
        <span className="pstrip__phase">{step.phase}</span>
        <span className="pstrip__bar" aria-hidden="true">
          {numbered.map((s) => {
            const rec = map[s.to]
            const state = s.to === route ? 'current' : rec ? 'done' : 'todo'
            return <span key={s.to} className={`pstrip__seg pstrip__seg--${state}`} />
          })}
        </span>
        <span className="pstrip__count">{done} done</span>
      </button>

      <ul className="pstrip__path" id="pstrip-path" hidden={!open}>
        {numbered.map((s, i) => {
          const rec = map[s.to]
          return (
            <li key={s.to}>
              <button
                className={
                  s.to === route ? 'pstrip__row pstrip__row--current' : 'pstrip__row'
                }
                onClick={() => {
                  setOpen(false)
                  navigate(s.to)
                }}
              >
                <span className="pstrip__num mono">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="pstrip__title">{s.title}</span>
                {rec && (
                  <span className={`pstrip__done pstrip__done--${rec.kind}`}>
                    {rec.kind === 'verified' ? 'verified' : 'read'}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
