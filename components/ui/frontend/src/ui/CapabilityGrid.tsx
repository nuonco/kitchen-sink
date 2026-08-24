import type { ReactNode } from 'react'
import { pathSteps, stepNumber, type Mode, type PathStep } from '../lib/taxonomy'
import { seenSteps } from '../lib/progress'
import { useNavigate } from '../lib/router'
import { Badge } from './Primitives'

/* ============================================================
   The evaluation checklist, rendered from the one path in lib/taxonomy.ts:
   a numbered progression, not a grid of equal tiles. Phase markers (Read,
   Ship, Operate, Govern) label the stretch a step belongs to; the hover
   treatment keeps nuon.co/product's pixel look (cyan border snap, pixel
   arrow sliding in).

   The list remembers itself: steps the visitor has opened are checked off
   (lib/progress.ts, localStorage), the first unopened step is marked "next",
   and a counter up top says how far through the path this browser has been.
   ============================================================ */

/** nuon.co's pixel arrow (PixelArrow.astro, direction "right"). */
function PixelArrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="0" y="0" width="3" height="3" fill="currentColor" />
      <rect x="3" y="3" width="3" height="3" fill="currentColor" />
      <rect x="6" y="6" width="3" height="3" fill="currentColor" />
      <rect x="3" y="9" width="3" height="3" fill="currentColor" />
      <rect x="0" y="12" width="3" height="3" fill="currentColor" />
    </svg>
  )
}

/** The arrow's sibling: a check drawn from the same 3px pixels. */
export function PixelCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="0" y="7" width="3" height="3" fill="currentColor" />
      <rect x="3" y="10" width="3" height="3" fill="currentColor" />
      <rect x="6" y="7" width="3" height="3" fill="currentColor" />
      <rect x="9" y="4" width="3" height="3" fill="currentColor" />
      <rect x="12" y="1" width="3" height="3" fill="currentColor" />
    </svg>
  )
}

export function ModeBadge({ mode }: { mode: Mode }) {
  if (mode === 'live') {
    return (
      <Badge tone="positive" dot>
        live
      </Badge>
    )
  }
  return <Badge>guide</Badge>
}

/**
 * Live state for a toggleable-component row, keyed by the row's route:
 * whether the component is on, and whether it flipped on while the visitor
 * was watching (which earns the row a highlight).
 */
export type SwitchStates = Record<string, { on: boolean; flipped?: boolean }>

function PathRow({
  step,
  switches,
  seen,
  isNext,
}: {
  step: PathStep
  switches?: SwitchStates
  seen: boolean
  isNext: boolean
}) {
  const navigate = useNavigate()
  const isToggle = step.icon === 'toggle'
  const sw = isToggle ? switches?.[step.to] : undefined
  const cls = [
    'pathrow',
    step.bonus ? 'pathrow--bonus' : '',
    seen ? 'pathrow--seen' : '',
    isNext ? 'pathrow--next' : '',
    sw?.flipped ? 'pathrow--flipped' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const num = stepNumber(step.to)

  return (
    <li>
      <button
        className={cls}
        onClick={() => navigate(step.to)}
        {...(isNext ? { 'aria-current': 'step' as const } : {})}
      >
        <span className="pathrow__num" aria-hidden="true">
          {num ?? '+'}
        </span>
        <span className="pathrow__body">
          <span className="pathrow__title">
            <span className="pathrow__arrow" aria-hidden="true">
              <PixelArrow />
            </span>
            {step.title}
          </span>
          <span className="pathrow__desc">{step.desc}</span>
        </span>
        <span className="pathrow__meta">
          {isToggle && (
            <span
              className={
                sw?.on ? 'switch switch--sm switch--on' : 'switch switch--sm'
              }
              aria-hidden="true"
            />
          )}
          <ModeBadge mode={step.mode} />
          {seen && (
            <span className="pathrow__seen" title="You have opened this step">
              <PixelCheck />
              <span className="sr-only">explored</span>
            </span>
          )}
          {isNext && !seen && <span className="pathrow__next">next</span>}
        </span>
      </button>
    </li>
  )
}

export function EvalPath({ switches }: { switches?: SwitchStates }) {
  // Read once per mount: navigating away and back remounts the hub, which is
  // exactly when the set can have grown.
  const seen = seenSteps()
  const numbered = pathSteps.filter((s) => !s.bonus)
  const explored = numbered.filter((s) => seen.has(s.to)).length
  const nextStep = numbered.find((s) => !seen.has(s.to))

  const rows: ReactNode[] = []
  let phase: string | undefined
  for (const step of pathSteps) {
    if (!step.bonus && step.phase !== phase) {
      phase = step.phase
      rows.push(
        <li key={`phase-${phase}`} className="pathlist__phase" aria-hidden="true">
          {phase}
        </li>,
      )
    }
    if (step.bonus) {
      rows.push(
        <li key="bonus-marker" className="pathlist__phase" aria-hidden="true">
          Off the checklist
        </li>,
      )
    }
    rows.push(
      <PathRow
        key={step.to}
        step={step}
        switches={switches}
        seen={seen.has(step.to)}
        isNext={step.to === nextStep?.to}
      />,
    )
  }
  return (
    <div>
      <div className="pathmeter" role="status">
        <span className="pathmeter__label">
          {explored} of {numbered.length} explored
        </span>
        <span className="pathmeter__track" aria-hidden="true">
          <span
            className="pathmeter__fill"
            style={{ width: `${(explored / numbered.length) * 100}%` }}
          />
        </span>
      </div>
      <ol className="pathlist">{rows}</ol>
    </div>
  )
}

/* ============================================================
   Prev / next along the path, for the foot of every numbered step page.
   Without it each page is a dead end: the only way from step 04 to step 05
   is back to the hub and scroll. Bonus rows (tictactoe) stay off the rail —
   the surprise is not on the itinerary.
   ============================================================ */

function StepNavLink({
  to,
  dir,
  title,
  next = false,
}: {
  to: string
  dir: ReactNode
  title: string
  next?: boolean
}) {
  const navigate = useNavigate()
  return (
    <a
      className={next ? 'stepnav__link stepnav__link--next' : 'stepnav__link'}
      href={`#${to}`}
      onClick={(e) => {
        // navigate() also scrolls back to the top, which a bare hash change
        // would not; the href stays for open-in-new-tab.
        e.preventDefault()
        navigate(to)
      }}
    >
      <span className="stepnav__dir">{dir}</span>
      <span className="stepnav__title">{title}</span>
    </a>
  )
}

export function StepNav({ current }: { current: string }) {
  const numbered = pathSteps.filter((s) => !s.bonus)
  const i = numbered.findIndex((s) => s.to === current)
  if (i === -1) return null
  const prev = i > 0 ? numbered[i - 1] : undefined
  const next = i < numbered.length - 1 ? numbered[i + 1] : undefined

  return (
    <nav className="stepnav" aria-label="Checklist steps">
      {prev ? (
        <StepNavLink
          to={prev.to}
          dir={<>&larr; Step {stepNumber(prev.to)}</>}
          title={prev.title}
        />
      ) : (
        <StepNavLink to="/" dir={<>&larr; Checklist</>} title="Customize the Kitchen Sink" />
      )}
      {next ? (
        <StepNavLink
          to={next.to}
          dir={<>Step {stepNumber(next.to)} &rarr;</>}
          title={next.title}
          next
        />
      ) : (
        <StepNavLink to="/" dir={<>Done &rarr;</>} title="Back to the checklist" next />
      )}
    </nav>
  )
}
