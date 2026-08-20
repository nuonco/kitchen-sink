#!/usr/bin/env node
// Generates src/lib/config-data.gen.ts from the repo's real app config
// (branch.toml, runbooks/, actions/, permissions/, break_glass.toml,
// policies/), so the customize views can never drift from the config.
//
// Runs automatically before `npm run dev` and `npm run build`. The generated
// file is committed because the Docker image build's context is components/ui
// only: inside that build the repo root does not exist, so this script keeps
// the committed file and exits. From a repo checkout it always regenerates.

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'smol-toml'

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outFile = join(frontendDir, 'src', 'lib', 'config-data.gen.ts')

// Walk up from the frontend directory to find the repo root.
let repoRoot = frontendDir
while (repoRoot !== '/' && !existsSync(join(repoRoot, 'branch.toml'))) {
  repoRoot = dirname(repoRoot)
}

if (!existsSync(join(repoRoot, 'branch.toml'))) {
  if (existsSync(outFile)) {
    console.log('gen-config-data: repo config not found (image build); keeping the committed config-data.gen.ts')
    process.exit(0)
  }
  console.error('gen-config-data: repo config not found and no committed config-data.gen.ts to fall back to')
  process.exit(1)
}

const read = (rel) => readFileSync(join(repoRoot, rel), 'utf8')
const toml = (rel) => parse(read(rel))

/* ---------- branch.toml ---------- */

const branch = toml('branch.toml')

const selectorText = (sel) =>
  Object.entries(sel ?? {})
    .map(([k, v]) => `${k} = ${v}`)
    .join(' · ')

const installGroups = (branch.install_groups ?? [])
  .slice()
  .sort((a, b) => a.order - b.order)
  .map((g) => ({
    name: g.name,
    order: g.order,
    selector: selectorText(g.label_selector),
    preview: Boolean(g.use_for_previews),
  }))

// The real file with its comments stripped: still the real config, abridged.
const branchConfigAbridged = read('branch.toml')
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

/* ---------- actions (one nuon.toml per directory) ---------- */

const triggerText = (t) => {
  if (t.type === 'cron') return `cron ${t.cron_schedule}`
  return t.component_name ? `${t.type} ${t.component_name}` : t.type
}

const actionOrder = ['cron_status', 'debug', 'lifecycle_hooks', 'break_glass_remediation']
const actionDirs = readdirSync(join(repoRoot, 'actions'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort((a, b) => {
    const ia = actionOrder.indexOf(a)
    const ib = actionOrder.indexOf(b)
    return (ia === -1 ? actionOrder.length : ia) - (ib === -1 ? actionOrder.length : ib)
  })

const actionsByName = {}
const adhocActions = actionDirs.map((dir) => {
  const a = toml(`actions/${dir}/nuon.toml`)
  actionsByName[a.name] = a
  return {
    name: a.name,
    timeout: a.timeout,
    triggers: (a.triggers ?? []).map(triggerText).sort((x, y) => {
      // cron and manual first, matching how the flow presents them.
      const rank = (s) => (s.startsWith('cron') ? 0 : s === 'manual' ? 1 : 2)
      return rank(x) - rank(y)
    }),
    labels: Object.entries(a.labels ?? {})
      .map(([k, v]) => `${k} = "${v}"`)
      .join(' · ') || null,
    breakGlass: Boolean(a.break_glass_role),
  }
})

const lifecycleHooksToml = read('actions/lifecycle_hooks/nuon.toml').trim()

/* ---------- runbooks/*.toml ---------- */

// A step summary from the step's real fields. Inline scripts are summarized by
// their "=== heading ===" echo lines.
const stepDetail = (step) => {
  const suffix = step.timeout ? ` · ${step.timeout}` : ''
  if (step.action_name) return `runs the ${step.action_name} action`
  if (step.type === 'component_deploy') {
    const notes = []
    if (step.plan_only) notes.push('plan only')
    if (step.deploy_dependents) notes.push('dependents follow')
    return `${step.component_name}${notes.length ? `, ${notes.join(', ')}` : ''}${suffix}`
  }
  if (step.type === 'sandbox_reprovision') {
    return `sandbox infrastructure${step.skip_component_deploys ? ', component deploys skipped' : ''}${suffix}`
  }
  if (step.inline_contents) {
    const headings = [...step.inline_contents.matchAll(/^\s*echo "=== (.+?) ==="/gm)]
      .map((m) => m[1].replace(/ \(.*\)$/, '').replace(/\s*:\s*\$\w+$/, ''))
      .filter((h, i, all) => all.indexOf(h) === i)
    if (headings.length) return `${headings.join(', ')}${suffix}`
    return `inline script${suffix}`
  }
  if (step.command) {
    if (step.command.includes('curl')) return `probe the public HTTPS endpoint${suffix}`
    return `command${suffix}`
  }
  return step.type + suffix
}

const mutatingStepTypes = new Set([
  'component_deploy',
  'sandbox_reprovision',
  'component_tear_down',
  'sandbox_deprovision',
])

const runbookOrder = ['full-health-check', 'debug-bundle', 'reconcile-drift', 'break-glass']
const runbookFiles = readdirSync(join(repoRoot, 'runbooks'))
  .filter((f) => f.endsWith('.toml'))
  .sort((a, b) => {
    const ia = runbookOrder.indexOf(basename(a, '.toml'))
    const ib = runbookOrder.indexOf(basename(b, '.toml'))
    return (ia === -1 ? runbookOrder.length : ia) - (ib === -1 ? runbookOrder.length : ib)
  })

const runbooks = runbookFiles.map((f) => {
  const rb = toml(`runbooks/${f}`)
  const steps = (rb.steps ?? []).map((s) => ({
    name: s.name,
    type: s.type,
    detail: stepDetail(s),
  }))
  const mutates = (rb.steps ?? []).some(
    (s) =>
      mutatingStepTypes.has(s.type) ||
      (s.action_name && actionsByName[s.action_name]?.break_glass_role),
  )
  return {
    name: rb.name,
    description: rb.description,
    kind: rb.labels?.kind ?? '',
    mutates,
    steps,
  }
})

/* ---------- permissions/*.toml + break_glass.toml ---------- */

const stripInstallID = (name) => name.replace(/^\{\{\.nuon\.install\.id\}\}-/, '')
const sentence = (s) => {
  const t = s.trim().replace(/\.$/, '')
  return t.charAt(0).toUpperCase() + t.slice(1) + '.'
}

const roleOrder = ['provision', 'setup', 'maintenance', 'sandbox-updates', 'actions', 'deprovision']
const roleFiles = readdirSync(join(repoRoot, 'permissions'))
  .filter((f) => f.endsWith('.toml'))
  .sort((a, b) => {
    const ia = roleOrder.indexOf(basename(a, '.toml'))
    const ib = roleOrder.indexOf(basename(b, '.toml'))
    return (ia === -1 ? roleOrder.length : ia) - (ib === -1 ? roleOrder.length : ib)
  })

const roles = roleFiles.map((f) => {
  const r = toml(`permissions/${f}`)
  return {
    name: stripInstallID(r.name),
    type: r.type,
    boundary: r.permissions_boundary ? basename(r.permissions_boundary) : 'inline policy',
    desc: sentence(r.description),
  }
})

const breakGlass = toml('break_glass.toml')
for (const role of breakGlass.role ?? []) {
  roles.push({
    name: stripInstallID(role.name),
    type: 'break-glass',
    boundary: 'explicit Deny',
    desc: sentence(role.description),
  })
}

const breakGlassToml = read('break_glass.toml').trim()

/* ---------- policies/*.toml ---------- */

const guardrails = readdirSync(join(repoRoot, 'policies'))
  .filter((f) => f.endsWith('.toml'))
  .sort()
  .map((f) => {
    const p = toml(`policies/${f}`)
    const target =
      p.type === 'sandbox'
        ? 'the sandbox plan'
        : (p.components ?? []).includes('*')
          ? 'all components'
          : (p.components ?? []).join(', ')
    return { name: basename(f, '.toml'), type: p.type, target }
  })

/* ---------- emit ---------- */

const ts = (v) => JSON.stringify(v, null, 2)

const out = `// GENERATED by scripts/gen-config-data.mjs from the repo's app config.
// Do not edit; run \`npm run build\` (or the script directly) to regenerate.
// Committed because the image build's context is components/ui only, so the
// script cannot see the repo config there and keeps this file as built.

export interface InstallGroup {
  name: string
  order: number
  selector: string
  preview: boolean
}

export interface RunbookStep {
  name: string
  type: string
  detail: string
}

export interface Runbook {
  name: string
  description: string
  kind: string
  mutates: boolean
  steps: RunbookStep[]
}

export interface AdhocAction {
  name: string
  timeout: string
  triggers: string[]
  labels: string | null
  breakGlass: boolean
}

export interface Role {
  name: string
  type: string
  boundary: string
  desc: string
}

export interface Guardrail {
  name: string
  type: string
  target: string
}

export const branchName = ${ts(branch.name)}

export const postDeployRunbooks: string[] = ${ts(branch.post_deploy_runbooks ?? [])}

export const installGroups: InstallGroup[] = ${ts(installGroups)}

export const branchConfigAbridged = ${ts(branchConfigAbridged)}

export const runbooks: Runbook[] = ${ts(runbooks)}

export const adhocActions: AdhocAction[] = ${ts(adhocActions)}

export const lifecycleHooksToml = ${ts(lifecycleHooksToml)}

export const roles: Role[] = ${ts(roles)}

export const breakGlassToml = ${ts(breakGlassToml)}

export const guardrails: Guardrail[] = ${ts(guardrails)}
`

writeFileSync(outFile, out)
console.log(`gen-config-data: wrote ${outFile}`)
