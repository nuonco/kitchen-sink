/**
 * The one taxonomy of everything this app can show. The landing's customize
 * hub and the bare #/customize index both render from this module, so there
 * is exactly one list of capabilities and one categorization.
 *
 * `mode` is what a tile's badge says before anyone clicks in:
 * - live: the page reads this install, right now
 * - simulation: the page walks the flow in the browser; nothing real runs
 * - guide: the page explains real config; there is nothing to run
 * The simulation badges are transitional scaffolding: they go away when the
 * simulated flows are replaced with real ones.
 */

export type Mode = 'live' | 'simulation' | 'guide'

export interface Capability {
  to: string
  icon: string
  title: string
  desc: string
  mode: Mode
}

export interface Category {
  key: string
  title: string
  blurb: string
  dayTwo: boolean
  items: Capability[]
}

export const categories: Category[] = [
  {
    key: 'install',
    title: 'This install',
    blurb: 'Read what Nuon deployed here, straight from the cluster.',
    dayTwo: false,
    items: [
      {
        to: '/deployed',
        icon: 'magnifying-glass',
        title: 'Read your live install',
        desc: 'Inspect the namespaces, pods, services, and secrets Nuon deployed here.',
        mode: 'live',
      },
      {
        to: '/map',
        icon: 'puzzle-piece',
        title: 'Map your product onto components',
        desc: 'Match the five component types to the pieces you already ship.',
        mode: 'guide',
      },
      {
        to: '/tictactoe',
        icon: 'toggle',
        title: 'Enable custom features',
        desc: 'A toggleable component gates this feature per install. Flip it on in the dashboard and watch this switch move by itself.',
        mode: 'live',
      },
    ],
  },
  {
    key: 'ship',
    title: 'Ship',
    blurb: 'Get a config change to every install safely, and back out when it goes wrong.',
    dayTwo: true,
    items: [
      {
        to: '/customize/branches',
        icon: 'git-branch',
        title: 'Ship through app branches',
        desc: 'Walk the staged rollout that ships changes group by group, and the rollback.',
        mode: 'simulation',
      },
    ],
  },
  {
    key: 'operate',
    title: 'Operate',
    blurb: 'Keep fifty installs healthy without logging into any of them.',
    dayTwo: true,
    items: [
      {
        to: '/customize/runbooks',
        icon: 'book-open',
        title: 'Run runbooks',
        desc: 'Step through the four runbooks this app ships and see which ones apply changes.',
        mode: 'simulation',
      },
      {
        to: '/customize/actions',
        icon: 'lightning',
        title: 'Run adhoc actions',
        desc: 'Walk the four actions the runner executes, with a sample transcript.',
        mode: 'simulation',
      },
      {
        to: '/customize/health',
        icon: 'heartbeat',
        title: 'Watch component health',
        desc: 'The gate every deploy has to pass, read live from this cluster.',
        mode: 'live',
      },
    ],
  },
  {
    key: 'govern',
    title: 'Govern',
    blurb: 'Bound what Nuon may do in the account, and prove it.',
    dayTwo: true,
    items: [
      {
        to: '/customize/roles',
        icon: 'lock',
        title: 'Scope operation roles',
        desc: 'The per-operation IAM roles, the break-glass role, and the OPA guardrails.',
        mode: 'guide',
      },
    ],
  },
  {
    key: 'react',
    title: 'React',
    blurb: 'Decide when scripts run: on a schedule, around a deploy, or on demand.',
    dayTwo: true,
    items: [
      {
        to: '/customize/triggers',
        icon: 'gauge',
        title: 'Wire up triggers',
        desc: 'How the actions this app ships decide when to run.',
        mode: 'guide',
      },
    ],
  },
]
