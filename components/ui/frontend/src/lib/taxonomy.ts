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

import { roles, runbooks } from './config-data.gen'
import { useCases } from './prompts'

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
    to: '/deployed',
    icon: 'magnifying-glass',
    title: 'What Nuon deployed',
    desc: 'The app running in this account, read live, and the architecture it demonstrates.',
    mode: 'live',
    phase: 'Read',
  },
  {
    to: '/map',
    icon: 'puzzle-piece',
    title: 'Your product as components',
    desc: 'The five component types against the pieces you already ship.',
    mode: 'guide',
    phase: 'Read',
  },
  {
    to: '/customize/branches',
    icon: 'git-branch',
    title: 'App branches',
    desc: 'A staged rollout with an approval on each group.',
    mode: 'live',
    phase: 'Ship',
  },
  {
    to: '/customize/agent',
    icon: 'lightning',
    title: 'Coding agent setup',
    desc: `Nuon’s MCP server in Claude Code, Cursor, or Amp, and ${useCases.length} things to ask it about this install.`,
    mode: 'guide',
    phase: 'Ship',
  },
  {
    to: '/customize/health',
    icon: 'heartbeat',
    title: 'Component health',
    desc: 'Pod readiness read live, and the [health] blocks on the chart and the ALB.',
    mode: 'live',
    phase: 'Operate',
  },
  {
    to: '/customize/runbooks',
    icon: 'book-open',
    title: 'Runbooks',
    desc: `${runbooks.length} recorded procedures; ${runbooks.filter((r) => r.mutates).length} of them apply changes.`,
    mode: 'live',
    phase: 'Operate',
  },
  {
    to: '/customize/triggers',
    icon: 'gauge',
    title: 'Triggers',
    desc: 'When scripts run: cron, lifecycle, or on demand.',
    mode: 'guide',
    phase: 'Operate',
  },
  {
    to: '/customize/roles',
    icon: 'lock',
    title: 'Operation roles',
    desc: `${roles.filter((r) => r.type !== 'break-glass').length} per-operation IAM roles, plus break-glass, and the guardrails on top.`,
    mode: 'live',
    phase: 'Govern',
  },
  {
    to: '/audit-log',
    icon: 'toggle',
    title: 'SKU management',
    desc: 'Components that ship off and deploy only where you switch them on.',
    mode: 'live',
    phase: 'Govern',
  },
  {
    to: '/tictactoe',
    icon: 'toggle',
    title: 'Tic-tac-toe',
    desc: 'Also toggleable; playable once it’s switched on.',
    mode: 'live',
    phase: 'Govern',
    bonus: true,
  },
]

/** The steps the #/operations hub fronts, in its order. */
export const operationsPath = [
  '/customize/health',
  '/customize/runbooks',
  '/customize/triggers',
  '/customize/roles',
]

/** The numbered path: every step except the bonus tic-tac-toe row. The hub
 *  and the progress strip both derive their step count and their index from
 *  this one array. */
export const numberedSteps = pathSteps.filter((step) => !step.bonus)

/** "03" for the third numbered step; undefined for bonus rows. */
export function stepNumber(to: string): string | undefined {
  const i = numberedSteps.findIndex((step) => step.to === to)
  return i === -1 ? undefined : String(i + 1).padStart(2, '0')
}

