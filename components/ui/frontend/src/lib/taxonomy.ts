/**
 * The one taxonomy of everything this app can show. The landing's customize
 * hub and the bare #/customize index both render from this module, so there
 * is exactly one list of capabilities and one categorization.
 *
 * `mode` is what a tile's badge says before anyone clicks in:
 * - live: the page reads this install, right now
 * - guide: the page explains real config; there is nothing to read live
 * Nothing in this app is a mock or a rehearsal: the day-2 pages hand you the
 * real CLI commands (with this install's own ids filled in) and show the
 * cluster-side evidence live where the operation has one.
 */

export type Mode = 'live' | 'guide'

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
        desc: 'Run a real staged rollout from your terminal and watch the image tags move here.',
        mode: 'live',
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
        desc: 'Run the four real runbooks this app ships; the badges say which ones apply changes.',
        mode: 'live',
      },
      {
        to: '/customize/actions',
        icon: 'lightning',
        title: 'Run adhoc actions',
        desc: 'Fire the real actions the runner executes, and watch the pod evidence live.',
        mode: 'live',
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
        desc: 'The per-operation IAM roles, the break-glass role, and the OPA guardrails — with the real proof one action run away.',
        mode: 'live',
      },
      {
        to: '/audit-log',
        icon: 'toggle',
        title: 'Sell an entitlement',
        desc: 'The audit-log exporter is gated per install, the way a plan tier gates a feature. Flip it on and watch this switch move.',
        mode: 'live',
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
  {
    key: 'drive',
    title: 'Drive it from your terminal',
    blurb: 'Every operation above is one CLI command. Run them yourself, or hand the whole tour to a coding agent.',
    dayTwo: true,
    items: [
      {
        to: '/customize/agent',
        icon: 'caret-right',
        title: 'The command menu & agent prompt',
        desc: 'The day-2 commands with this install’s ids filled in, and one copy-paste prompt for Claude Code or Codex.',
        mode: 'guide',
      },
    ],
  },
]
