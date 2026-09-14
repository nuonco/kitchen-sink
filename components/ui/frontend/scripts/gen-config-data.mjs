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

const runbookOrder = ['full-health-check', 'debug-bundle', 're-apply-config', 'break-glass']
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

/* ---------- components/*.toml: toggleable components ---------- */

// Comment-stripped real file, same treatment as branch.toml above.
const strippedToml = (rel) =>
  read(rel)
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const toggleableComponents = readdirSync(join(repoRoot, 'components'))
  .filter((f) => f.endsWith('.toml'))
  .map((f) => ({ file: f, cfg: toml(`components/${f}`) }))
  .filter(({ cfg }) => cfg.toggleable === true)
  .sort((a, b) => a.cfg.name.localeCompare(b.cfg.name))
  .map(({ file, cfg }) => ({
    name: cfg.name,
    type: cfg.type,
    defaultEnabled: Boolean(cfg.default_enabled),
    toml: strippedToml(`components/${file}`),
  }))

/* ---------- components: every component, for the dependency graph ---------- */

// Components come in three shapes: components/*.toml, components/<name>/nuon.toml
// (chart, pulumi), and components/images/*.toml — four files in a directory with
// no nuon.toml. Recursing one level covers all three without hardcoding a filename.
const componentFiles = []
for (const entry of readdirSync(join(repoRoot, 'components'), { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.toml')) {
    componentFiles.push(`components/${entry.name}`)
    continue
  }
  if (!entry.isDirectory()) continue
  for (const inner of readdirSync(join(repoRoot, 'components', entry.name))) {
    if (inner.endsWith('.toml')) componentFiles.push(`components/${entry.name}/${inner}`)
  }
}

const components = componentFiles
  .map((rel) => toml(rel))
  .filter((cfg) => cfg.name && cfg.type)
  .map((cfg) => ({
    name: cfg.name,
    type: cfg.type,
    dependencies: Array.isArray(cfg.dependencies) ? cfg.dependencies : [],
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

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
    return {
      name: basename(f, '.toml'),
      file: `policies/${f}`,
      type: p.type,
      target,
      components: p.components ?? [],
      rego: read(`policies/${basename(p.contents ?? '')}`).trim(),
    }
  })

/* ---------- install-configs/*.toml ---------- */

// An install config joins the first branch group whose selector its labels
// satisfy, the same rule the control plane applies.
const selectorMatches = (labels, selector) =>
  Object.entries(selector ?? {}).every(([k, v]) => labels?.[k] === v)

const groupOf = (labels) =>
  (branch.install_groups ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .find((g) => selectorMatches(labels, g.label_selector))?.name ?? null

const installConfigs = readdirSync(join(repoRoot, 'install-configs'))
  .filter((f) => f.endsWith('.toml'))
  .sort()
  .map((f) => {
    const c = toml(`install-configs/${f}`)
    const labels = c.labels ?? {}
    return {
      name: c.name,
      file: `install-configs/${f}`,
      labels,
      group: groupOf(labels),
      region: c.aws_account?.region ?? null,
      approvalOption: c.approval_option ?? null,
      inputs: Object.assign({}, ...(c.inputs ?? [])),
      toggles: c.component_toggles ?? {},
    }
  })

/* ---------- inputs/<group>/<name>.toml + input_groups/<group>.toml ---------- */

const inputGroups = readdirSync(join(repoRoot, 'input_groups'))
  .filter((f) => f.endsWith('.toml'))
  .sort()
  .map((f) => {
    const g = toml(`input_groups/${f}`)
    return { name: g.name, displayName: g.display_name ?? g.name, description: g.description ?? '' }
  })

const inputs = []
for (const dir of readdirSync(join(repoRoot, 'inputs'), { withFileTypes: true })) {
  if (!dir.isDirectory()) continue
  for (const f of readdirSync(join(repoRoot, 'inputs', dir.name)).filter((n) => n.endsWith('.toml')).sort()) {
    const i = toml(`inputs/${dir.name}/${f}`)
    inputs.push({
      name: i.name,
      displayName: i.display_name ?? i.name,
      description: i.description ?? '',
      group: i.group ?? dir.name,
      type: i.type ?? 'string',
      default: i.default === undefined ? null : String(i.default),
      required: Boolean(i.required),
      sensitive: Boolean(i.sensitive),
      internal: Boolean(i.internal),
      userConfigurable: Boolean(i.user_configurable),
      file: `inputs/${dir.name}/${f}`,
    })
  }
}
inputs.sort((a, b) => a.name.localeCompare(b.name))

/* ---------- stack.toml, runner.toml, sandbox.toml ---------- */

// { path: "vpc/eks/default", version: "v0.4.0" } from a published template URL.
const templateVariant = (url) => {
  const m = /aws-cloudformation-templates\/(v[\d.]+)\/(.+?)\/stack\.yaml$/.exec(url ?? '')
  return m ? { path: m[2], version: m[1] } : { path: url ?? '', version: '' }
}

const stackCfg = toml('stack.toml')
const stack = {
  type: stackCfg.type ?? '',
  vpcTemplateUrl: stackCfg.vpc_nested_template_url ?? '',
  vpcTemplate: templateVariant(stackCfg.vpc_nested_template_url),
  runnerTemplateUrl: stackCfg.runner_nested_template_url ?? '',
  runnerTemplate: templateVariant(stackCfg.runner_nested_template_url),
  customNestedStacks: (stackCfg.custom_nested_stacks ?? [])
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((s) => ({ name: s.name, index: s.index })),
}

const runnerCfg = toml('runner.toml')
const runner = {
  type: runnerCfg.runner_type ?? '',
  helmDriver: runnerCfg.helm_driver ?? '',
  initScriptUrl: runnerCfg.init_script_url ?? '',
}

const sandboxCfg = toml('sandbox.toml')
const sandbox = {
  repo: sandboxCfg.public_repo?.repo ?? sandboxCfg.connected_repo?.repo ?? '',
  branch: sandboxCfg.public_repo?.branch ?? sandboxCfg.connected_repo?.branch ?? '',
  terraformVersion: sandboxCfg.terraform_version ?? '',
  vars: Object.entries(sandboxCfg.vars ?? {}).map(([name, value]) => ({ name, value: String(value) })),
  tfvars: strippedToml('sandbox.tfvars'),
}

/* ---------- [health] blocks on components ---------- */

const healthBlocks = componentFiles
  .map((rel) => toml(rel))
  .filter((cfg) => cfg.name && cfg.health)
  .map((cfg) => ({
    component: cfg.name,
    enabled: cfg.health.enabled !== false,
    blockDeploy: Boolean(cfg.health.block_deploy),
    stabilizationWindow: cfg.health.stabilization_window ?? null,
    probes: (cfg.health.probes ?? []).length,
  }))
  .sort((a, b) => a.component.localeCompare(b.component))

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
  file: string
  type: string
  target: string
  components: string[]
  rego: string
}

export interface InstallConfig {
  name: string
  file: string
  labels: Record<string, string>
  /** The branch group whose selector these labels satisfy, or null. */
  group: string | null
  region: string | null
  approvalOption: string | null
  inputs: Record<string, string>
  toggles: Record<string, boolean>
}

export interface InputGroup {
  name: string
  displayName: string
  description: string
}

export interface InputDef {
  name: string
  displayName: string
  description: string
  group: string
  type: string
  default: string | null
  required: boolean
  sensitive: boolean
  internal: boolean
  userConfigurable: boolean
  file: string
}

export interface TemplateVariant {
  path: string
  version: string
}

export interface StackInfo {
  type: string
  vpcTemplateUrl: string
  vpcTemplate: TemplateVariant
  runnerTemplateUrl: string
  runnerTemplate: TemplateVariant
  customNestedStacks: Array<{ name: string; index: number }>
}

export interface RunnerInfo {
  type: string
  helmDriver: string
  initScriptUrl: string
}

export interface SandboxInfo {
  repo: string
  branch: string
  terraformVersion: string
  vars: Array<{ name: string; value: string }>
  tfvars: string
}

export interface HealthBlock {
  component: string
  enabled: boolean
  blockDeploy: boolean
  stabilizationWindow: string | null
  probes: number
}

export interface ToggleableComponent {
  name: string
  type: string
  defaultEnabled: boolean
  toml: string
}

export interface ComponentNode {
  name: string
  type: string
  dependencies: string[]
}

export const branchName = ${ts(branch.name)}

export const repoName = ${ts(branch.public_repo?.repo ?? branch.connected_repo?.repo ?? '')}

export const postDeployRunbooks: string[] = ${ts(branch.post_deploy_runbooks ?? [])}

export const installGroups: InstallGroup[] = ${ts(installGroups)}

export const branchConfigAbridged = ${ts(branchConfigAbridged)}

export const runbooks: Runbook[] = ${ts(runbooks)}

export const adhocActions: AdhocAction[] = ${ts(adhocActions)}

export const lifecycleHooksToml = ${ts(lifecycleHooksToml)}

export const roles: Role[] = ${ts(roles)}

export const breakGlassToml = ${ts(breakGlassToml)}

export const guardrails: Guardrail[] = ${ts(guardrails)}

export const toggleableComponents: ToggleableComponent[] = ${ts(toggleableComponents)}

export const components: ComponentNode[] = ${ts(components)}

export const installConfigs: InstallConfig[] = ${ts(installConfigs)}

export const inputGroups: InputGroup[] = ${ts(inputGroups)}

export const inputs: InputDef[] = ${ts(inputs)}

export const stack: StackInfo = ${ts(stack)}

export const runner: RunnerInfo = ${ts(runner)}

export const sandbox: SandboxInfo = ${ts(sandbox)}

export const healthBlocks: HealthBlock[] = ${ts(healthBlocks)}
`

writeFileSync(outFile, out)
console.log(`gen-config-data: wrote ${outFile}`)
