import type { ReactNode } from 'react'
import {
  countReady,
  useIntrospect,
  type NamespaceResponse,
  type UIConfig,
} from '../lib/api'
import { useNavigate } from '../lib/router'
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

type FeatureKey = 'branches' | 'runbooks' | 'triggers' | 'health'

const features: Array<{
  key: FeatureKey
  icon: string
  title: string
  teaser: string
}> = [
  {
    key: 'branches',
    icon: 'git-branch',
    title: 'App branches',
    teaser: 'Stage a config change on one install before it reaches the rest.',
  },
  {
    key: 'runbooks',
    icon: 'book-open',
    title: 'Runbooks',
    teaser: 'The procedure, rendered next to the install it applies to.',
  },
  {
    key: 'triggers',
    icon: 'lightning',
    title: 'Triggers',
    teaser: 'When your scripts run: on a schedule, on a deploy, or on demand.',
  },
  {
    key: 'health',
    icon: 'heartbeat',
    title: 'Component health',
    teaser: 'The gate every deploy has to pass before Nuon calls it done.',
  },
]

function FeatureShell({
  title,
  children,
  link,
  linkLabel,
  simTo,
  simLabel,
}: {
  title: string
  children: ReactNode
  link?: string
  linkLabel: string
  simTo?: string
  simLabel?: string
}) {
  const navigate = useNavigate()
  return (
    <section className="section">
      <div className="section__head">
        <h2 className="section__title">{title}</h2>
      </div>
      {children}
      {(link || simTo) && (
        <div className="row" style={{ marginTop: 32 }}>
          {link && <OutLink href={link}>{linkLabel}</OutLink>}
          {simTo && simLabel && (
            <button
              className="btn btn--secondary"
              onClick={() => navigate(simTo)}
            >
              {simLabel} <Icon name="arrow-right" />
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function Branches({ config }: { config: UIConfig }) {
  return (
    <FeatureShell
      title="App branches"
      link={config.links.components}
      linkLabel="See what each component tracks"
      simTo="/customize/branches"
      simLabel="Walk the staged rollout"
    >
      <div className="prose">
        <p>
          Every component in this app points at a git branch. The Helm chart
          tracks <code>ms/onboarding-edit</code>; the load balancer and the
          certificate track <code>main</code>. Change a branch, sync the app, and
          the next deploy picks up the new config.
        </p>
        <p>
          App branches extend that to the whole app config at once. You branch
          the config, point selected installs at the branch, and leave everyone
          else on main, so a chart change can be proven against one friendly
          customer before it becomes the default for all of them. The unit of
          risk shrinks to a single install.
        </p>
      </div>
      <CodeBlock
        label="components/chart/nuon.toml"
        code={`[public_repo]
repo = "nuonco/kitchen-sink"
directory = "components/chart"
# Chart edits for the onboarding restyle live on this branch; flip back to
# "main" when ms/onboarding-edit merges.
branch = "ms/onboarding-edit"`}
      />
      <Callout label="Why it matters at 50 installs">
        Without branches, a config change is all-or-nothing across every
        customer. With them, the blast radius of a mistake is one install, and
        rolling back is a branch pointer rather than an incident.
      </Callout>
    </FeatureShell>
  )
}

function Runbooks({ config }: { config: UIConfig }) {
  return (
    <FeatureShell
      title="Runbooks"
      link={config.links.runbooks}
      linkLabel="Open the runbooks for this install"
      simTo="/customize/runbooks"
      simLabel="Simulate a runbook run"
    >
      <div className="prose">
        <p>
          A runbook is a markdown document Nuon renders in the dashboard for an
          install, next to the thing it describes. It is the same idea as the
          readme, aimed at a different moment: the readme is read once, when
          someone is deciding; a runbook is read at 2am, when something is
          broken.
        </p>
        <p>
          That is why the readme on this app is deliberately short and the depth
          lives here instead. Put the procedures a support engineer needs in
          runbooks: how to roll the API, what to check when a deploy hangs,
          which action to run before escalating. They arrive already scoped
          to the install in front of them.
        </p>
      </div>
      <CodeBlock
        label="metadata.toml"
        code={`display_name = "Kitchen Sink"
description  = "A comprehensive test app showcasing the full Nuon platform..."
readme       = "./control-plane.md"`}
      />
      <Callout label="In this app">
        <span className="mono">metadata.toml</span> points the install readme at{' '}
        <span className="mono">control-plane.md</span>. Runbooks sit alongside it
        in the dashboard, one per operational task, and are versioned in the same
        repo as the config they describe.
      </Callout>
    </FeatureShell>
  )
}

function Triggers({ config }: { config: UIConfig }) {
  return (
    <FeatureShell
      title="Triggers"
      link={config.links.actions}
      linkLabel="Open the actions for this install"
      simTo="/customize/actions"
      simLabel="Run an action, simulated"
    >
      <div className="prose">
        <p>
          An action is a script the runner executes inside the install. A trigger
          decides when. This app ships three actions between them covering every
          kind of trigger you get.
        </p>
        <ul>
          <li>
            <code>cron_status</code>: a <code>cron</code> trigger on{' '}
            <code>0 * * * *</code>, so it runs hourly, plus a{' '}
            <code>manual</code> trigger so you can also run it on demand. It
            carries the label <code>is_health_check = &quot;true&quot;</code>.
          </li>
          <li>
            <code>lifecycle_hooks</code>: fires on <code>post-provision</code>,
            and again on <code>pre-deploy-component</code> and{' '}
            <code>post-deploy-component</code> for the{' '}
            <code>kitchen_sink</code> component. It brackets every chart deploy,
            which is where you put a migration or a cache warm.
          </li>
          <li>
            <code>debug</code>: <code>manual</code> only. The thing you run when
            an install misbehaves and you would rather not hand anyone a
            kubeconfig.
          </li>
        </ul>
      </div>
      <CodeBlock
        label="actions/lifecycle_hooks/nuon.toml"
        code={`name         = "lifecycle_hooks"
timeout      = "1m"
dependencies = ["kitchen_sink"]

[[triggers]]
type = "post-provision"

[[triggers]]
type           = "pre-deploy-component"
component_name = "kitchen_sink"

[[triggers]]
type           = "post-deploy-component"
component_name = "kitchen_sink"

[[steps]]
name            = "log-lifecycle-hook"
inline_contents = "./lifecycle_hooks/script.sh"

[steps.env_vars]
HOOK_VERSION = "v1"`}
      />
      <Callout label="Why it matters at 50 installs">
        Manual triggers are how support fixes an install without cluster
        credentials. The runner already has the access it needs; the action is
        the audited, repeatable path to using it. Nobody has to be handed a
        production kubeconfig to answer a ticket.
      </Callout>
    </FeatureShell>
  )
}

function Health({ config }: { config: UIConfig }) {
  const namespace = config.namespace ?? 'kitchen-sink'
  const ns = useIntrospect<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
  )
  const pods = ns.state === 'ok' ? (ns.value.response.pods ?? []) : []

  return (
    <FeatureShell
      title="Component health"
      link={config.links.components}
      linkLabel="See component health for this install"
    >
      <div className="prose">
        <p>
          Nuon deploys a component and then waits for it to become healthy before
          calling the deploy done. A component that never goes green blocks the
          install, which means health checks end up shaping your config as
          much as your dashboard. Two decisions in this app exist only because
          of that gate.
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
            The chart&rsquo;s ConfigMap carries a <code>nuon.co/roll</code> annotation
            set to the Helm release revision. It changes on every release, so a
            redeploy is never a no-op. A no-op plan would be skipped, quietly
            bypassing the health gate the deploy is supposed to pass.
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
        Health is the difference between &ldquo;deployed&rdquo; and &ldquo;working&rdquo;. When you
        operate installs you cannot log into, the deploy pipeline has to be the
        thing that notices. The failure mode you are trying to avoid is your
        customer noticing first.
      </Callout>
    </FeatureShell>
  )
}

export function DayTwo({
  config,
  feature,
}: {
  config: UIConfig
  feature?: string
}) {
  const navigate = useNavigate()
  const active = features.find((f) => f.key === feature)

  return (
    <>
      <BackLink to="/">Customize the Kitchen Sink</BackLink>
      <header className="page-header">
        <Eyebrow>Deep dive</Eyebrow>
        <h1>How do I operate 50 of these?</h1>
        <p className="lede">
          One install is a demo. Fifty is a business, and the difference is
          entirely day-two tooling. Four things carry most of that weight in
          Nuon. Pick one.
        </p>
      </header>

      <div className="tiles">
        {features.map((f) => (
          <button
            key={f.key}
            className={f.key === feature ? 'tile tile--active' : 'tile'}
            onClick={() => navigate(`/day2/${f.key}`)}
          >
            <span className="tile__head">
              <Icon name={f.icon} />
              {f.title}
            </span>
            <span className="tile__body">{f.teaser}</span>
          </button>
        ))}
      </div>

      {!active && (
        <div className="callout" style={{ marginTop: 32 }}>
          Each of these is explained against this install specifically: the real
          branch this app tracks, the real triggers it ships, the real reason its
          API has no ingress. Each one links to the matching page in the
          Nuon dashboard.
        </div>
      )}

      {active?.key === 'branches' && <Branches config={config} />}
      {active?.key === 'runbooks' && <Runbooks config={config} />}
      {active?.key === 'triggers' && <Triggers config={config} />}
      {active?.key === 'health' && <Health config={config} />}
    </>
  )
}
