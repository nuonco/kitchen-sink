#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'smol-toml'

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outFile = join(frontendDir, 'src', 'lib', 'config-data.gen.ts')

let repoRoot = frontendDir
while (repoRoot !== '/' && !existsSync(join(repoRoot, 'branches', 'default.toml'))) {
  repoRoot = dirname(repoRoot)
}

if (!existsSync(join(repoRoot, 'branches', 'default.toml'))) {
  if (existsSync(outFile)) {
    console.log('gen-config-data: repo config not found; keeping config-data.gen.ts')
    process.exit(0)
  }
  console.error('gen-config-data: repo config not found and no generated fallback exists')
  process.exit(1)
}

const selectorText = (selector) =>
  Object.entries(selector ?? {})
    .map(([key, value]) => `${key} = ${value}`)
    .join(' · ')

const triggerText = (trigger) => {
  if (trigger.type === 'cron') return `cron ${trigger.cron_schedule}`
  return trigger.component_name
    ? `${trigger.type} ${trigger.component_name}`
    : trigger.type
}

const stripped = (contents) =>
  contents
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

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
      .map((match) => match[1].replace(/ \(.*\)$/, '').replace(/\s*:\s*\$\w+$/, ''))
      .filter((heading, index, all) => all.indexOf(heading) === index)
    return `${headings.length ? headings.join(', ') : 'inline script'}${suffix}`
  }
  if (step.command) {
    return `${step.command.includes('curl') ? 'probe the public HTTPS endpoint' : 'command'}${suffix}`
  }
  return step.type + suffix
}

function buildConfig(root) {
  const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8')
  const toml = (relativePath) => parse(read(relativePath))
  const branch = toml('branches/default.toml')

  const installGroups = (branch.install_groups ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((group) => ({
      name: group.name,
      order: group.order,
      selector: selectorText(group.label_selector),
      preview: Boolean(group.use_for_previews),
    }))

  const actionOrder = ['cron_status', 'debug', 'lifecycle_hooks', 'break_glass_remediation']
  const actionDirs = readdirSync(join(root, 'actions'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, 'actions', entry.name, 'nuon.toml')))
    .map((entry) => entry.name)
    .sort((a, b) => {
      const left = actionOrder.indexOf(a)
      const right = actionOrder.indexOf(b)
      return (left === -1 ? actionOrder.length : left) -
        (right === -1 ? actionOrder.length : right)
    })

  const actionsByName = {}
  const adhocActions = actionDirs.map((directory) => {
    const action = toml(`actions/${directory}/nuon.toml`)
    actionsByName[action.name] = action
    return {
      name: action.name,
      timeout: action.timeout,
      triggers: (action.triggers ?? []).map(triggerText).sort((a, b) => {
        const rank = (value) => value.startsWith('cron') ? 0 : value === 'manual' ? 1 : 2
        return rank(a) - rank(b)
      }),
      labels: Object.entries(action.labels ?? {})
        .map(([key, value]) => `${key} = "${value}"`)
        .join(' · ') || null,
      breakGlass: Boolean(action.break_glass_role),
    }
  })

  const mutatingStepTypes = new Set([
    'component_deploy',
    'sandbox_reprovision',
    'component_tear_down',
    'sandbox_deprovision',
  ])
  const runbookOrder = ['full-health-check', 'debug-bundle', 'reconcile-drift', 'break-glass']
  const runbooks = readdirSync(join(root, 'runbooks'))
    .filter((file) => file.endsWith('.toml'))
    .sort((a, b) => {
      const left = runbookOrder.indexOf(basename(a, '.toml'))
      const right = runbookOrder.indexOf(basename(b, '.toml'))
      return (left === -1 ? runbookOrder.length : left) -
        (right === -1 ? runbookOrder.length : right)
    })
    .map((file) => {
      const runbook = toml(`runbooks/${file}`)
      return {
        name: runbook.name,
        description: runbook.description,
        kind: runbook.labels?.kind ?? '',
        mutates: (runbook.steps ?? []).some((step) =>
          mutatingStepTypes.has(step.type) ||
          (step.action_name && actionsByName[step.action_name]?.break_glass_role),
        ),
        steps: (runbook.steps ?? []).map((step) => ({
          name: step.name,
          type: step.type,
          detail: stepDetail(step),
        })),
      }
    })

  const stripInstallID = (name) => name.replace(/^\{\{\.nuon\.install\.id\}\}-/, '')
  const sentence = (value) => {
    const text = value.trim().replace(/\.$/, '')
    return text.charAt(0).toUpperCase() + text.slice(1) + '.'
  }
  const roleOrder = ['provision', 'setup', 'maintenance', 'sandbox-updates', 'actions', 'deprovision']
  const roles = readdirSync(join(root, 'permissions'))
    .filter((file) => file.endsWith('.toml'))
    .sort((a, b) => {
      const left = roleOrder.indexOf(basename(a, '.toml'))
      const right = roleOrder.indexOf(basename(b, '.toml'))
      return (left === -1 ? roleOrder.length : left) -
        (right === -1 ? roleOrder.length : right)
    })
    .map((file) => {
      const role = toml(`permissions/${file}`)
      return {
        name: stripInstallID(role.name),
        type: role.type,
        boundary: role.permissions_boundary ? basename(role.permissions_boundary) : 'inline policy',
        desc: sentence(role.description),
      }
    })

  const breakGlass = toml('break_glass.toml')
  for (const role of breakGlass.role ?? []) {
    roles.push({
      name: stripInstallID(role.name),
      type: 'break-glass',
      boundary: role.cloud_platform === 'gcp' ? 'predefined role' : 'explicit Deny',
      desc: sentence(role.description),
    })
  }

  const toggleableComponents = readdirSync(join(root, 'components'))
    .filter((file) => file.endsWith('.toml'))
    .map((file) => ({ file, config: toml(`components/${file}`) }))
    .filter(({ config }) => config.toggleable === true)
    .sort((a, b) => a.config.name.localeCompare(b.config.name))
    .map(({ file, config }) => ({
      name: config.name,
      type: config.type,
      defaultEnabled: Boolean(config.default_enabled),
      toml: stripped(read(`components/${file}`)),
    }))

  const guardrails = readdirSync(join(root, 'policies'))
    .filter((file) => file.endsWith('.toml'))
    .sort()
    .map((file) => {
      const policy = toml(`policies/${file}`)
      const target = policy.type === 'sandbox'
        ? 'the sandbox plan'
        : (policy.components ?? []).includes('*')
          ? 'all components'
          : (policy.components ?? []).join(', ')
      return { name: basename(file, '.toml'), type: policy.type, target }
    })

  return {
    branchName: branch.name,
    repoName: branch.public_repo?.repo ?? branch.connected_repo?.repo ?? '',
    trackedBranch: branch.public_repo?.branch ?? branch.connected_repo?.branch ?? '',
    postDeployRunbooks: branch.post_deploy_runbooks ?? [],
    installGroups,
    branchConfigAbridged: stripped(read('branches/default.toml')),
    runbooks,
    adhocActions,
    lifecycleHooksToml: read('actions/lifecycle_hooks/nuon.toml').trim(),
    roles,
    breakGlassToml: read('break_glass.toml').trim(),
    guardrails,
    toggleableComponents,
  }
}

const ts = (value) => JSON.stringify(value, null, 2)
const datasets = {
  aws: buildConfig(repoRoot),
  gcp: buildConfig(join(repoRoot, 'gcp')),
}

const output = `// GENERATED by scripts/gen-config-data.mjs from both app roots.
// Do not edit; run \`npm run build\` to regenerate.

export interface InstallGroup { name: string; order: number; selector: string; preview: boolean }
export interface RunbookStep { name: string; type: string; detail: string }
export interface Runbook { name: string; description: string; kind: string; mutates: boolean; steps: RunbookStep[] }
export interface AdhocAction { name: string; timeout: string; triggers: string[]; labels: string | null; breakGlass: boolean }
export interface Role { name: string; type: string; boundary: string; desc: string }
export interface Guardrail { name: string; type: string; target: string }
export interface ToggleableComponent { name: string; type: string; defaultEnabled: boolean; toml: string }
export interface ConfigData {
  branchName: string
  repoName: string
  trackedBranch: string
  postDeployRunbooks: string[]
  installGroups: InstallGroup[]
  branchConfigAbridged: string
  runbooks: Runbook[]
  adhocActions: AdhocAction[]
  lifecycleHooksToml: string
  roles: Role[]
  breakGlassToml: string
  guardrails: Guardrail[]
  toggleableComponents: ToggleableComponent[]
}

export const configData: Record<'aws' | 'gcp', ConfigData> = ${ts(datasets)}

export const {
  branchName,
  repoName,
  trackedBranch,
  postDeployRunbooks,
  installGroups,
  branchConfigAbridged,
  runbooks,
  adhocActions,
  lifecycleHooksToml,
  roles,
  breakGlassToml,
  guardrails,
  toggleableComponents,
} = configData.aws
`

writeFileSync(outFile, output)
console.log(`gen-config-data: wrote ${outFile}`)
