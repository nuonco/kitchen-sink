import type { ReactNode } from 'react'
import { seenSteps } from '../lib/progress'
import { operationsPath, pathSteps } from '../lib/taxonomy'
import { PathRow } from '../ui/CapabilityGrid'
import { BackLink } from '../ui/Primitives'

/* ============================================================
   The operations hub: the day-2 features as one index, rendered with the
   same numbered cards as the landing checklist. Each card is an existing
   feature page; this page adds nothing but the front door.
   ============================================================ */

export function Operations() {
  const seen = seenSteps()
  const rows = operationsPath
    .map((to) => pathSteps.find((s) => s.to === to))
    .filter((s) => s !== undefined)

  const items: ReactNode[] = []
  let phase: string | undefined
  for (const step of rows) {
    if (step.phase !== phase) {
      phase = step.phase
      items.push(
        <li key={`phase-${phase}`} className="pathlist__phase" aria-hidden="true">
          {phase}
        </li>,
      )
    }
    items.push(
      <PathRow
        key={step.to}
        step={step}
        seen={seen.has(step.to)}
        isNext={false}
      />,
    )
  }

  return (
    <>
      <BackLink to="/">Customize the Kitchen Sink</BackLink>
      <header className="page-header">
        <h1>BYOC operations</h1>
        <p className="lede">
          Day-2 without SSH or a kubeconfig — every operation runs on the
          install&rsquo;s runner, inside the customer&rsquo;s account.
        </p>
      </header>

      <ol className="pathlist">{items}</ol>
    </>
  )
}
