import type { ReactNode } from 'react'
import { pathSteps, stepNumber, type Mode, type PathStep } from '../lib/taxonomy'
import { useNavigate } from '../lib/router'
import { Badge } from './Primitives'

/* ============================================================
   The evaluation checklist, rendered from the one path in lib/taxonomy.ts:
   a numbered progression, not a grid of equal tiles. Phase markers (Read,
   Ship, Operate, Govern) label the stretch a step belongs to; the hover
   treatment keeps nuon.co/product's pixel look (cyan border snap, pixel
   arrow sliding in).
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
}: {
  step: PathStep
  switches?: SwitchStates
}) {
  const navigate = useNavigate()
  const isToggle = step.icon === 'toggle'
  const sw = isToggle ? switches?.[step.to] : undefined
  const cls = [
    'pathrow',
    step.bonus ? 'pathrow--bonus' : '',
    sw?.flipped ? 'pathrow--flipped' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const num = stepNumber(step.to)

  return (
    <li>
      <button className={cls} onClick={() => navigate(step.to)}>
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
        </span>
      </button>
    </li>
  )
}

export function EvalPath({ switches }: { switches?: SwitchStates }) {
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
    rows.push(<PathRow key={step.to} step={step} switches={switches} />)
  }
  return <ol className="pathlist">{rows}</ol>
}
