import { useEffect, useState } from 'react'
import {
  countReady,
  useIntrospectPoll,
  type NamespaceResponse,
  type PodSummary,
  type UIConfig,
} from '../lib/api'
import {
  adhocActions,
  branchName,
  installGroups,
  roles,
  runbooks,
} from '../lib/config-data.gen'
import { proofPrompts } from '../lib/prompts'
import {
  Badge,
  CommandBlock,
  CopyButton,
  LoadState,
  OutLink,
  PhaseBadge,
  Section,
} from '../ui/Primitives'

/* ============================================================
   The map under the product: what Nuon deployed to run Relay, how changes
   ship (an app branch and toggleable components), and how the install is
   operated (health, runbooks, actions, per-operation roles). One page; the
   product pages stay about deliveries.
   ============================================================ */

const NS_POLL_MS = 15_000

const installIdOf = (config: UIConfig) => config.install_id ?? '<your-install-id>'
const appIdOf = (config: UIConfig) => config.app_id ?? '<your-app-id>'

/* ---------- Agent / CLI, equal billing ---------- */

function Tracks({
  agent,
  manual,
}: {
  agent: React.ReactNode
  manual: React.ReactNode
}) {
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

function AgentPrompt({ flow, config }: { flow: string; config: UIConfig }) {
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

/* ---------- What runs Relay ---------- */

interface Workload {
  name: string
  /** Pod-name prefix in the namespace; null for the CronJob's transient pods. */
  prefix: string | null
  role: string
}

const workloads: Workload[] = [
  {
    name: 'relay-api',
    prefix: 'relay-api-',
    role: 'Ingest — POST /ingest (in-cluster only) and the delivery reads behind Events, Endpoints, and Dead letters',
  },
  {
    name: 'relay-worker',
    prefix: 'relay-worker-',
    role: 'Delivery engine — polls due attempts, POSTs to endpoints, backs off, dead-letters after five failures',
  },
  {
    name: 'relay-db',
    prefix: 'relay-db-',
    role: 'Postgres — the queue and the delivery record; consumes the db-password Secret Nuon syncs in',
  },
  {
    name: 'relay-echo',
    prefix: 'relay-echo-',
    role: 'The seeded default endpoint: an echo receiver, so a fresh install delivers end to end',
  },
  {
    name: 'relay-ui',
    prefix: 'relay-ui-',
    role: 'This console, published through the ALB at https://app.<install domain>',
  },
  {
    name: 'relay-event-generator',
    prefix: 'relay-event-generator-',
    role: 'CronJob — posts 1–3 sample events to /ingest every 2 minutes; the deliveries are real',
  },
]

function imageTag(pod: PodSummary): string | undefined {
  const image =
    pod.status?.containerStatuses?.[0]?.image ?? pod.spec?.containers?.[0]?.image
  if (!image) return undefined
  const tail = image.split('/').pop() ?? image
  const i = tail.lastIndexOf(':')
  return i === -1 ? 'latest' : tail.slice(i + 1)
}

function WorkloadStatus({ pods }: { pods: PodSummary[] }) {
  if (pods.length === 0) return <span className="muted subtext">no pods</span>
  const ready = countReady(pods)
  const phase = pods[0].status?.phase
  return (
    <span className="row" style={{ gap: 8 }}>
      <PhaseBadge phase={phase} />
      <span className="mono subtext">
        {ready}/{pods.length} ready
      </span>
    </span>
  )
}

function Workloads({ config }: { config: UIConfig }) {
  const namespace = config.namespace ?? 'relay'
  const ns = useIntrospectPoll<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
    NS_POLL_MS,
    true,
  )
  const pods = ns.state === 'ok' ? (ns.value.response.pods ?? []) : []

  const podsFor = (w: Workload) =>
    w.prefix ? pods.filter((p) => p.metadata?.name?.startsWith(w.prefix!)) : []

  return (
    <Section
      id="workloads"
      title="What runs Relay"
      aside={`namespace ${namespace} · GET /introspect/namespace/${namespace} · re-read every ${NS_POLL_MS / 1000}s`}
    >
      <LoadState result={ns} what="the namespace" />
      {ns.state === 'ok' && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Workload</th>
                <th>Runs</th>
                <th>Status</th>
                <th>Image tag</th>
              </tr>
            </thead>
            <tbody>
              {workloads.map((w) => {
                const mine = podsFor(w)
                return (
                  <tr key={w.name}>
                    <td className="mono">{w.name}</td>
                    <td>{w.role}</td>
                    <td>
                      {w.name === 'relay-event-generator' && mine.length === 0 ? (
                        <span className="muted subtext">between runs</span>
                      ) : (
                        <WorkloadStatus pods={mine} />
                      )}
                    </td>
                    <td className="mono subtext">
                      {mine[0] ? (imageTag(mine[0]) ?? '—') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

/* ---------- The components behind it ---------- */

const components = [
  {
    name: 'relay',
    type: 'helm_chart',
    what: 'One chart deploys every workload above.',
  },
  {
    name: 'img_api · img_ui',
    type: 'container_image',
    what: 'CI-built images the config pins; a push to this repo stamps a new tag and starts a rollout.',
  },
  {
    name: 'application_load_balancer · certificate',
    type: 'terraform_module',
    what: 'The public HTTPS URL this console is served on.',
  },
  {
    name: 'pulumi_infra',
    type: 'pulumi',
    what: 'The S3 bucket holding the archived delivery logs (Logs & export).',
  },
  {
    name: 'audit_log_exporter',
    type: 'kubernetes_manifest',
    what: 'Toggleable: the Enterprise export entitlement. Its marker Service is what unlocks Logs & export.',
  },
]

function Components({ config }: { config: UIConfig }) {
  return (
    <Section
      title="The components behind it"
      aside="components/*.toml in the app repo"
    >
      <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
        A component is one deployable piece of the product, described by a
        small TOML file. Nuon deploys them in dependency order, on a runner
        inside this account &mdash; credentials never leave it.
      </p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Component</th>
              <th>Type</th>
              <th>For</th>
            </tr>
          </thead>
          <tbody>
            {components.map((c) => (
              <tr key={c.name}>
                <td className="mono">{c.name}</td>
                <td className="mono subtext">{c.type}</td>
                <td>{c.what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {config.links.components && (
        <div className="row" style={{ marginTop: 20 }}>
          <OutLink href={config.links.components} variant="secondary">
            See these components in Nuon
          </OutLink>
        </div>
      )}
    </Section>
  )
}

/* ---------- How changes ship ---------- */

function Ship({ config }: { config: UIConfig }) {
  return (
    <Section id="ship" title="How changes ship" aside="branch.toml">
      <p className="small muted" style={{ maxWidth: '72ch', marginBottom: 16 }}>
        Every push to <span className="mono">{branchName}</span> becomes a
        staged branch run: each group plans, holds for a human approval in the
        dashboard, deploys, and <span className="mono">full-health-check</span>{' '}
        runs on every install after its group.
      </p>
      <div className="groups">
        {installGroups.map((group) => (
          <div key={group.name} className="group-card">
            <div className="group-card__head">
              <span className="arch__num">0{group.order}</span>
              <span className="group-card__name">{group.name}</span>
            </div>
            <div className="group-card__selector mono">{group.selector}</div>
            {group.preview && (
              <div className="group-card__note">PR preview plans run here</div>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20 }}>
        <Tracks
          agent={<AgentPrompt flow="branches" config={config} />}
          manual={
            <CommandBlock
              label="edit any file in your clone, then sync and trigger the run"
              command={`nuon sync --app-id ${appIdOf(config)} --force --branch ${branchName}`}
              note={
                <>
                  Syncs your local files exactly as they are (even uncommitted,
                  no push) and triggers the run through the groups above.{' '}
                  <span className="mono">--preview</span> plans every group with
                  nothing applied.
                </>
              }
            />
          }
        />
      </div>
      <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
        Components with <span className="mono">toggleable = true</span> change
        per install instead: flipping <span className="mono">audit_log_exporter</span>{' '}
        in the dashboard deploys or removes its workload, and{' '}
        <a href="#/logs">Logs &amp; export</a> notices live. Rolling back is a
        re-deploy of a previous config version from the dashboard&rsquo;s
        history.{' '}
        {config.links.versions && (
          <OutLink href={config.links.versions} variant="plain">
            Version history
          </OutLink>
        )}
      </p>
    </Section>
  )
}

/* ---------- How it's operated ---------- */

function Operate({ config }: { config: UIConfig }) {
  const install = installIdOf(config)
  return (
    <Section id="operate" title="How it's operated" aside="runbooks/ · actions/ · permissions/">
      <p className="small muted" style={{ maxWidth: '72ch', marginBottom: 16 }}>
        A deploy only counts once its component goes healthy &mdash; the
        gate&rsquo;s inputs are the pod readiness above. Between deploys,{' '}
        <span className="mono">cron_status</span> heartbeats hourly from the
        runner: it reads pod status and GETs{' '}
        <span className="mono">/api/delivery/stats</span> through the ALB,
        publishing the results as structured outputs.
      </p>

      <h3 style={{ marginBottom: 12 }}>Runbooks</h3>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Runbook</th>
              <th>What it does</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            {runbooks.map((rb) => (
              <tr key={rb.name}>
                <td className="mono">{rb.name}</td>
                <td>{rb.description}</td>
                <td>
                  {rb.mutates ? (
                    <Badge tone="warning" dot>
                      applies changes
                    </Badge>
                  ) : (
                    <Badge tone="positive" dot>
                      read-only
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 12, maxWidth: '72ch' }}>
        <span className="mono">break-glass</span> drains{' '}
        <a href="#/dead-letters">Dead letters</a> with the same replay call
        this console makes, one recorded run instead of ad-hoc console access.{' '}
        {config.links.runbooks && (
          <OutLink href={config.links.runbooks} variant="plain">
            Run transcripts
          </OutLink>
        )}
      </p>
      <div style={{ marginTop: 16 }}>
        <Tracks
          agent={<AgentPrompt flow="runbooks" config={config} />}
          manual={
            <CommandBlock
              label="run the delivery health sweep (read-only)"
              command={`nuon runbooks create-run --install-id ${install} --runbook-id full-health-check`}
              note={<>Runbooks take their name directly; actions need an id lookup first.</>}
            />
          }
        />
      </div>

      <h3 style={{ margin: '32px 0 12px' }}>Actions</h3>
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
      <p className="small muted" style={{ marginTop: 12, maxWidth: '72ch' }}>
        Scripts the runner executes inside the install &mdash; nobody is handed
        a kubeconfig. <span className="mono">lifecycle_hooks</span> brackets
        every chart deploy, which is where a migration goes.{' '}
        {config.links.actions && (
          <OutLink href={config.links.actions} variant="plain">
            Run history
          </OutLink>
        )}
      </p>

      <h3 style={{ margin: '32px 0 12px' }}>Operation roles</h3>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Role</th>
              <th>Boundary</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.name}>
                <td className="mono">
                  {install}-{r.name}
                </td>
                <td className="mono subtext">{r.boundary}</td>
                <td>{r.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 12, maxWidth: '72ch' }}>
        Every operation assumes its own scoped IAM role in this account.{' '}
        <span className="mono">app-break-glass</span> is AdministratorAccess
        with an explicit <span className="mono">secretsmanager:*</span> Deny,
        and only the <span className="mono">break_glass_remediation</span>{' '}
        action can assume it &mdash; its run transcript shows the assumed role
        and the denied call, on the record.
      </p>
    </Section>
  )
}

/* ---------- The view ---------- */

export function Infrastructure({
  config,
  section,
}: {
  config: UIConfig
  /** Deep-link target: #/infrastructure/ship scrolls to that section. */
  section?: string
}) {
  useEffect(() => {
    if (!section) return
    document.getElementById(section)?.scrollIntoView({ block: 'start' })
  }, [section])

  return (
    <>
      <header className="page-header">
        <h1>Deployed by Nuon</h1>
        <p className="lede">
          Relay was deployed into this cluster by Nuon when you installed. This
          page is the map: what runs it, how changes ship, how it&rsquo;s
          operated.
        </p>
        {(config.install_id || config.cluster_name || config.region) && (
          <div className="row" style={{ marginTop: 12 }}>
            {config.install_id && (
              <span className="chip">install {config.install_id}</span>
            )}
            {config.cluster_name && (
              <span className="chip">cluster {config.cluster_name}</span>
            )}
            {config.region && <span className="chip">{config.region}</span>}
          </div>
        )}
      </header>

      <Workloads config={config} />
      <Components config={config} />
      <Ship config={config} />
      <Operate config={config} />

      {config.links.install && (
        <div className="row" style={{ marginTop: 32 }}>
          <OutLink href={config.links.install}>Open this install in Nuon</OutLink>
          <OutLink href="https://docs.nuon.co" variant="plain">
            docs.nuon.co
          </OutLink>
        </div>
      )}
    </>
  )
}
