/**
 * The one path through the evaluation guide. The guide index renders it, and
 * each flow page takes its place in the order from it, so there is exactly
 * one list and one order.
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
    to: '/workloads',
    icon: 'magnifying-glass',
    title: 'Open the live view',
    desc: 'The console’s main screen: namespaces, pods, services, and secrets, straight from the cluster.',
    mode: 'live',
    phase: 'Read',
  },
  {
    to: '/nuon',
    icon: 'puzzle-piece',
    title: 'Map the product onto components',
    desc: 'Every piece of Periscope, and the component type that ships it.',
    mode: 'guide',
    phase: 'Read',
  },
  {
    to: '/guide/branches',
    icon: 'git-branch',
    title: 'Ship through app branches',
    desc: 'A staged rollout with an approval on each group.',
    mode: 'live',
    phase: 'Ship',
  },
  {
    to: '/guide/health',
    icon: 'heartbeat',
    title: 'Watch component health',
    desc: 'The gate a deploy has to pass before it counts.',
    mode: 'live',
    phase: 'Operate',
  },
  {
    to: '/guide/runbooks',
    icon: 'book-open',
    title: 'Run the console SOPs',
    desc: 'Four recorded procedures; two apply changes, two archive reports.',
    mode: 'live',
    phase: 'Operate',
  },
  {
    to: '/guide/actions',
    icon: 'lightning',
    title: 'Run adhoc actions',
    desc: 'Scripts the runner executes, with no kubeconfig handed out.',
    mode: 'live',
    phase: 'Operate',
  },
  {
    to: '/guide/triggers',
    icon: 'gauge',
    title: 'Wire up triggers',
    desc: 'When scripts run: cron, lifecycle, or on demand.',
    mode: 'guide',
    phase: 'Operate',
  },
  {
    to: '/guide/roles',
    icon: 'lock',
    title: 'Scope operation roles',
    desc: 'Seven per-operation IAM roles and the guardrails on top.',
    mode: 'live',
    phase: 'Govern',
  },
  {
    to: '/guide/entitlement',
    icon: 'toggle',
    title: 'Sell an entitlement',
    desc: 'SIEM export: one component, deployed only where the plan includes it.',
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
