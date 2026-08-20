import { useState, type ReactNode } from 'react'
import {
  countReady,
  hasAuditLogExporter,
  hasTicTacToe,
  useIntrospect,
  useIntrospectPoll,
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
  repoName,
  roles,
  runbooks,
} from '../lib/config-data.gen'
import { categories } from '../lib/taxonomy'
import { CapabilityGroups, type SwitchStates } from '../ui/CapabilityGrid'
import {
  BackLink,
  Badge,
  Callout,
  CodeBlock,
  CommandBlock,
  CopyButton,
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

   Nothing on these pages is a mock or a rehearsal. The interaction model is
   deliberate and permanent: you act in your own terminal and your own Nuon
   dashboard; this app hands you the exact commands (with this install's ids
   filled in) and shows the cluster-side evidence live where the operation
   has one.
   ============================================================ */

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

/** The install/app ids for command interpolation, with honest placeholders
    when this app was started without them (local dev). */
const installIdOf = (config: UIConfig) => config.install_id ?? '<your-install-id>'
const appIdOf = (config: UIConfig) => config.app_id ?? '<your-app-id>'

/* ============================================================
   The live-evidence register: the pods of this namespace, re-read on a short
   interval, so a mutating operation run from the terminal is visible right
   here — image tags move on a deploy or rollback, names change and ages
   reset on a rollout restart.
   ============================================================ */

const EVIDENCE_POLL_MS = 10_000

function podAge(ts?: string): string {
  if (!ts) return '—'
  const ms = Date.now() - new Date(ts).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ${minutes % 60}m`
  return `${Math.floor(hours / 24)}d`
}

function imageTag(image?: string): string {
  if (!image) return '—'
  const tail = image.split('/').pop() ?? image
  const i = tail.lastIndexOf(':')
  return i === -1 ? 'latest' : tail.slice(i + 1)
}

function LiveEvidence({ config, lead }: { config: UIConfig; lead: ReactNode }) {
  const namespace = config.namespace ?? 'kitchen-sink'
  const ns = useIntrospectPoll<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
    EVIDENCE_POLL_MS,
    true,
  )
  const pods = ns.state === 'ok' ? (ns.value.response.pods ?? []) : []

  return (
    <section className="section">
      <div className="section__head">
        <h2 className="section__title">What you&rsquo;ll see, live</h2>
        <div className="subtext muted">
          GET /introspect/namespace/{namespace} · re-read every{' '}
          {EVIDENCE_POLL_MS / 1000}s
        </div>
      </div>
      <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
        {lead}
      </p>
      <LoadState result={ns} what="the namespace" />
      {ns.state === 'ok' && (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <Badge tone="positive" dot>
              live
            </Badge>
            <Badge tone="accent">
              {countReady(pods)} of {pods.length} pods ready
            </Badge>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Pod</th>
                  <th>Image tag</th>
                  <th>Age</th>
                  <th>Phase</th>
                  <th>Restarts</th>
                </tr>
              </thead>
              <tbody>
                {pods.map((pod, i) => {
                  const statuses = pod.status?.containerStatuses ?? []
                  const image =
                    statuses[0]?.image ?? pod.spec?.containers?.[0]?.image
                  const restarts = statuses.reduce(
                    (sum, c) => sum + (c.restartCount ?? 0),
                    0,
                  )
                  return (
                    <tr key={pod.metadata?.name ?? i}>
                      <td className="mono">{pod.metadata?.name}</td>
                      <td className="mono subtext">{imageTag(image)}</td>
                      <td className="mono subtext">
                        {podAge(pod.metadata?.creationTimestamp)}
                      </td>
                      <td>
                        <PhaseBadge phase={pod.status?.phase} />
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
    </section>
  )
}

/* ============================================================
   Ship: app branches (branch.toml)
   ============================================================ */

const groupNotes: Record<string, string> = {
  staging: 'use_for_previews: PR preview plans run here',
  customers: 'the production fleet',
  enterprise: 'the installs with change windows',
}

function BranchesFlow({ config }: { config: UIConfig }) {
  return (
    <>
      <FlowHeader
        eyebrow="Ship · app branches"
        title="Ship through app branches"
        lede={`This app's branch config connects git pushes to a staged rollout: every push to ${branchName} fetches the config at that commit, builds what changed, and rolls it across the install groups in order, pausing for an approval on each group's plan. Below is the one command that runs it for real.`}
      />

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
          <h2 className="section__title">The staged rollout this config declares</h2>
          <div className="subtext muted">branch.toml · [[install_groups]]</div>
        </div>
        <div className="groups">
          {installGroups.map((group) => (
            <div key={group.name} className="group-card">
              <div className="group-card__head">
                <span className="arch__num">0{group.order}</span>
                <span className="group-card__name">{group.name}</span>
              </div>
              <div className="group-card__selector mono">{group.selector}</div>
              <div className="group-card__note">
                {groupNotes[group.name] ??
                  (group.preview ? 'PR preview plans run here' : '')}
              </div>
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

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Ship a change, for real</h2>
          <div className="subtext muted">from your own terminal</div>
        </div>
        <CommandBlock
          label="1 · get the app config (skip if you already have a clone)"
          command={`git clone https://github.com/${repoName} && cd ${repoName.split('/')[1] ?? 'kitchen-sink'}`}
        />
        <CommandBlock
          label="2 · edit any file, then sync your local files and trigger the run"
          command={`nuon sync --branch ${branchName}`}
          note={
            <>
              This syncs your local files exactly as they are — even
              uncommitted, no fork, no push — and triggers a real branch run
              through the groups above. Add{' '}
              <span className="mono">--preview</span> to plan every group with
              nothing applied. (Pushing to the tracked branch is the other
              path: the repo webhook starts the same run.)
            </>
          }
        />
        <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
          Each group&rsquo;s plan then holds for an approval, and that approval
          is a person in the dashboard — there is deliberately no CLI command
          for it.{' '}
          {config.links.branches && (
            <OutLink href={config.links.branches} variant="plain">
              Watch the run and approve each group
            </OutLink>
          )}
        </p>
      </section>

      {(config.links.branches || config.links.versions) && (
        <Callout label="The real record, one link away">
          This machinery runs for every push to{' '}
          <span className="mono">{branchName}</span> — including the one that
          shipped the page you are reading.{' '}
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

      <LiveEvidence
        config={config}
        lead={
          <>
            When the run&rsquo;s deploy reaches this install, the image tags
            below flip to the new <span className="mono">sha-*</span> stamp and
            the pods churn as the new version rolls in — no reload, this table
            re-reads itself.
          </>
        }
      />

      <CodeBlock
        label="branch.toml (the real config, comments stripped)"
        code={branchConfigAbridged}
      />

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Rolling back an install</h2>
          <div className="subtext muted">app config versions</div>
        </div>
        <p className="small muted" style={{ maxWidth: '72ch' }}>
          Nuon keeps every config version this install has ever run, so a
          rollback is picking a previous version and re-deploying it. There is
          no CLI command for rollback yet — it runs from the version history in
          the dashboard (plan first, then apply), and the old image tags
          reappear in the table above as it lands.{' '}
          {config.links.versions && (
            <OutLink href={config.links.versions} variant="plain">
              Open this install&rsquo;s version history
            </OutLink>
          )}
        </p>
        <p className="small muted" style={{ marginTop: 12, maxWidth: '72ch' }}>
          The git-level path works too: revert the commit and push, and the
          staged rollout replays with the old config, group by group, behind
          the same approvals. For out-of-band damage there is the{' '}
          <span className="mono">reconcile-drift</span> runbook, which plans
          the chart first so the run records what drifted before anything is
          re-applied.
        </p>
      </section>

      <Callout label="Why it matters at 50 installs">
        Without branches, a config change is all-or-nothing across every
        customer. With them, the blast radius of a mistake is one install, and
        rolling back is a version pointer rather than an incident.
      </Callout>
    </>
  )
}

/* ============================================================
   Operate: runbooks (runbooks/*.toml)
   ============================================================ */

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
  const runbook = runbooks[selected]
  const install = installIdOf(config)

  return (
    <>
      <FlowHeader
        eyebrow="Operate · runbooks"
        title="Run runbooks"
        lede="A runbook is a versioned, multi-step procedure Nuon runs against an install and records. This app ships four, one per operational moment: routine health, something's-wrong diagnostics, drift, and the emergency. Two are read-only; two apply changes, and the badges below say which. Each one is a single CLI command away."
      />

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
              onClick={() => setSelected(i)}
            >
              <span className="tile__head">
                <Icon name="book-open" />
                <span className="mono">{rb.name}</span>
              </span>
              <span className="tile__body">
                {rb.steps.length} steps ·{' '}
                {rb.mutates ? 'applies changes' : 'read-only'}
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
        </p>
        <CommandBlock
          label={`run ${runbook.name} against this install`}
          command={`nuon runbooks create-run --install-id ${install} --runbook-id ${runbook.name}`}
          note={
            runbook.mutates ? (
              <>
                <strong>This one changes things</strong> — it re-applies state
                or assumes elevated access. Run it deliberately; the per-step
                record it leaves behind is the point.
              </>
            ) : (
              <>
                Read-only diagnostics: safe to run right now. Runbooks accept
                their name directly — no id lookup needed.
              </>
            )
          }
        />
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="data">
            <thead>
              <tr>
                <th>#</th>
                <th>Step</th>
                <th>Type</th>
                <th>What it does</th>
              </tr>
            </thead>
            <tbody>
              {runbook.steps.map((step, i) => (
                <tr key={step.name}>
                  <td className="mono subtext">{i + 1}</td>
                  <td className="mono">{step.name}</td>
                  <td className="mono subtext">{step.type}</td>
                  <td>{step.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Callout label="Where the record lives">
        The branch config runs <span className="mono">full-health-check</span>{' '}
        automatically after every staged deploy (
        <span className="mono">post_deploy_runbooks</span> in branch.toml), so
        this install already has real runs on record, and the run you create
        above joins them: each one leaves a per-step transcript.{' '}
        {config.links.runbooks && (
          <OutLink href={config.links.runbooks} variant="plain">
            Open the latest full-health-check transcript
          </OutLink>
        )}
      </Callout>

      <LiveEvidence
        config={config}
        lead={
          <>
            The read-only runbooks leave the cluster untouched — their record
            is the transcript. The two that apply changes are visible right
            here: <span className="mono">reconcile-drift</span> redeploys the
            chart and <span className="mono">break-glass</span> restarts the
            app&rsquo;s deployments, so pod names change and ages reset in this
            table as the run works.
          </>
        }
      />
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

/** What a real run of each action puts on the record. */
function actionOutcome(name: string, installID: string): ReactNode {
  if (name === 'cron_status') {
    return (
      <>
        The run&rsquo;s transcript lists this namespace&rsquo;s pods and
        publishes <span className="mono">pods_ready</span> /{' '}
        <span className="mono">pods_total</span> /{' '}
        <span className="mono">checked_at</span> as structured outputs —
        read-only, over in seconds.
      </>
    )
  }
  if (name === 'debug') {
    return (
      <>
        The transcript collects pod state with restart counts, warning events,
        and recent API logs — the support bundle, read-only, nothing changes in
        the cluster.
      </>
    )
  }
  if (name === 'lifecycle_hooks') {
    return (
      <>
        The transcript logs which hook fired. The same script runs
        automatically post-provision and before and after every{' '}
        <span className="mono">kitchen_sink</span> deploy.
      </>
    )
  }
  return (
    <>
      The transcript prints the identity the run assumed (
      <span className="mono">aws sts get-caller-identity</span> &rarr;{' '}
      <span className="mono">{installID}-app-break-glass</span>), then a{' '}
      <em>denied</em> Secrets Manager call — the permissions boundary doing its
      job — and then restarts the app&rsquo;s three deployments. Watch the pod
      table below while it runs.
    </>
  )
}

function ActionsFlow({ config }: { config: UIConfig }) {
  const [selected, setSelected] = useState(0)
  const action = adhocActions[selected]
  const install = installIdOf(config)
  const app = appIdOf(config)

  return (
    <>
      <FlowHeader
        eyebrow="Operate · adhoc actions"
        title="Run adhoc actions"
        lede="An action is a script the runner executes inside the install, on a schedule, around a deploy, or on demand. This app ships four; the manual ones are how support fixes an install without cluster credentials. Two commands run any of them for real."
      />

      <section className="section">
        <div className="tiles" style={{ marginBottom: 24 }}>
          {adhocActions.map((a, i) => (
            <button
              key={a.name}
              className={i === selected ? 'tile tile--active' : 'tile'}
              onClick={() => setSelected(i)}
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
              elevated access · restarts the app&rsquo;s pods
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

        <CommandBlock
          label="1 · list the action workflows and copy the id"
          command={`nuon actions list --app-id ${app}`}
          note={
            <>
              The sharp edge: <span className="mono">create-run</span> takes
              the workflow <strong>id</strong> (it starts with{' '}
              <span className="mono">actw</span>), never the name — so list
              first and copy the id next to{' '}
              <span className="mono">{action.name}</span>.
            </>
          }
        />
        <CommandBlock
          label={`2 · run ${action.name} against this install`}
          command={`nuon actions create-run --install-id ${install} --action-workflow-id <actw-id>`}
          note={
            <>
              To override the IAM role for one run, the flag is{' '}
              <span className="mono">--role-name</span>.
            </>
          }
        />
        <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
          {actionOutcome(action.name, install)}
        </p>
      </section>

      <Callout label="Real runs, on the record right now">
        One of these is not waiting for you: <span className="mono">cron_status</span>{' '}
        has run hourly on this install since it provisioned, publishing{' '}
        <span className="mono">pods_ready</span> /{' '}
        <span className="mono">pods_total</span> as structured outputs (the
        install readme reads them as its health pulse). Every run&rsquo;s
        transcript and outputs are in the dashboard — including the one you
        create above.{' '}
        {config.links.actions && (
          <OutLink href={config.links.actions} variant="plain">
            Open the hourly run history
          </OutLink>
        )}
      </Callout>

      <LiveEvidence
        config={config}
        lead={
          <>
            Three of the four actions are read-only, so their only record is
            the transcript. <span className="mono">break_glass_remediation</span>{' '}
            ends with a rollout restart: new pod names, ages reset to seconds —
            it lands in this table within one poll.
          </>
        }
      />

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
  const install = installIdOf(config)
  const app = appIdOf(config)

  return (
    <>
      <FlowHeader
        eyebrow="Govern · operation roles"
        title="Scope operation roles"
        lede="Nuon performs every operation under a per-operation IAM role your customer can read, each with its own permissions boundary. This app declares seven, from provision down to a break-glass role that exists only for emergencies — and one action run proves the whole model on the record."
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

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Prove it, for real</h2>
          <div className="subtext muted">the break-glass run narrates its own evidence</div>
        </div>
        <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
          The <span className="mono">break_glass_remediation</span> action is
          scripted to demonstrate this page: its transcript prints the identity
          it assumed and then a call the boundary refuses. Two commands run it
          against this install.
        </p>
        <CommandBlock
          label="1 · resolve the workflow id (create-run takes the id, not the name)"
          command={`nuon actions list --app-id ${app}`}
        />
        <CommandBlock
          label="2 · run it (heads up: it ends by restarting the app's pods)"
          command={`nuon actions create-run --install-id ${install} --action-workflow-id <actw-id>`}
        />
        <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
          In the run&rsquo;s transcript:{' '}
          <span className="mono">aws sts get-caller-identity</span> resolves to{' '}
          <span className="mono">{install}-app-break-glass</span>, and the
          Secrets Manager call that follows is <em>denied</em> — the explicit
          Deny from break_glass.toml holding under AdministratorAccess.{' '}
          {config.links.actions && (
            <OutLink href={config.links.actions} variant="plain">
              Read the transcript in the dashboard
            </OutLink>
          )}
        </p>
      </section>

      <LiveEvidence
        config={config}
        lead={
          <>
            The same run&rsquo;s last act is a rollout restart of the
            app&rsquo;s three deployments — proof you can watch from right
            here: pod names change and ages reset the moment it lands.
          </>
        }
      />

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
   Drive: the command menu and the copy-paste agent prompt. Both tracks use
   this install's real ids, filled in from ui-config at render time.
   ============================================================ */

function agentPrompt(install: string, app: string): string {
  return `You are operating the Nuon CLI against MY app and MY install, in my own Nuon org.
I have already run "nuon auth login" on this machine, so the CLI is authenticated
(session in ~/.nuon). Do not ask me for, print, or export any token.

Hard limits:
- Only this app and install: app kitchen-sink (${app}), install ${install}.
- NEVER create, delete, or tear down installs, apps, components, or branches.
- Add --output agent to every nuon command; prefix every read with NUON_READ_ONLY=1.
- Before EVERY mutating command: show me the exact command, say what it will change,
  and wait for my explicit "yes". After every command, show me the result.

Warm-up: NUON_READ_ONLY=1 nuon installs get -i ${install} --output agent

Then walk me through day-2 for real, in this order:

1. RUNBOOK — NUON_READ_ONLY=1 nuon runbooks list -i ${install} --output agent;
   confirm full-health-check exists (it is read-only diagnostics). After my yes:
   nuon runbooks create-run -i ${install} -r full-health-check --output agent.
   Poll get-run until it finishes; summarize each step.

2. ACTION + ROLE PROOF — NUON_READ_ONLY=1 nuon actions list -a ${app} --output agent;
   create-run needs the workflow ID (actw...), not the name — resolve
   break_glass_remediation here. Warn me it restarts my app's three deployments.
   After my yes:
   nuon actions create-run -i ${install} -w <actw-id> --output agent
   (if overriding the role: the flag is --role-name, not --role). Fetch the run logs
   and point out the assumed role ARN (...-app-break-glass) and the expected Secrets
   Manager deny — that is the per-operation IAM proof. Then tell me to open my
   kitchen-sink page and watch the pod ages reset.

3. BRANCH — my app config is cloned at <path-to-your-clone>. Help me make one small
   visible edit, then from that directory, after my yes:
   nuon sync --branch ${branchName} --output agent.
   This syncs my local files and triggers a real staged branch run — no push needed.
   Report each group's progress; if a group holds for approval, tell me and I will
   approve it in my dashboard.

4. ROLLBACK — API-only (no CLI command yet). Read my session credentials into shell
   variables without echoing them:
   TOK=$(awk '$1=="api_token:"{print $2}' ~/.nuon); ORG=$(awk '$1=="org_id:"{print $2}' ~/.nuon)
   GET https://api.nuon.co/v1/installs/${install}/app-config-versions
   (headers: Authorization: Bearer $TOK, X-Nuon-Org-ID: $ORG). Show me the versions,
   then POST /v1/installs/${install}/app-config-updates with
   {"app_config_id":"<previous>","plan_only":true} and show me the plan.
   Only after my yes, repeat with "plan_only": false, and tell me to watch the old
   image tags reappear on my pods page.

Budget: exactly one run per flow. Anything else requires my explicit request.`
}

function AgentFlow({ config }: { config: UIConfig }) {
  const install = installIdOf(config)
  const app = appIdOf(config)
  const prompt = agentPrompt(install, app)

  return (
    <>
      <FlowHeader
        eyebrow="Drive · terminal & agents"
        title="Run day-2 from your terminal"
        lede="Two tracks to the same place. Run the command menu yourself, or paste one prompt into Claude Code or Codex and let it drive — it must show you every command and wait for your yes before anything mutates. Either way, this install's ids are already filled in below."
      />

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Once per machine: the CLI</h2>
          <div className="subtext muted">no tokens to paste</div>
        </div>
        <CommandBlock
          label="install the nuon CLI"
          command="curl -sSL install.nuon.co | bash"
          note={
            <>
              Or <span className="mono">brew install nuonco/tap/nuon</span>.
            </>
          }
        />
        <CommandBlock
          label="authenticate"
          command="nuon auth login"
          note={
            <>
              Opens your browser; approve and this machine — and any agent you
              run in its shell — is signed in for the day. No token handling.
            </>
          }
        />
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Track one: the command menu</h2>
          <div className="subtext muted">one command per flow, your ids filled in</div>
        </div>
        <CommandBlock
          label="run a real health check (read-only)"
          command={`nuon runbooks create-run --install-id ${install} --runbook-id full-health-check`}
          note={<>A run appears in your dashboard with per-step results.</>}
        />
        <CommandBlock
          label="prove the per-operation IAM roles (restarts this app's pods)"
          command={`nuon actions list --app-id ${app}`}
          note={
            <>
              Copy the <span className="mono">actw</span> id next to{' '}
              <span className="mono">break_glass_remediation</span>, then{' '}
              <span className="mono">
                nuon actions create-run --install-id {install}{' '}
                --action-workflow-id &lt;actw-id&gt;
              </span>
              . The run logs print the assumed break-glass role and a denied
              Secrets Manager call; watch the pod ages reset on the{' '}
              <span className="mono">actions</span> page here.
            </>
          }
        />
        <CommandBlock
          label="ship a change through the staged groups (from your clone)"
          command={`nuon sync --branch ${branchName}`}
          note={
            <>
              Syncs your local edit — no push needed — and triggers a real
              branch run, group by group; approve held groups in your
              dashboard.
            </>
          }
        />
        <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
          Rollback is the one flow without a CLI command today: it runs from
          the version history in the dashboard — plan first, then apply, and
          the old image tags reappear on your pods.{' '}
          {config.links.versions && (
            <OutLink href={config.links.versions} variant="plain">
              Open this install&rsquo;s version history
            </OutLink>
          )}
        </p>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Track two: the agent prompt</h2>
          <div className="subtext muted">paste into Claude Code or Codex</div>
        </div>
        <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
          One prompt, scoped hard to this app and install: the agent must show
          every command, keep reads read-only, and stop for your explicit
          &ldquo;yes&rdquo; before each of the four mutating steps.
        </p>
        <div className="agent-prompt">
          <div className="cmd__head">
            <span className="cmd__label">the prompt, your ids filled in</span>
            <CopyButton text={prompt} />
          </div>
          <pre className="cmd__pre agent-prompt__pre">{prompt}</pre>
        </div>
      </section>

      <Callout label="Why the terminal, and not buttons here">
        Acting from your own terminal and your own dashboard is the product:
        this page runs behind your customer&rsquo;s load balancer, so it hands
        you commands and shows you evidence instead of holding credentials. An
        app that could mutate your install from a public page would be the
        wrong demo.
      </Callout>
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
  if (flow === 'agent')
    return { href: links.tokens ?? links.install, label: 'API tokens for CI & agents in Nuon' }
  return { href: links.install, label: 'Open this install in Nuon' }
}

/**
 * The bare index doubles as a watcher for the toggleable components' tiles,
 * the same way the landing hub does: while either component is off, keep
 * re-reading the namespace so a dashboard toggle flips the switch here.
 */
function CustomizeIndex({ config }: { config: UIConfig }) {
  const namespace = config.namespace ?? 'kitchen-sink'
  const probe = useIntrospectPoll<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
    20_000,
    true,
  )
  const services =
    probe.state === 'ok' ? (probe.value.response.services ?? []) : []
  const switches: SwitchStates = {
    '/tictactoe': { on: hasTicTacToe(services) },
    '/audit-log': { on: hasAuditLogExporter(services) },
  }

  return (
    <>
      <FlowHeader
        eyebrow="Customize"
        title="Day-2, one capability at a time"
        lede="Everything below is grounded in this app's real config. Live pages read this install right now; guides explain the config it ships. The operations themselves run from your terminal and dashboard — each page hands you the exact commands."
      />
      <CapabilityGroups
        categories={categories.filter((c) => c.dayTwo)}
        switches={switches}
      />
    </>
  )
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
      {flow === 'agent' && <AgentFlow config={config} />}

      {!flow && <CustomizeIndex config={config} />}

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
