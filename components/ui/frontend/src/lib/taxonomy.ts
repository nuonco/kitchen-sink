/**
 * The one path through this app. The landing hub and the bare #/customize
 * index both render it, and each feature page takes its step number from it,
 * so there is exactly one list and one order.
 *
 * The order is how an engineer sizes up a BYOC product: watch it work, read
 * what it put in the account, then ship to it, operate it, and govern it.
 * Each page states a problem, shows the config that answers it, and hands
 * you the proof to run against this install.
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
    to: '/pipelines',
    icon: 'gauge',
    title: 'Watch your pipelines',
    desc: 'Runs, rows copied, and the object keys written to your bucket.',
    mode: 'live',
    phase: 'Read',
  },
  {
    to: '/under-the-hood',
    icon: 'magnifying-glass',
    title: 'Look under the hood',
    desc: 'Pods, services, secrets, and events, straight from the cluster.',
    mode: 'live',
    phase: 'Read',
  },
  {
    to: '/map',
    icon: 'puzzle-piece',
    title: 'Map your product onto components',
    desc: 'The five component types against the pieces that run a pipeline.',
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
    desc: 'Four recorded procedures; two of them apply changes.',
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
    desc: 'Seven per-operation IAM roles, proved by the pause drill.',
    mode: 'live',
    phase: 'Govern',
  },
  {
    to: '/destinations',
    icon: 'toggle',
    title: 'Sell a destination',
    desc: 'The compliance export deploys only where the plan includes it.',
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

/** The eyebrow a feature page wears: "Step 03 of 10 · Ship". */
export function stepEyebrow(to: string): string {
  const step = pathSteps.find((s) => s.to === to)
  const num = stepNumber(to)
  if (!step || !num) return 'Customize'
  return `Step ${num} of ${String(numbered.length).padStart(2, '0')} · ${step.phase}`
}
