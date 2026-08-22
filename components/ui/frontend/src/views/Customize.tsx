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
  roles,
  runbooks,
} from '../lib/config-data.gen'
import { agentPrompt, proofPrompts } from '../lib/prompts'
import { stepEyebrow } from '../lib/taxonomy'
import { EvalPath, StepNav, type SwitchStates } from '../ui/CapabilityGrid'
import { useMarkStepSeen } from '../lib/progress'
import {
  BackLink,
  Badge,
  CodeBlock,
  CommandBlock,
  CopyButton,
  Eyebrow,
  Icon,
  LoadState,
  OutLink,
  PhaseBadge,
  PspSection,
  PspTag,
} from '../ui/Primitives'

/* ============================================================
   The feature pages, one per step in lib/taxonomy.ts. Every page runs the
   same three beats: Problem (where this bites), Solution (the config that
   answers it, from lib/config-data.gen.ts so it cannot drift), Proof (test
   it on this install, right now — your coding agent by default, the raw
   commands underneath, and the cluster-side evidence live where the
   operation has one).
   ============================================================ */

function FlowHeader({
  to,
  title,
  problem,
}: {
  to: string
  title: string
  problem: ReactNode
}) {
  return (
    <header className="page-header">
      <Eyebrow>{stepEyebrow(to)}</Eyebrow>
      <h1>{title}</h1>
      <p className="lede psp-lede">
        <PspTag kind="problem" /> {problem}
      </p>
    </header>
  )
}

/** The install/app ids for command interpolation, with honest placeholders
    when this app was started without them (local dev). */
const installIdOf = (config: UIConfig) => config.install_id ?? '<your-install-id>'
const appIdOf = (config: UIConfig) => config.app_id ?? '<your-app-id>'

/**
 * The two ways to run a proof, as one first-class control: hand it to a
 * coding agent, or type the commands yourself. Same pattern on every proof
 * section, agent first — that is the default action everywhere else too.
 */
export function Tracks({ agent, manual }: { agent: ReactNode; manual: ReactNode }) {
  const [track, setTrack] = useState<'agent' | 'manual'>('agent')
  return (
    <div className="tracks">
      <div className="tracks__bar" role="tablist" aria-label="How to run this">
        <button
          type="button"
          role="tab"
          aria-selected={track === 'agent'}
          className={track === 'agent' ? 'tracks__tab tracks__tab--on' : 'tracks__tab'}
          onClick={() => setTrack('agent')}
        >
          Paste into your coding agent
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={track === 'manual'}
          className={track === 'manual' ? 'tracks__tab tracks__tab--on' : 'tracks__tab'}
          onClick={() => setTrack('manual')}
        >
          Run it yourself
        </button>
      </div>
      <div className="tracks__panel">{track === 'agent' ? agent : manual}</div>
    </div>
  )
}

/** The default way to run a proof: paste it into a coding agent. */
export function ProofPrompt({ flow, config }: { flow: string; config: UIConfig }) {
  const build = proofPrompts[flow]
  if (!build) return null
  const prompt = build(installIdOf(config), appIdOf(config))
  return (
    <div className="agent-prompt proof-prompt">
      <div className="cmd__head">
        <span className="cmd__label">the prompt, your ids filled in</span>
        <CopyButton text={prompt} />
      </div>
      <pre className="cmd__pre agent-prompt__pre proof-prompt__pre">{prompt}</pre>
    </div>
  )
}

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
  const namespace = config.namespace ?? 'periscope'
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
        to="/customize/branches"
        title="Ship through app branches"
        problem="Without staging, one bad config change reaches every customer at once."
      />

      <PspSection
        kind="solution"
        title="One branch, a staged rollout"
        aside="branch.toml · [[install_groups]]"
      >
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
          Every push to <span className="mono">{branchName}</span> builds the
          config at that commit and rolls it across these groups in order.
          Each group&rsquo;s plan holds for a human approval, and the{' '}
          <span className="mono">full-health-check</span> runbook runs on
          every install after its group deploys.
        </p>
        <CodeBlock
          label="branch.toml (the real config, comments stripped)"
          code={branchConfigAbridged}
        />
      </PspSection>

      <PspSection
        kind="proof"
        title="Ship a change to this install"
        aside="one command from your terminal"
      >
        <Tracks
          agent={<ProofPrompt flow="branches" config={config} />}
          manual={
            <CommandBlock
              label="edit any file in your clone, then sync and trigger the run"
              command={`nuon sync --app-id ${appIdOf(config)} --force --branch ${branchName}`}
              note={
                <>
                  Syncs your local files exactly as they are (even uncommitted,
                  no push) and triggers a real branch run through the groups
                  above. <span className="mono">--preview</span> plans every
                  group with nothing applied.
                </>
              }
            />
          }
        />
        <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
          Each group&rsquo;s approval is a person in the dashboard; there is
          deliberately no CLI command for it.{' '}
          {config.links.branches && (
            <OutLink href={config.links.branches} variant="plain">
              Watch the run and approve each group
            </OutLink>
          )}
        </p>
        <LiveEvidence
          config={config}
          lead={
            <>
              When the run&rsquo;s deploy reaches this install, the image tags
              below flip to the new <span className="mono">sha-*</span> stamp
              and the pods churn as the new version rolls in.
            </>
          }
        />
        <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
          Rolling back: there is no CLI command yet. Re-deploy a previous
          version from the dashboard&rsquo;s version history (plan first),
          or revert the commit and let the same staged rollout replay.{' '}
          {config.links.versions && (
            <OutLink href={config.links.versions} variant="plain">
              Open this install&rsquo;s version history
            </OutLink>
          )}
        </p>
      </PspSection>
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
        to="/customize/runbooks"
        title="Run the console SOPs"
        problem="Something breaks at 2am, in an install you cannot log into."
      />

      <PspSection
        kind="solution"
        title="Four recorded procedures"
        aside="runbooks/*.toml"
      >
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
        <div className="table-wrap">
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
      </PspSection>

      <PspSection
        kind="proof"
        title="Run one against this install"
        aside="every run leaves a per-step transcript"
      >
        <Tracks
          agent={<ProofPrompt flow="runbooks" config={config} />}
          manual={
            <CommandBlock
              label={`run ${runbook.name} against this install`}
              command={`nuon runbooks create-run --install-id ${install} --runbook-id ${runbook.name}`}
              note={
                runbook.mutates ? (
                  <>
                    <strong>This one changes things</strong> — it re-applies
                    state or assumes elevated access. Run it deliberately.
                  </>
                ) : (
                  <>
                    Read-only diagnostics: safe to run right now. Runbooks
                    accept their name directly — no id lookup needed.
                  </>
                )
              }
            />
          }
        />
        <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
          This install already has real runs on record:{' '}
          <span className="mono">full-health-check</span> runs after every
          staged deploy (<span className="mono">post_deploy_runbooks</span>),
          so the report archive has held a real health report since the first
          deploy. The two read-only SOPs&rsquo; only write is their archive
          object.{' '}
          {config.links.runbooks && (
            <OutLink href={config.links.runbooks} variant="plain">
              Open the latest full-health-check transcript
            </OutLink>
          )}
        </p>
        <LiveEvidence
          config={config}
          lead={
            <>
              The two SOPs that apply changes land right here:{' '}
              <span className="mono">reconcile-drift</span> redeploys the chart
              and <span className="mono">break-glass</span> restarts the
              console&rsquo;s deployments, so pod names change and ages reset
              as the run works.
            </>
          }
        />
      </PspSection>
    </>
  )
}

/* ============================================================
   Operate: adhoc actions (the nuon.toml of each actions/ entry)
   ============================================================ */

/** Editorial context per action; the facts next to it come from the config. */
const actionNotes: Record<string, string> = {
  uptime_heartbeat:
    'Collects pod status and publishes pods_ready / pods_total as structured outputs; the install readme reads them as its health pulse, and each hourly run drops a snapshot into the report archive under heartbeats/.',
  debug:
    'What support runs when an install misbehaves: pods, events, and recent logs, with nobody handed a kubeconfig.',
  lifecycle_hooks:
    'Brackets every chart deploy, which is where a migration or a cache warm goes. Depends on periscope.',
  break_glass_remediation:
    'The emergency workload restart: elevated remediation through a recorded action instead of ad-hoc console access. Assumes the break-glass role from break_glass.toml.',
}

/** What a real run of each action puts on the record. */
function actionOutcome(name: string, installID: string): ReactNode {
  if (name === 'uptime_heartbeat') {
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
        <span className="mono">periscope</span> deploy.
      </>
    )
  }
  return (
    <>
      The transcript prints the identity the run assumed (
      <span className="mono">aws sts get-caller-identity</span> &rarr;{' '}
      <span className="mono">{installID}-app-break-glass</span>), then a{' '}
      <em>denied</em> Secrets Manager call — the permissions boundary doing its
      job — and then restarts Periscope&rsquo;s three deployments. Watch the
      pod table below while it runs.
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
        to="/customize/actions"
        title="Run adhoc actions"
        problem="Support needs to fix a customer install without holding its credentials."
      />

      <PspSection
        kind="solution"
        title="Scripts the runner executes inside the install"
        aside="actions/*/nuon.toml"
      >
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
        <div className="row">
          {action.triggers.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
          {action.labels && <span className="chip">{action.labels}</span>}
        </div>
        <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
          The runner already has the access an action needs; the action is the
          audited, repeatable path to using it.
        </p>
      </PspSection>

      <PspSection
        kind="proof"
        title="Fire one at this install"
        aside="two commands"
      >
        <Tracks
          agent={<ProofPrompt flow="actions" config={config} />}
          manual={
            <>
              <CommandBlock
                label="1 · list the action workflows and copy the id"
                command={`nuon actions list --app-id ${app}`}
                note={
                  <>
                    The sharp edge: <span className="mono">create-run</span>{' '}
                    takes the workflow <strong>id</strong> (it starts with{' '}
                    <span className="mono">actw</span>), never the name — so
                    list first and copy the id next to{' '}
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
            </>
          }
        />
        <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
          {actionOutcome(action.name, install)}
        </p>
        <p className="small muted" style={{ marginTop: 12, maxWidth: '72ch' }}>
          One of these is already on the record:{' '}
          <span className="mono">uptime_heartbeat</span> has run hourly since this
          install provisioned.{' '}
          {config.links.actions && (
            <OutLink href={config.links.actions} variant="plain">
              Open the hourly run history
            </OutLink>
          )}
        </p>
        <LiveEvidence
          config={config}
          lead={
            <>
              <span className="mono">break_glass_remediation</span> ends with a
              rollout restart: new pod names, ages reset to seconds — it lands
              in this table within one poll.
            </>
          }
        />
      </PspSection>
    </>
  )
}

/* ============================================================
   Operate: component health (live pod reads + the config behind the gate)
   ============================================================ */

function HealthFlow({ config }: { config: UIConfig }) {
  const namespace = config.namespace ?? 'periscope'
  const ns = useIntrospect<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
  )
  const pods = ns.state === 'ok' ? (ns.value.response.pods ?? []) : []

  return (
    <>
      <FlowHeader
        to="/customize/health"
        title="Watch component health"
        problem="A deploy can succeed while the app it shipped is down."
      />

      <PspSection
        kind="solution"
        title="Health gates every deploy"
        aside="a component that never goes green blocks the install"
      >
        <p className="small muted" style={{ maxWidth: '72ch' }}>
          Nuon waits for a component to become healthy before calling its
          deploy done. That gate shapes this app&rsquo;s config in two places:
        </p>
        <div className="prose" style={{ marginTop: 12 }}>
          <ul>
            <li>
              The API has no ingress: an internal ingress never converges (no
              cert, no DNS), so the component would sit un-green forever. The
              UI reaches it in-cluster at{' '}
              <code>http://periscope-api:8080</code>.
            </li>
            <li>
              The chart&rsquo;s ConfigMap carries a <code>nuon.co/roll</code>{' '}
              annotation set to the Helm release revision, so a redeploy is
              never a no-op that would skip the gate.
            </li>
          </ul>
        </div>
        <CodeBlock
          label="components/chart/values.yaml"
          code={`api:
  # No internal ingress: the UI reaches the API via the in-cluster service
  # (see ui.env.API_URL). An internal ingress here never converges (no cert/DNS
  # for its host), which would keep the component health from ever going green.
  ingress: {}`}
        />
      </PspSection>

      <PspSection
        kind="proof"
        title="The gate's inputs, right now"
        aside={`GET /introspect/namespace/${namespace}`}
      >
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
        <div style={{ marginTop: 16 }}>
          <Tracks
            agent={<ProofPrompt flow="health" config={config} />}
            manual={
              <CommandBlock
                label="run the same checks the deploy gate relies on (read-only)"
                command={`nuon runbooks create-run --install-id ${installIdOf(config)} --runbook-id full-health-check`}
              />
            }
          />
        </div>
      </PspSection>
    </>
  )
}

/* ============================================================
   React: triggers (derived from the actions' trigger declarations)
   ============================================================ */

function TriggersFlow({ config }: { config: UIConfig }) {
  return (
    <>
      <FlowHeader
        to="/customize/triggers"
        title="Wire up triggers"
        problem="Operational scripts need to run at the right moment with nobody remembering them."
      />

      <PspSection
        kind="solution"
        title="Every trigger this app declares"
        aside="actions/*/nuon.toml · [[triggers]]"
      >
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
        <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
          <span className="mono">lifecycle_hooks</span> fires post-provision
          and around every <span className="mono">periscope</span> deploy,
          which is where a migration or a cache warm goes.
        </p>
        <CodeBlock
          label="actions/lifecycle_hooks/nuon.toml (the real file)"
          code={lifecycleHooksToml}
        />
      </PspSection>

      <PspSection
        kind="proof"
        title="Fire a scheduled action on demand"
        aside="the same run its cron fires hourly"
      >
        <Tracks
          agent={<ProofPrompt flow="triggers" config={config} />}
          manual={
            <>
              <CommandBlock
                label="1 · resolve uptime_heartbeat to its workflow id"
                command={`nuon actions list --app-id ${appIdOf(config)}`}
              />
              <CommandBlock
                label="2 · fire the same run its cron fires hourly"
                command={`nuon actions create-run --install-id ${installIdOf(config)} --action-workflow-id <actw-id>`}
              />
            </>
          }
        />
        <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
          Its hourly history is already on the record.{' '}
          {config.links.actions && (
            <OutLink href={config.links.actions} variant="plain">
              Open the run history
            </OutLink>
          )}
        </p>
      </PspSection>
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
    'The narrowest role here: inline policies allowing eks:DescribeCluster plus put-and-list scoped to the report archive bucket — exactly what SOPs and actions do, nothing more.',
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
        to="/customize/roles"
        title="Scope operation roles"
        problem="Your customer's security team asks exactly what Nuon may do in their account."
      />

      <PspSection
        kind="solution"
        title="One role per operation"
        aside="permissions/*.toml · break_glass.toml"
      >
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
        <CodeBlock label="break_glass.toml (the real file)" code={breakGlassToml} />
        <p className="small muted" style={{ marginTop: 24, maxWidth: '72ch' }}>
          On top of the roles, OPA policies bound what a config may ask for,
          evaluated against plans before anything applies:
        </p>
        <div className="table-wrap" style={{ marginTop: 12 }}>
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
        <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
          Who may drive Nuon itself is governed by org API tokens.{' '}
          {config.links.tokens && (
            <OutLink href={config.links.tokens} variant="plain">
              Manage API tokens in Nuon
            </OutLink>
          )}
        </p>
      </PspSection>

      <PspSection
        kind="proof"
        title="Prove the boundary, on the record"
        aside="the break-glass run narrates its own evidence"
      >
        <Tracks
          agent={<ProofPrompt flow="roles" config={config} />}
          manual={
            <>
              <CommandBlock
                label="1 · resolve the workflow id (create-run takes the id, not the name)"
                command={`nuon actions list --app-id ${app}`}
              />
              <CommandBlock
                label="2 · run it (heads up: it ends by restarting the app's pods)"
                command={`nuon actions create-run --install-id ${install} --action-workflow-id <actw-id>`}
              />
            </>
          }
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
        <LiveEvidence
          config={config}
          lead={
            <>
              The same run&rsquo;s last act is a rollout restart of
              Periscope&rsquo;s three deployments: pod names change and ages
              reset the moment it lands.
            </>
          }
        />
      </PspSection>
    </>
  )
}

/* ============================================================
   The agent page: the full checklist prompt and the command menu it wraps.
   Both use this install's real ids, filled in from ui-config at render time.
   ============================================================ */

function AgentFlow({ config }: { config: UIConfig }) {
  const install = installIdOf(config)
  const app = appIdOf(config)
  const prompt = agentPrompt(install, app)

  return (
    <>
      <header className="page-header">
        <h1>Run day-2 from your terminal</h1>
        <p className="lede">
          One prompt walks Claude Code or Codex through every proof on the
          checklist: it must show you each command and wait for your yes
          before anything mutates. The command menu below is the same walk,
          one command per flow.
        </p>
      </header>

      <Tracks
        agent={
          <div className="agent-prompt">
            <div className="cmd__head">
              <span className="cmd__label">the prompt, your ids filled in</span>
              <CopyButton text={prompt} />
            </div>
            <pre className="cmd__pre agent-prompt__pre">{prompt}</pre>
          </div>
        }
        manual={
          <>
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
                  . The run logs print the assumed break-glass role and a
                  denied Secrets Manager call; watch the pod ages reset on the{' '}
                  <span className="mono">actions</span> page here.
                </>
              }
            />
            <CommandBlock
              label="ship a change through the staged groups (from your clone)"
              command={`nuon sync --app-id ${app} --force --branch ${branchName}`}
              note={
                <>
                  Syncs your local edit — no push needed — and triggers a real
                  branch run, group by group; approve held groups in your
                  dashboard.
                </>
              }
            />
            <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
              Rollback is the one flow without a CLI command today: it runs
              from the version history in the dashboard — plan first, then
              apply, and the old image tags reappear on your pods.{' '}
              {config.links.versions && (
                <OutLink href={config.links.versions} variant="plain">
                  Open this install&rsquo;s version history
                </OutLink>
              )}
            </p>
          </>
        }
      />

      <p className="small muted" style={{ maxWidth: '72ch' }}>
        Why the terminal, and not buttons here: this page runs behind your
        customer&rsquo;s load balancer, so it hands you commands and shows you
        evidence instead of holding credentials.
      </p>
    </>
  )
}

/* ============================================================
   The view. Bare #/customize renders the checklist for deep links; the
   landing's hub is the full front door.
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
 * The bare index doubles as a watcher for the toggleable components' rows,
 * the same way the landing hub does: while either component is off, keep
 * re-reading the namespace so a dashboard toggle flips the switch here.
 */
function CustomizeIndex({ config }: { config: UIConfig }) {
  const namespace = config.namespace ?? 'periscope'
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
      <header className="page-header">
        <h1>The evaluation checklist</h1>
        <p className="lede">
          Live pages read this install right now; guides explain the config it
          ships.
        </p>
      </header>
      <EvalPath switches={switches} />
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
  const route = flow ? `/customize/${flow}` : undefined
  useMarkStepSeen(route)

  return (
    <>
      <BackLink to="/">Customize Periscope</BackLink>

      {flow === 'branches' && <BranchesFlow config={config} />}
      {flow === 'runbooks' && <RunbooksFlow config={config} />}
      {flow === 'actions' && <ActionsFlow config={config} />}
      {flow === 'health' && <HealthFlow config={config} />}
      {flow === 'triggers' && <TriggersFlow config={config} />}
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

      {route && <StepNav current={route} />}
    </>
  )
}
