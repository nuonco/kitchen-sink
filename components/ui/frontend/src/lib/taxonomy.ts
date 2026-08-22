/**
 * The one path through this app. The landing hub and the bare #/customize
 * index both render it, and each feature page takes its step number from it,
 * so there is exactly one list and one order.
 *
 * The order is how an engineer sizes up a BYOC system: read what it put in
 * the account, ship to it, operate it, govern it, then charge for it. Each
 * page states a problem, shows the config that answers it, and hands you the
 * proof to run against this install.
 *
 * `mode` is what a row's badge says before anyone clicks in:
 * - live: the page reads this install, right now
 * - guide: the page explains real config; there is nothing to read live
 */

export type Mode = 'live' | 'guide'

export interface PathStep {
  to: string
  icon: string
  title: string
  desc: string
  mode: Mode
  phase: 'Read' | 'Ship' | 'Operate' | 'Govern'
  /** Off the numbered path: the surprise at the end. */
  bonus?: boolean
}

export const pathSteps: PathStep[] = [
  {
    to: '/delivery',
    icon: 'lightning',
    title: 'Watch Relay deliver',
    desc: 'Events, per-attempt retries, and the dead-letter queue — with a real replay.',
    mode: 'live',
    phase: 'Read',
  },
  {
    to: '/deployed',
    icon: 'magnifying-glass',
    title: 'Read your live install',
    desc: 'Namespaces, pods, services, and secrets, straight from the cluster.',
    mode: 'live',
    phase: 'Read',
  },
  {
    to: '/map',
    icon: 'puzzle-piece',
    title: 'Map your product onto components',
    desc: 'Every piece of Relay, and the component type that ships it.',
    mode: 'guide',
    phase: 'Read',
  },
  {
    to: '/customize/branches',
    icon: 'git-branch',
    title: 'Ship through app branches',
    desc: 'A staged rollout with an approval on each group.',
    mode: 'live',
    phase: 'Ship',
  },
  {
    to: '/customize/health',
    icon: 'heartbeat',
    title: 'Watch component health',
    desc: 'The gate a deploy has to pass before it counts.',
    mode: 'live',
    phase: 'Operate',
  },
  {
    to: '/customize/runbooks',
    icon: 'book-open',
    title: 'Run runbooks',
    desc: 'Recorded procedures, from a health sweep to a DLQ drain.',
    mode: 'live',
    phase: 'Operate',
  },
  {
    to: '/customize/actions',
    icon: 'lightning',
    title: 'Run adhoc actions',
    desc: 'Scripts the runner executes, with no kubeconfig handed out.',
    mode: 'live',
    phase: 'Operate',
  },
  {
    to: '/customize/triggers',
    icon: 'gauge',
    title: 'Wire up triggers',
    desc: 'When scripts run: cron, lifecycle, or on demand.',
    mode: 'guide',
    phase: 'Operate',
  },
  {
    to: '/customize/roles',
    icon: 'lock',
    title: 'Scope operation roles',
    desc: 'Seven per-operation IAM roles and the guardrails on top.',
    mode: 'live',
    phase: 'Govern',
  },
  {
    to: '/audit-log',
    icon: 'toggle',
    title: 'Sell an entitlement',
    desc: 'Delivery-log export to S3, deployed only where the plan includes it.',
    mode: 'live',
    phase: 'Govern',
  },
  {
    to: '/tictactoe',
    icon: 'toggle',
    title: 'Enable custom features',
    desc: 'The other toggleable component. Less businesslike.',
    mode: 'live',
    phase: 'Govern',
    bonus: true,
  },
]

const numbered = pathSteps.filter((step) => !step.bonus)

/** "03" for the third numbered step; undefined for bonus rows. */
export function stepNumber(to: string): string | undefined {
  const i = numbered.findIndex((step) => step.to === to)
  return i === -1 ? undefined : String(i + 1).padStart(2, '0')
}

/** The eyebrow a feature page wears: "Step 03 of 09 · Ship". */
export function stepEyebrow(to: string): string {
  const step = pathSteps.find((s) => s.to === to)
  const num = stepNumber(to)
  if (!step || !num) return 'Customize'
  return `Step ${num} of ${String(numbered.length).padStart(2, '0')} · ${step.phase}`
}
