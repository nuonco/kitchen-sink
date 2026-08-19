import { useEffect, useRef, useState } from 'react'
import type { UIConfig } from '../lib/api'
import { useNavigate } from '../lib/router'
import {
  BackLink,
  Badge,
  Callout,
  CodeBlock,
  Eyebrow,
  Icon,
  OutLink,
} from '../ui/Primitives'

/* ============================================================
   Interactive setup-flow stubs for the customize page. Every flow is
   grounded in this repo's real config (branch.toml, runbooks/, actions/,
   permissions/, break_glass.toml, policies/): real names, real steps, real
   orders. The "run" and "approve" controls SIMULATE the operation in the
   browser; nothing on these pages calls a mutating API. The real versions
   of these operations live in the Nuon dashboard and CLI.
   ============================================================ */

function DemoBanner() {
  return (
    <div className="demo-banner">
      <Badge tone="warning" dot>
        preview
      </Badge>
      <span>
        The controls below simulate each operation in the browser. Nothing on
        this page changes the real install; the live versions run from the
        Nuon dashboard and CLI.
      </span>
    </div>
  )
}

function FlowHeader({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string
  title: string
  lede: string
}) {
  return (
    <header className="page-header">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1>{title}</h1>
      <p className="lede">{lede}</p>
    </header>
  )
}

/* ============================================================
   Flow: Configure app branches (branch.toml)
   ============================================================ */

type GroupState = 'waiting' | 'planning' | 'approval' | 'deploying' | 'healthy'

const installGroups = [
  {
    name: 'staging',
    order: 1,
    selector: 'env = staging',
    note: 'use_for_previews: PR preview plans run here',
  },
  {
    name: 'customers',
    order: 2,
    selector: 'env = production · tier = customer',
    note: 'the production fleet',
  },
  {
    name: 'enterprise',
    order: 3,
    selector: 'env = production · tier = enterprise',
    note: 'the installs with change windows',
  },
]

function groupBadge(state: GroupState) {
  if (state === 'waiting') return <Badge>waiting</Badge>
  if (state === 'planning')
    return (
      <Badge tone="warning" dot>
        planning
      </Badge>
    )
  if (state === 'approval')
    return (
      <Badge tone="accent" dot>
        awaiting approval
      </Badge>
    )
  if (state === 'deploying')
    return (
      <Badge tone="warning" dot>
        deploying
      </Badge>
    )
  return (
    <Badge tone="positive" dot>
      healthy
    </Badge>
  )
}

function BranchesFlow() {
  const [states, setStates] = useState<GroupState[]>([
    'waiting',
    'waiting',
    'waiting',
  ])
  const [pushed, setPushed] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  const setGroup = (i: number, state: GroupState) =>
    setStates((prev) => prev.map((s, j) => (j === i ? state : s)))

  const push = () => {
    setPushed(true)
    setStates(['planning', 'waiting', 'waiting'])
    later(1300, () => setGroup(0, 'approval'))
  }

  const approve = (i: number) => {
    setGroup(i, 'deploying')
    later(1500, () => {
      setGroup(i, 'healthy')
      if (i + 1 < installGroups.length) {
        setGroup(i + 1, 'planning')
        later(1300, () => setGroup(i + 1, 'approval'))
      }
    })
  }

  const reset = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setPushed(false)
    setStates(['waiting', 'waiting', 'waiting'])
  }

  return (
    <>
      <FlowHeader
        eyebrow="Customize · app branches"
        title="Configure app branches"
        lede="This app's branch config connects git pushes to a staged rollout: every push to ms/onboarding-edit fetches the config at that commit, builds what changed, and rolls it across three install groups in order, pausing for an approval on each group's plan."
      />
      <DemoBanner />

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">The staged rollout, simulated</h2>
          <div className="subtext muted">branch.toml · [[install_groups]]</div>
        </div>
        <div className="row" style={{ marginBottom: 20 }}>
          {!pushed ? (
            <button className="btn btn--primary" onClick={push}>
              Simulate a push to ms/onboarding-edit <Icon name="arrow-right" />
            </button>
          ) : (
            <button className="btn btn--secondary" onClick={reset}>
              Reset the simulation
            </button>
          )}
        </div>
        <div className="groups">
          {installGroups.map((group, i) => (
            <div
              key={group.name}
              className={
                states[i] === 'waiting' ? 'group-card group-card--waiting' : 'group-card'
              }
            >
              <div className="group-card__head">
                <span className="arch__num">0{group.order}</span>
                <span className="group-card__name">{group.name}</span>
                {groupBadge(states[i])}
              </div>
              <div className="group-card__selector mono">{group.selector}</div>
              <div className="group-card__note">{group.note}</div>
              {states[i] === 'approval' && (
                <button
                  className="btn btn--primary btn--sm"
                  style={{ marginTop: 12 }}
                  onClick={() => approve(i)}
                >
                  Approve {group.name} (demo)
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
          Selectors re-evaluate on every run, so a new customer install joins
          the right wave the moment it is labelled. After each group deploys,
          the <span className="mono">full-health-check</span> runbook runs
          against every install in it (
          <span className="mono">post_deploy_runbooks</span>), leaving a
          per-install health transcript behind.
        </p>
      </section>

      <CodeBlock
        label="branch.toml (the real config, abridged)"
        code={`name                 = "ms/onboarding-edit"
post_deploy_runbooks = ["full-health-check"]

[public_repo]
repo      = "nuonco/kitchen-sink"
directory = "."
branch    = "ms/onboarding-edit"

[[install_groups]]
name  = "staging"
order = 1
use_for_previews = true

[install_groups.label_selector]
env = "staging"

[[install_groups]]
name  = "customers"
order = 2

[install_groups.label_selector]
env  = "production"
tier = "customer"

[[install_groups]]
name  = "enterprise"
order = 3

[install_groups.label_selector]
env  = "production"
tier = "enterprise"`}
      />

      <Callout label="Rolling back an install">
        A rollback is the same machinery in reverse: point the branch at the
        last good commit (or revert the commit) and push. The staged rollout
        replays with the old config, group by group, behind the same approvals.
        For out-of-band damage there is the{' '}
        <span className="mono">reconcile-drift</span> runbook, which plans the
        chart first so the run records what drifted before anything is
        re-applied.
      </Callout>
    </>
  )
}

/* ============================================================
   Flow: Configure runbooks (runbooks/*.toml)
   ============================================================ */

interface RunbookStep {
  name: string
  type: string
  detail: string
}

const runbooks: Array<{
  name: string
  description: string
  kind: string
  steps: RunbookStep[]
}> = [
  {
    name: 'full-health-check',
    description:
      'Check an install end to end: nodes, the kitchen-sink workloads, the ALB ingress, and the public HTTPS endpoint.',
    kind: 'health-check',
    steps: [
      { name: 'node-health', type: 'action', detail: 'kubectl get nodes, top nodes · 2m' },
      { name: 'workload-health', type: 'action', detail: 'runs the cron_status action' },
      { name: 'rollout-convergence', type: 'action', detail: 'rollout status for api, ui, worker · 6m' },
      { name: 'ingress-health', type: 'action', detail: 'helm list, describe the ALB ingress · 3m' },
      { name: 'endpoint-health', type: 'action', detail: 'probe the public HTTPS endpoint · 5m' },
    ],
  },
  {
    name: 'debug-bundle',
    description:
      'Collect a read-only diagnostic bundle: pod state, events, logs, restart reasons, and a verbose endpoint probe.',
    kind: 'debug',
    steps: [
      { name: 'collect-diagnostics', type: 'action', detail: 'runs the debug action' },
      { name: 'workload-detail', type: 'action', detail: 'per-pod detail and restart reasons · 4m' },
      { name: 'ingress-and-secrets', type: 'action', detail: 'ingress state, secret names only · 3m' },
      { name: 'endpoint-probe', type: 'action', detail: 'verbose curl against the public URL · 2m' },
    ],
  },
  {
    name: 'reconcile-drift',
    description:
      'Re-apply desired state after out-of-band changes: plan the chart, reprovision the sandbox, then roll everything forward.',
    kind: 'drift',
    steps: [
      { name: 'drift-plan', type: 'component_deploy', detail: 'kitchen_sink, plan_only: records what drifted' },
      { name: 'reconcile-sandbox', type: 'sandbox_reprovision', detail: 'infrastructure only, component deploys skipped' },
      { name: 'reconcile-pulumi-infra', type: 'component_deploy', detail: 'pulumi_infra' },
      { name: 'reconcile-certificate', type: 'component_deploy', detail: 'certificate, before the ALB that consumes it' },
      { name: 'reconcile-app', type: 'component_deploy', detail: 'kitchen_sink, dependents follow' },
      { name: 'verify', type: 'action', detail: 'end-to-end check · 8m' },
    ],
  },
  {
    name: 'break-glass',
    description:
      'Emergency, elevated-access remediation run as a recorded procedure instead of ad-hoc console access.',
    kind: 'break-glass',
    steps: [
      { name: 'capture-state', type: 'action', detail: 'pods and events before touching anything · 3m' },
      { name: 'elevated-remediation', type: 'action', detail: 'runs break_glass_remediation under the break-glass role' },
      { name: 'verify', type: 'action', detail: 'confirm the remediation took · 8m' },
    ],
  },
]

type StepState = 'pending' | 'running' | 'done'

function RunbooksFlow() {
  const [selected, setSelected] = useState(0)
  const [stepStates, setStepStates] = useState<StepState[]>([])
  const timers = useRef<number[]>([])
  const runbook = runbooks[selected]
  const running = stepStates.some((s) => s === 'running')

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const select = (i: number) => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setSelected(i)
    setStepStates([])
  }

  const simulate = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    const total = runbook.steps.length
    setStepStates(Array(total).fill('pending'))
    for (let i = 0; i < total; i++) {
      timers.current.push(
        window.setTimeout(() => {
          setStepStates((prev) =>
            prev.map((s, j) => (j < i ? 'done' : j === i ? 'running' : s)),
          )
        }, i * 1000),
      )
    }
    timers.current.push(
      window.setTimeout(() => {
        setStepStates(Array(total).fill('done'))
      }, total * 1000),
    )
  }

  return (
    <>
      <FlowHeader
        eyebrow="Customize · runbooks"
        title="Configure runbooks"
        lede="A runbook is a versioned, multi-step procedure Nuon runs against an install and records. This app ships four, one per operational moment: routine health, something's-wrong diagnostics, drift, and the emergency."
      />
      <DemoBanner />

      <section className="section">
        <div className="tiles" style={{ marginBottom: 24 }}>
          {runbooks.map((rb, i) => (
            <button
              key={rb.name}
              className={i === selected ? 'tile tile--active' : 'tile'}
              onClick={() => select(i)}
            >
              <span className="tile__head">
                <Icon name="book-open" />
                <span className="mono">{rb.name}</span>
              </span>
              <span className="tile__body">
                {rb.steps.length} steps · {rb.kind}
              </span>
            </button>
          ))}
        </div>

        <div className="section__head">
          <h2 className="section__title mono">{runbook.name}</h2>
          <div className="subtext muted">runbooks/{runbook.name}.toml</div>
        </div>
        <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
          {runbook.description}
        </p>
        <div className="row" style={{ marginBottom: 16 }}>
          <button
            className="btn btn--primary"
            onClick={simulate}
            disabled={running}
          >
            {running ? 'Running…' : 'Simulate a run (demo)'}
          </button>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>#</th>
                <th>Step</th>
                <th>Type</th>
                <th>What it does</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {runbook.steps.map((step, i) => {
                const state = stepStates[i]
                return (
                  <tr key={step.name}>
                    <td className="mono subtext">{i + 1}</td>
                    <td className="mono">{step.name}</td>
                    <td className="mono subtext">{step.type}</td>
                    <td>{step.detail}</td>
                    <td>
                      {state === 'running' ? (
                        <Badge tone="warning" dot>
                          running
                        </Badge>
                      ) : state === 'done' ? (
                        <Badge tone="positive" dot>
                          done
                        </Badge>
                      ) : state === 'pending' ? (
                        <Badge>pending</Badge>
                      ) : (
                        <span className="muted subtext">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Callout label="Where these run for real">
        The branch config runs <span className="mono">full-health-check</span>{' '}
        automatically after every staged deploy (
        <span className="mono">post_deploy_runbooks</span> in branch.toml). The
        rest are run on demand from the install&rsquo;s Runbooks page in the
        dashboard, where each run leaves a per-step transcript.
      </Callout>
    </>
  )
}

/* ============================================================
   Flow: Run adhoc actions (the nuon.toml of each actions/ entry)
   ============================================================ */

const adhocActions = [
  {
    name: 'cron_status',
    timeout: '1m',
    triggers: ['cron 0 * * * *', 'manual'],
    labels: 'is_health_check = "true"',
    what: 'Collects pod status and publishes pods_ready / pods_total as structured outputs; the install readme reads them as its health pulse.',
    transcript: [
      '=== Pods ===',
      'kitchen-sink-api-7c9f6d54b8-x2lvq     Running   1/1',
      'kitchen-sink-ui-6b8d49c7f4-8kmtp      Running   1/1',
      'kitchen-sink-ui-6b8d49c7f4-dw4rz      Running   1/1',
      'kitchen-sink-worker-5f7b8c9d6-nq3jh   Running   1/1',
      'writing structured outputs…',
      'pods_ready=4 pods_total=4 checked_at=2026-08-19T21:04:00Z',
      'exit 0',
    ],
  },
  {
    name: 'debug',
    timeout: '2m',
    triggers: ['manual'],
    labels: null,
    what: 'The thing support runs when an install misbehaves: pods, events, and recent logs, with nobody handed a kubeconfig.',
    transcript: [
      '=== Pods ===',
      '4 pods, all Running, 0 restarts in the last hour',
      '=== Events ===',
      'no warning events in kitchen-sink',
      '=== Recent logs: kitchen-sink-api ===',
      'GET /introspect/kube 200 12ms',
      'GET /introspect/namespace/kitchen-sink 200 31ms',
      'exit 0',
    ],
  },
  {
    name: 'lifecycle_hooks',
    timeout: '1m',
    triggers: ['manual', 'post-provision', 'pre-deploy-component kitchen_sink', 'post-deploy-component kitchen_sink'],
    labels: null,
    what: 'Brackets every chart deploy, which is where a migration or a cache warm goes. Depends on kitchen_sink.',
    transcript: [
      'HOOK_VERSION=v1',
      'hook fired: manual',
      'this hook also runs post-provision and around every kitchen_sink deploy',
      'logged lifecycle event',
      'exit 0',
    ],
  },
  {
    name: 'break_glass_remediation',
    timeout: '10m',
    triggers: ['manual'],
    labels: 'is_break_glass = "true"',
    what: 'Elevated remediation through a recorded action instead of ad-hoc console access. Assumes the break-glass role from break_glass.toml.',
    transcript: [
      'assuming role: {install-id}-app-break-glass',
      'policy: AdministratorAccess, with secretsmanager:* explicitly denied',
      'kube config enabled for this run',
      '(your remediation here; every line of it lands in the workflow history)',
      'exit 0',
    ],
  },
]

function ActionsFlow() {
  const [selected, setSelected] = useState(0)
  const [lines, setLines] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const timers = useRef<number[]>([])
  const action = adhocActions[selected]

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const select = (i: number) => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setSelected(i)
    setLines([])
    setRunning(false)
  }

  const run = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setLines([`$ nuon actions run ${action.name}   # simulated`])
    setRunning(true)
    action.transcript.forEach((line, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setLines((prev) => [...prev, line])
          if (i === action.transcript.length - 1) setRunning(false)
        }, 400 * (i + 1)),
      )
    })
  }

  return (
    <>
      <FlowHeader
        eyebrow="Customize · actions"
        title="Run adhoc actions"
        lede="An action is a script the runner executes inside the install, on a schedule, around a deploy, or on demand. This app ships four; the manual ones are how support fixes an install without cluster credentials."
      />
      <DemoBanner />

      <section className="section">
        <div className="tiles" style={{ marginBottom: 24 }}>
          {adhocActions.map((a, i) => (
            <button
              key={a.name}
              className={i === selected ? 'tile tile--active' : 'tile'}
              onClick={() => select(i)}
            >
              <span className="tile__head">
                <Icon name="lightning" />
                <span className="mono">{a.name}</span>
              </span>
              <span className="tile__body">timeout {a.timeout}</span>
            </button>
          ))}
        </div>

        <div className="section__head">
          <h2 className="section__title mono">{action.name}</h2>
          <div className="subtext muted">actions/{action.name}/nuon.toml</div>
        </div>
        <p className="small muted" style={{ maxWidth: '72ch', marginBottom: 12 }}>
          {action.what}
        </p>
        <div className="row" style={{ marginBottom: 16 }}>
          {action.triggers.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
          {action.labels && <span className="chip">{action.labels}</span>}
        </div>
        <div className="row" style={{ marginBottom: 16 }}>
          <button className="btn btn--primary" onClick={run} disabled={running}>
            {running ? 'Running…' : 'Run action (demo)'}
          </button>
        </div>
        {lines.length > 0 && (
          <pre className="raw sim-log">{lines.join('\n')}</pre>
        )}
      </section>

      <Callout label="Why adhoc beats a kubeconfig">
        The runner already has the access an action needs; the action is the
        audited, repeatable path to using it. A support engineer answering a
        ticket runs <span className="mono">debug</span> from the dashboard and
        reads the transcript, and production credentials never move.
      </Callout>
    </>
  )
}

/* ============================================================
   Flow: Operation roles (permissions/*.toml + break_glass.toml)
   ============================================================ */

const roles = [
  {
    name: 'provision',
    type: 'provision',
    boundary: 'provision_boundary.json',
    desc: 'Provision the sandbox and components; trigger actions.',
    detail:
      'AdministratorAccess inside a permissions boundary: broad enough to create a VPC, an EKS cluster, and DNS, fenced by provision_boundary.json.',
  },
  {
    name: 'setup',
    type: 'custom',
    boundary: 'provision_boundary.json',
    desc: 'Initial component deployment and configuration.',
    detail:
      'Used once per install for first deploys, sharing the provision boundary.',
  },
  {
    name: 'maintenance',
    type: 'maintenance',
    boundary: 'maintenance_boundary.json',
    desc: 'Operate and remediate components.',
    detail:
      'The day-2 role: AdministratorAccess fenced by a tighter maintenance boundary. This is what deploys and runbooks assume, day to day.',
  },
  {
    name: 'sandbox-updates',
    type: 'custom',
    boundary: 'provision_boundary.json',
    desc: 'Update and maintain sandbox infrastructure.',
    detail:
      'Sandbox reprovisions and upgrades, separated from app-level maintenance.',
  },
  {
    name: 'actions',
    type: 'custom',
    boundary: 'inline policy',
    desc: 'Execute actions (healthchecks, debug, cron jobs).',
    detail:
      'The narrowest role here: a single inline policy allowing eks:DescribeCluster, because actions run in-cluster and need almost nothing from AWS.',
  },
  {
    name: 'deprovision',
    type: 'deprovision',
    boundary: 'deprovision_boundary.json',
    desc: 'Deprovision the sandbox and components.',
    detail:
      'Teardown only. Separating it means routine operations can never delete the install.',
  },
  {
    name: 'app-break-glass',
    type: 'break-glass',
    boundary: 'explicit Deny',
    desc: 'Grants admin access for emergencies.',
    detail:
      'AdministratorAccess with secretsmanager:* explicitly denied, declared in break_glass.toml. Only the break_glass_remediation action can assume it, so every use is a recorded workflow.',
  },
]

const guardrails = [
  { name: 'cluster-requirements', type: 'sandbox', target: 'the sandbox plan' },
  { name: 'sandbox-limits', type: 'sandbox', target: 'the sandbox plan' },
  { name: 'deny-public-api-ingress', type: 'helm_chart', target: 'kitchen_sink' },
  { name: 'deny-public-s3-bucket', type: 'terraform_module', target: 'all components' },
]

function RolesFlow() {
  const [selected, setSelected] = useState(0)
  const role = roles[selected]

  return (
    <>
      <FlowHeader
        eyebrow="Customize · operation roles"
        title="Set up operation roles"
        lede="Nuon performs every operation under a per-operation IAM role your customer can read, each with its own permissions boundary. This app declares seven, from provision down to a break-glass role that exists only for emergencies."
      />
      <DemoBanner />

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">One role per operation</h2>
          <div className="subtext muted">permissions/*.toml · break_glass.toml</div>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Role</th>
                <th>Type</th>
                <th>Boundary</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r, i) => (
                <tr
                  key={r.name}
                  className={i === selected ? 'row-select row-select--active' : 'row-select'}
                  onClick={() => setSelected(i)}
                >
                  <td className="mono">{r.name}</td>
                  <td className="mono subtext">{r.type}</td>
                  <td className="mono subtext">{r.boundary}</td>
                  <td>{r.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="callout" style={{ marginTop: 16 }}>
          <div className="callout__label">
            {role.name} · in this install: {'{install-id}'}-{role.name}
          </div>
          {role.detail}
        </div>
      </section>

      <CodeBlock
        label="break_glass.toml (the whole file)"
        code={`[[role]]
name         = "{{.nuon.install.id}}-app-break-glass"
display_name = "Break Glass Admin"
description  = "grants admin access for emergencies"

[[role.policies]]
managed_policy_name = "AdministratorAccess"

[[role.policies]]
name     = "remove-secrets-manager"
contents = """
{ "Version": "2012-10-17",
  "Statement": [{ "Effect": "Deny",
                  "Action": "secretsmanager:*",
                  "Resource": "*" }] }
"""`}
      />

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Guardrails on top: OPA policies</h2>
          <div className="subtext muted">policies/*.toml</div>
        </div>
        <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
          Roles bound what Nuon may do; policies bound what a config may ask
          for. These four evaluate against plans before anything applies.
        </p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Policy</th>
                <th>Evaluates against</th>
                <th>Scope</th>
              </tr>
            </thead>
            <tbody>
              {guardrails.map((g) => (
                <tr key={g.name}>
                  <td className="mono">{g.name}</td>
                  <td className="mono subtext">{g.type}</td>
                  <td>{g.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

/* ============================================================
   The index shown at bare #/customize (the landing's customize page is the
   richer hub; this covers deep links).
   ============================================================ */

const flows = [
  { key: 'branches', title: 'Configure app branches', icon: 'git-branch' },
  { key: 'runbooks', title: 'Configure runbooks', icon: 'book-open' },
  { key: 'actions', title: 'Run adhoc actions', icon: 'lightning' },
  { key: 'roles', title: 'Set up operation roles', icon: 'lock' },
]

/** Each flow's matching day-2 explainer, for the "Read why it matters" glue.
    The roles flow has no day-2 page, so it gets no entry. */
const dayTwoFor: Record<string, string> = {
  branches: '/day2/branches',
  runbooks: '/day2/runbooks',
  actions: '/day2/triggers',
}

export function Customize({
  config,
  flow,
}: {
  config: UIConfig
  flow?: string
}) {
  const navigate = useNavigate()

  return (
    <>
      <BackLink to="/">Customize the Kitchen Sink</BackLink>

      {flow === 'branches' && <BranchesFlow />}
      {flow === 'runbooks' && <RunbooksFlow />}
      {flow === 'actions' && <ActionsFlow />}
      {flow === 'roles' && <RolesFlow />}

      {!flow && (
        <>
          <FlowHeader
            eyebrow="Customize"
            title="Setup flows"
            lede="Interactive previews of the day-2 setup this app ships, grounded in its real config."
          />
          <div className="tiles">
            {flows.map((f) => (
              <button
                key={f.key}
                className="tile"
                onClick={() => navigate(`/customize/${f.key}`)}
              >
                <span className="tile__head">
                  <Icon name={f.icon} />
                  {f.title}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {flow && (
        <div className="row" style={{ marginTop: 32 }}>
          <OutLink href={config.links.install}>Do it for real in Nuon</OutLink>
          {dayTwoFor[flow] && (
            <button
              className="btn btn--secondary"
              onClick={() => navigate(dayTwoFor[flow])}
            >
              Read why it matters <Icon name="arrow-right" />
            </button>
          )}
          <OutLink href="https://docs.nuon.co" variant="plain">
            docs.nuon.co
          </OutLink>
        </div>
      )}
    </>
  )
}
