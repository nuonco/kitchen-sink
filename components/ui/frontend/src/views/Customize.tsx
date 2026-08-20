import { useEffect, useRef, useState } from 'react'
import {
  countReady,
  useIntrospect,
  type NamespaceResponse,
  type UIConfig,
} from '../lib/api'
import {
  adhocActions,
  branchConfigAbridged,
  branchName,
  breakGlassToml,
  guardrails,
  installGroups,
  lifecycleHooksToml,
  roles,
  runbooks,
} from '../lib/config-data.gen'
import { categories } from '../lib/taxonomy'
import { CapabilityGroups } from '../ui/CapabilityGrid'
import {
  BackLink,
  Badge,
  Callout,
  CodeBlock,
  Eyebrow,
  Icon,
  LoadState,
  OutLink,
  PhaseBadge,
} from '../ui/Primitives'

/* ============================================================
   The day-2 capability pages, one per entry in lib/taxonomy.ts. The config
   facts on these pages (install groups, runbook steps, action triggers,
   roles, guardrails) come from lib/config-data.gen.ts, generated at build
   time from the repo's real TOML, so they cannot drift from the config.

   The branches, runbooks, and actions pages SIMULATE their operation in the
   browser; nothing here calls a mutating API. Each one says so in a banner
   before any control. The simulations are transitional and will be replaced
   by real, dashboard-backed views.
   ============================================================ */

function SimBanner() {
  return (
    <div className="demo-banner">
      <Badge tone="warning" dot>
        simulation
      </Badge>
      <span>
        The controls below simulate the operation in the browser. Nothing on
        this page changes the real install; the real version runs from the
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
   Ship: app branches (branch.toml)
   ============================================================ */

type GroupState = 'waiting' | 'planning' | 'approval' | 'deploying' | 'healthy'

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

const groupNotes: Record<string, string> = {
  staging: 'use_for_previews: PR preview plans run here',
  customers: 'the production fleet',
  enterprise: 'the installs with change windows',
}

function BranchesFlow({ config }: { config: UIConfig }) {
  const [states, setStates] = useState<GroupState[]>(
    installGroups.map(() => 'waiting'),
  )
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
    setStates(installGroups.map((_, i) => (i === 0 ? 'planning' : 'waiting')))
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
    setStates(installGroups.map(() => 'waiting'))
  }

  return (
    <>
      <FlowHeader
        eyebrow="Ship · app branches"
        title="Ship through app branches"
        lede={`This app's branch config connects git pushes to a staged rollout: every push to ${branchName} fetches the config at that commit, builds what changed, and rolls it across the install groups in order, pausing for an approval on each group's plan.`}
      />
      <SimBanner />

      <div className="prose" style={{ marginTop: 24 }}>
        <p>
          Every component in this app points at a git branch, and an app branch
          extends that to the whole config at once: you branch the config,
          point selected installs at the branch, and leave everyone else on
          main. A chart change can be proven against one friendly customer
          before it becomes the default for all of them. The unit of risk
          shrinks to a single install.
        </p>
      </div>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">The staged rollout, simulated</h2>
          <div className="subtext muted">branch.toml · [[install_groups]]</div>
        </div>
        <div className="row" style={{ marginBottom: 20 }}>
          {!pushed ? (
            <button className="btn btn--primary" onClick={push}>
              Simulate a push to {branchName} <Icon name="arrow-right" />
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
              <div className="group-card__note">
                {groupNotes[group.name] ?? (group.preview ? 'PR preview plans run here' : '')}
              </div>
              {states[i] === 'approval' && (
                <button
                  className="btn btn--primary btn--sm"
                  style={{ marginTop: 12 }}
                  onClick={() => approve(i)}
                >
                  Approve {group.name} (simulated)
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

      {(config.links.branches || config.links.versions) && (
        <Callout label="The real record, one link away">
          This machinery genuinely runs for every push to{' '}
          <span className="mono">{branchName}</span>; the simulation above is
          only a rehearsal of what you would watch.{' '}
          {config.links.branches && (
            <OutLink href={config.links.branches} variant="plain">
              Open the branch runs and pending approvals
            </OutLink>
          )}
          {config.links.branches && config.links.versions && <> &middot; </>}
          {config.links.versions && (
            <OutLink href={config.links.versions} variant="plain">
              this install&rsquo;s config versions
            </OutLink>
          )}
        </Callout>
      )}

      <CodeBlock
        label="branch.toml (the real config, comments stripped)"
        code={branchConfigAbridged}
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

      <Callout label="Why it matters at 50 installs">
        Without branches, a config change is all-or-nothing across every
        customer. With them, the blast radius of a mistake is one install, and
        rolling back is a branch pointer rather than an incident.
      </Callout>
    </>
  )
}

/* ============================================================
   Operate: runbooks (runbooks/*.toml)
   ============================================================ */

type StepState = 'pending' | 'running' | 'done'

function RunbookModeBadge({ mutates }: { mutates: boolean }) {
  return mutates ? (
    <Badge tone="warning" dot>
      applies changes
    </Badge>
  ) : (
    <Badge tone="positive" dot>
      read-only
    </Badge>
  )
}

function RunbooksFlow({ config }: { config: UIConfig }) {
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
        eyebrow="Operate · runbooks"
        title="Run runbooks"
        lede="A runbook is a versioned, multi-step procedure Nuon runs against an install and records. This app ships four, one per operational moment: routine health, something's-wrong diagnostics, drift, and the emergency. Two are read-only; two apply changes, and the badges below say which."
      />
      <SimBanner />

      <div className="prose" style={{ marginTop: 24 }}>
        <p>
          A runbook is the readme&rsquo;s counterpart, aimed at a different
          moment: the readme is read once, when someone is deciding; a runbook
          runs at 2am, when something is broken. It arrives already scoped to
          the install in front of you, and every run leaves a per-step
          transcript in the dashboard.
        </p>
      </div>

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
                {rb.steps.length} steps · {rb.mutates ? 'applies changes' : 'read-only'}
              </span>
            </button>
          ))}
        </div>

        <div className="section__head">
          <h2 className="section__title mono">{runbook.name}</h2>
          <div className="subtext muted">runbooks/{runbook.name}.toml</div>
        </div>
        <div className="row" style={{ marginBottom: 12 }}>
          <RunbookModeBadge mutates={runbook.mutates} />
        </div>
        <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
          {runbook.description}
          {runbook.mutates &&
            ' The real run re-applies state or assumes elevated access; the simulation below only steps through the plan.'}
        </p>
        <div className="row" style={{ marginBottom: 16 }}>
          <button
            className="btn btn--primary"
            onClick={simulate}
            disabled={running}
          >
            {running ? 'Simulating…' : 'Simulate a run'}
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
        <span className="mono">post_deploy_runbooks</span> in branch.toml), so
        this install already has real runs on record. The rest are run on
        demand from the install&rsquo;s Runbooks page in the dashboard, where
        each run leaves a per-step transcript.{' '}
        {config.links.runbooks && (
          <OutLink href={config.links.runbooks} variant="plain">
            Open the latest full-health-check transcript
          </OutLink>
        )}
      </Callout>
    </>
  )
}

/* ============================================================
   Operate: adhoc actions (the nuon.toml of each actions/ entry)
   ============================================================ */

/** Editorial context per action; the facts next to it come from the config. */
const actionNotes: Record<string, string> = {
  cron_status:
    'Collects pod status and publishes pods_ready / pods_total as structured outputs; the install readme reads them as its health pulse.',
  debug:
    'The thing support runs when an install misbehaves: pods, events, and recent logs, with nobody handed a kubeconfig.',
  lifecycle_hooks:
    'Brackets every chart deploy, which is where a migration or a cache warm goes. Depends on kitchen_sink.',
  break_glass_remediation:
    'Elevated remediation through a recorded action instead of ad-hoc console access. Assumes the break-glass role from break_glass.toml.',
}

/** Illustrative sample output per action. Not captured from a real run. */
const sampleTranscripts: Record<string, string[]> = {
  cron_status: [
    '=== Pods ===',
    'kitchen-sink-api-…      Running   1/1',
    'kitchen-sink-ui-…       Running   1/1',
    'kitchen-sink-ui-…       Running   1/1',
    'kitchen-sink-worker-…   Running   1/1',
    'writing structured outputs…',
    'pods_ready=4 pods_total=4 checked_at=<run time>',
    'exit 0',
  ],
  debug: [
    '=== Pods ===',
    '(pod list, restart counts)',
    '=== Events ===',
    '(warning events in kitchen-sink, if any)',
    '=== Recent logs: kitchen-sink-api ===',
    '(last log lines from the API pod)',
    'exit 0',
  ],
  lifecycle_hooks: [
    'HOOK_VERSION=v1',
    'hook fired: manual',
    'this hook also runs post-provision and around every kitchen_sink deploy',
    'logged lifecycle event',
    'exit 0',
  ],
  break_glass_remediation: [
    'assuming role: {install-id}-app-break-glass',
    'policy: AdministratorAccess, with secretsmanager:* explicitly denied',
    'kube config enabled for this run',
    '(your remediation here; every line of it lands in the workflow history)',
    'exit 0',
  ],
}

function ActionsFlow({ config }: { config: UIConfig }) {
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
    const transcript = sampleTranscripts[action.name] ?? ['exit 0']
    setLines([
      `$ nuon actions run ${action.name}`,
      '# simulated: sample output, not a real run',
    ])
    setRunning(true)
    transcript.forEach((line, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setLines((prev) => [...prev, line])
          if (i === transcript.length - 1) setRunning(false)
        }, 400 * (i + 1)),
      )
    })
  }

  return (
    <>
      <FlowHeader
        eyebrow="Operate · adhoc actions"
        title="Run adhoc actions"
        lede="An action is a script the runner executes inside the install, on a schedule, around a deploy, or on demand. This app ships four; the manual ones are how support fixes an install without cluster credentials."
      />
      <SimBanner />

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
              <span className="tile__body">
                timeout {a.timeout}
                {a.breakGlass ? ' · assumes the break-glass role' : ''}
              </span>
            </button>
          ))}
        </div>

        <div className="section__head">
          <h2 className="section__title mono">{action.name}</h2>
          <div className="subtext muted">actions/{action.name}/nuon.toml</div>
        </div>
        {action.breakGlass && (
          <div className="row" style={{ marginBottom: 12 }}>
            <Badge tone="warning" dot>
              elevated access
            </Badge>
          </div>
        )}
        <p className="small muted" style={{ maxWidth: '72ch', marginBottom: 12 }}>
          {actionNotes[action.name] ?? ''}
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
            {running ? 'Simulating…' : 'Simulate a run'}
          </button>
        </div>
        {lines.length > 0 && (
          <pre className="raw sim-log">{lines.join('\n')}</pre>
        )}
      </section>

      <Callout label="Real runs, on the record right now">
        One of these is not waiting for you: <span className="mono">cron_status</span>{' '}
        has run hourly on this install since it provisioned, publishing{' '}
        <span className="mono">pods_ready</span> /{' '}
        <span className="mono">pods_total</span> as structured outputs (the
        install readme reads them as its health pulse). Every run&rsquo;s
        transcript and outputs are in the dashboard.{' '}
        {config.links.actions && (
          <OutLink href={config.links.actions} variant="plain">
            Open the hourly run history
          </OutLink>
        )}
      </Callout>

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
   Operate: component health (live pod reads + the config behind the gate)
   ============================================================ */

function HealthFlow({ config }: { config: UIConfig }) {
  const namespace = config.namespace ?? 'kitchen-sink'
  const ns = useIntrospect<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
  )
  const pods = ns.state === 'ok' ? (ns.value.response.pods ?? []) : []

  return (
    <>
      <FlowHeader
        eyebrow="Operate · component health"
        title="Watch component health"
        lede="Nuon deploys a component and then waits for it to become healthy before calling the deploy done. The pod table below is not a mock: it is read from this cluster, right now."
      />

      <div className="prose" style={{ marginTop: 24 }}>
        <p>
          A component that never goes green blocks the install, which means
          health checks end up shaping your config as much as your dashboard.
          Two decisions in this app exist only because of that gate.
        </p>
        <ul>
          <li>
            The API has no ingress. An internal ingress has no certificate and
            no DNS for its host, so it would never converge and the component
            would sit un-green forever. The UI reaches the API over the
            in-cluster service instead, at{' '}
            <code>http://kitchen-sink-api:8080</code>.
          </li>
          <li>
            The chart&rsquo;s ConfigMap carries a <code>nuon.co/roll</code>{' '}
            annotation set to the Helm release revision. It changes on every
            release, so a redeploy is never a no-op. A no-op plan would be
            skipped, quietly bypassing the health gate the deploy is supposed
            to pass.
          </li>
        </ul>
      </div>

      <div className="section" style={{ marginTop: 32 }}>
        <div className="section__head">
          <h3 className="section__title">Right now, in this install</h3>
          <div className="subtext muted">
            GET /introspect/namespace/{namespace}
          </div>
        </div>
        <LoadState result={ns} what="pod health" />
        {ns.state === 'ok' && (
          <>
            <div className="row" style={{ marginBottom: 12 }}>
              <Badge tone="accent">
                {countReady(pods)} of {pods.length} pods ready
              </Badge>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Pod</th>
                    <th>Phase</th>
                    <th>Containers ready</th>
                    <th>Restarts</th>
                  </tr>
                </thead>
                <tbody>
                  {pods.map((pod, i) => {
                    const statuses = pod.status?.containerStatuses ?? []
                    const ready = statuses.filter((c) => c.ready).length
                    const restarts = statuses.reduce(
                      (sum, c) => sum + (c.restartCount ?? 0),
                      0,
                    )
                    return (
                      <tr key={pod.metadata?.name ?? i}>
                        <td className="mono">{pod.metadata?.name}</td>
                        <td>
                          <PhaseBadge phase={pod.status?.phase} />
                        </td>
                        <td>
                          {ready} / {statuses.length}
                        </td>
                        <td>{restarts}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <CodeBlock
        label="components/chart/values.yaml"
        code={`api:
  # No internal ingress: the UI reaches the API via the in-cluster service
  # (see ui.env.API_URL). An internal ingress here never converges (no cert/DNS
  # for its host), which would keep the component health from ever going green.
  ingress: {}`}
      />
      <Callout label="Why it matters at 50 installs">
        Health is the difference between &ldquo;deployed&rdquo; and
        &ldquo;working&rdquo;. When you operate installs you cannot log into,
        the deploy pipeline has to be the thing that notices. The failure mode
        you are trying to avoid is your customer noticing first.
      </Callout>
    </>
  )
}

/* ============================================================
   React: triggers (derived from the actions' trigger declarations)
   ============================================================ */

function TriggersFlow() {
  return (
    <>
      <FlowHeader
        eyebrow="React · triggers"
        title="Wire up triggers"
        lede="An action is a script the runner executes inside the install. A trigger decides when. Between them, the actions this app ships cover every kind of trigger you get: cron, lifecycle, and manual."
      />

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Every trigger this app declares</h2>
          <div className="subtext muted">actions/*/nuon.toml · [[triggers]]</div>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Action</th>
                <th>Runs when</th>
                <th>Timeout</th>
              </tr>
            </thead>
            <tbody>
              {adhocActions.map((a) => (
                <tr key={a.name}>
                  <td className="mono">{a.name}</td>
                  <td>
                    <div className="row">
                      {a.triggers.map((t) => (
                        <span key={t} className="chip">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="mono subtext">{a.timeout}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="prose">
        <p>
          <code>cron_status</code> runs hourly and on demand.{' '}
          <code>lifecycle_hooks</code> fires on <code>post-provision</code> and
          again before and after every <code>kitchen_sink</code> deploy, which
          is where a migration or a cache warm goes. <code>debug</code> and{' '}
          <code>break_glass_remediation</code> are manual only: the things a
          person reaches for when an install misbehaves.
        </p>
      </div>

      <CodeBlock
        label="actions/lifecycle_hooks/nuon.toml (the real file)"
        code={lifecycleHooksToml}
      />

      <Callout label="Why it matters at 50 installs">
        Manual triggers are how support fixes an install without cluster
        credentials. The runner already has the access it needs; the action is
        the audited, repeatable path to using it. Nobody has to be handed a
        production kubeconfig to answer a ticket.
      </Callout>
    </>
  )
}

/* ============================================================
   Govern: operation roles (permissions/*.toml + break_glass.toml)
   ============================================================ */

/** Editorial context per role; the facts in the table come from the config. */
const roleNotes: Record<string, string> = {
  provision:
    'AdministratorAccess inside a permissions boundary: broad enough to create a VPC, an EKS cluster, and DNS, fenced by provision_boundary.json.',
  setup:
    'Used once per install for first deploys, sharing the provision boundary.',
  maintenance:
    'The day-2 role: AdministratorAccess fenced by a tighter maintenance boundary. This is what deploys and runbooks assume, day to day.',
  'sandbox-updates':
    'Sandbox reprovisions and upgrades, separated from app-level maintenance.',
  actions:
    'The narrowest role here: a single inline policy allowing eks:DescribeCluster, because actions run in-cluster and need almost nothing from AWS.',
  deprovision:
    'Teardown only. Separating it means routine operations can never delete the install.',
  'app-break-glass':
    'AdministratorAccess with secretsmanager:* explicitly denied, declared in break_glass.toml. Only the break_glass_remediation action can assume it, so every use is a recorded workflow.',
}

function RolesFlow({ config }: { config: UIConfig }) {
  const [selected, setSelected] = useState(0)
  const role = roles[selected]

  return (
    <>
      <FlowHeader
        eyebrow="Govern · operation roles"
        title="Scope operation roles"
        lede="Nuon performs every operation under a per-operation IAM role your customer can read, each with its own permissions boundary. This app declares seven, from provision down to a break-glass role that exists only for emergencies. This page is a guide to the real config; there is nothing to run here."
      />

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
          {roleNotes[role.name] ?? role.desc}
        </div>
      </section>

      <CodeBlock label="break_glass.toml (the real file)" code={breakGlassToml} />

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Guardrails on top: OPA policies</h2>
          <div className="subtext muted">policies/*.toml</div>
        </div>
        <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
          Roles bound what Nuon may do; policies bound what a config may ask
          for. These evaluate against plans before anything applies.
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

      {config.links.tokens && (
        <Callout label="Access on the Nuon side">
          Everything above bounds what Nuon may do inside the customer&rsquo;s
          account. Who may drive Nuon itself &mdash; a teammate&rsquo;s CLI, a
          CI job, a coding agent &mdash; is governed by org API tokens in the
          dashboard.{' '}
          <OutLink href={config.links.tokens} variant="plain">
            Manage API tokens in Nuon
          </OutLink>
        </Callout>
      )}
    </>
  )
}

/* ============================================================
   The view. Bare #/customize renders the day-2 half of the taxonomy for
   deep links; the landing's customize hub is the full front door.
   ============================================================ */

/**
 * Footer links per flow: the specific dashboard screen where the real version
 * of this page's subject lives (built server-side in main.go from this
 * install's own org/app ids), falling back to the install overview.
 */
function flowLinks(flow: string, config: UIConfig) {
  const links = config.links
  if (flow === 'branches')
    return { href: links.branches ?? links.install, label: 'See branch runs & approvals in Nuon' }
  if (flow === 'runbooks')
    return { href: links.runbooks ?? links.install, label: 'Open runbook runs & transcripts in Nuon' }
  if (flow === 'actions')
    return { href: links.actions ?? links.install, label: 'Open the action run history in Nuon' }
  if (flow === 'health')
    return { href: links.components ?? links.install, label: 'See component health in Nuon' }
  if (flow === 'triggers')
    return { href: links.actions ?? links.install, label: 'Open the actions for this install' }
  return { href: links.install, label: 'Open this install in Nuon' }
}

export function Customize({
  config,
  flow,
}: {
  config: UIConfig
  flow?: string
}) {
  return (
    <>
      <BackLink to="/">Customize the Kitchen Sink</BackLink>

      {flow === 'branches' && <BranchesFlow config={config} />}
      {flow === 'runbooks' && <RunbooksFlow config={config} />}
      {flow === 'actions' && <ActionsFlow config={config} />}
      {flow === 'health' && <HealthFlow config={config} />}
      {flow === 'triggers' && <TriggersFlow />}
      {flow === 'roles' && <RolesFlow config={config} />}

      {!flow && (
        <>
          <FlowHeader
            eyebrow="Customize"
            title="Day-2, one capability at a time"
            lede="Everything below is grounded in this app's real config. Simulations run in the browser only; live pages read this install; guides explain the config."
          />
          <CapabilityGroups categories={categories.filter((c) => c.dayTwo)} />
        </>
      )}

      {flow && (
        <div className="row" style={{ marginTop: 32 }}>
          <OutLink href={flowLinks(flow, config).href}>
            {flowLinks(flow, config).label}
          </OutLink>
          <OutLink href="https://docs.nuon.co" variant="plain">
            docs.nuon.co
          </OutLink>
        </div>
      )}
    </>
  )
}
