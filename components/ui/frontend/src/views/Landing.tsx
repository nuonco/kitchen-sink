import { useState, type ReactNode } from 'react'
import {
  countReady,
  hasTicTacToe,
  useIntrospect,
  type KubeResponse,
  type NamespaceResponse,
  type UIConfig,
} from '../lib/api'
import { useNavigate } from '../lib/router'
import { Eyebrow, Icon, OutLink } from '../ui/Primitives'

function Fact({
  label,
  value,
  note,
  numeric = false,
}: {
  label: string
  value: ReactNode
  note?: string
  numeric?: boolean
}) {
  const pending = value === null || value === undefined || value === ''
  return (
    <div className={pending ? 'fact fact--pending' : 'fact'}>
      <div className="fact__label">{label}</div>
      <div className={numeric ? 'fact__value fact__value--num' : 'fact__value'}>
        {pending ? '—' : value}
      </div>
      {note && <div className="fact__note">{note}</div>}
    </div>
  )
}

const paths = [
  {
    to: '/deployed',
    icon: 'magnifying-glass',
    question: 'What did Nuon actually deploy?',
    body:
      'Read the live cluster: namespaces, pods, services, Helm releases, and the environment this app can see. Readable summaries first, the raw JSON one click behind each one.',
    cta: 'Read the install',
  },
  {
    to: '/map',
    icon: 'puzzle-piece',
    question: 'How does my product map onto this?',
    body:
      'The component types you can build an app config from, each shown with the real thing this app uses it for — a Helm chart, a Docker build, a prebuilt image, Terraform, Pulumi, raw manifests.',
    cta: 'See the component types',
  },
  {
    to: '/day2',
    icon: 'gauge',
    question: 'How do I operate 50 of these?',
    body:
      'The day-2 story: app branches, runbooks, triggers, and component health — what each one is for, grounded in this install, with a link into the dashboard.',
    cta: 'See the day-2 tools',
  },
]

type PartKey = 'sandbox' | 'components' | 'runner'

export function Landing({ config }: { config: UIConfig }) {
  const navigate = useNavigate()
  const [openPart, setOpenPart] = useState<PartKey | null>(null)
  const togglePart = (key: PartKey) =>
    setOpenPart((current) => (current === key ? null : key))
  const namespace = config.namespace ?? 'kitchen-sink'
  const kube = useIntrospect<KubeResponse>('/api/introspect/kube')
  const ns = useIntrospect<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
  )

  const namespaceCount =
    kube.state === 'ok' ? kube.value.response.namespaces?.length : undefined
  const pods = ns.state === 'ok' ? (ns.value.response.pods ?? []) : []
  const podSummary =
    ns.state === 'ok' ? `${countReady(pods)} / ${pods.length}` : undefined
  const tictactoe =
    ns.state === 'ok' && hasTicTacToe(ns.value.response.services ?? [])

  return (
    <>
      <header className="hero">
        <Eyebrow>Kitchen sink &middot; live install</Eyebrow>
        <h1>You&rsquo;re inside a BYOC install.</h1>
        <p className="hero__lede">
          This page is served by a container running in an EKS cluster, in an AWS
          account, that Nuon provisioned and deploys into. Nothing here is a
          mock: the facts below are read live from that cluster through the app&rsquo;s
          own introspection API.
        </p>
      </header>

      <div className="facts">
        <Fact
          label="Install"
          value={config.install_id}
          note="The tenant this app belongs to"
        />
        <Fact
          label="Cluster"
          value={config.cluster_name}
          note={config.region ? `EKS in ${config.region}` : 'EKS'}
        />
        <Fact
          label="Namespaces"
          value={namespaceCount}
          note="Read from the Kubernetes API"
          numeric
        />
        <Fact
          label={`Pods ready in ${namespace}`}
          value={podSummary}
          note="api, ui, worker"
          numeric
        />
      </div>

      <section className="golden">
        <Eyebrow>The golden path</Eyebrow>
        <h2 className="golden__title">A shippable Nuon app is three parts.</h2>
        <div className="arch">
          <div
            className={
              openPart === 'sandbox'
                ? 'arch__sandbox arch__sandbox--active'
                : 'arch__sandbox'
            }
          >
            <button
              type="button"
              className="arch__boundary"
              aria-expanded={openPart === 'sandbox'}
              aria-controls="golden-detail"
              onClick={() => togglePart('sandbox')}
            >
              <span className="arch__num">01</span>
              <span className="arch__name">Sandbox</span>
              <span className="arch__hint">VPC · EKS · DNS</span>
            </button>
            <div className="arch__nodes">
              <button
                type="button"
                className={
                  openPart === 'components'
                    ? 'arch__node arch__node--active'
                    : 'arch__node'
                }
                aria-expanded={openPart === 'components'}
                aria-controls="golden-detail"
                onClick={() => togglePart('components')}
              >
                <span className="arch__num">02</span>
                <span className="arch__name">Components</span>
                <span className="arch__hint">kitchen_sink chart</span>
              </button>
              <div className="arch__edge" aria-hidden="true">
                <span className="arch__edge-label">deploys</span>
                <span className="arch__edge-line" />
              </div>
              <button
                type="button"
                className={
                  openPart === 'runner'
                    ? 'arch__node arch__node--active'
                    : 'arch__node'
                }
                aria-expanded={openPart === 'runner'}
                aria-controls="golden-detail"
                onClick={() => togglePart('runner')}
              >
                <span className="arch__num">03</span>
                <span className="arch__name">Runner</span>
                <span className="arch__hint">builds &amp; deploys here</span>
              </button>
            </div>
          </div>

          {openPart && (
            <div id="golden-detail" className="arch__panel" role="region">
              {openPart === 'sandbox' && (
                <>
                  <div className="arch__panel-label">01 · Sandbox</div>
                  <p className="arch__panel-body">
                    The footprint Nuon creates in your customer&rsquo;s cloud
                    account — it&rsquo;s the boundary everything else lives
                    inside. Here it&rsquo;s{' '}
                    <span className="mono">aws-eks-sandbox</span>: a VPC, an EKS
                    cluster, and a public DNS zone.
                  </p>
                  {config.cluster_name && (
                    <div className="row" style={{ marginTop: 12 }}>
                      <span className="chip">cluster {config.cluster_name}</span>
                      {config.region && (
                        <span className="chip">{config.region}</span>
                      )}
                    </div>
                  )}
                </>
              )}
              {openPart === 'components' && (
                <>
                  <div className="arch__panel-label">02 · Components</div>
                  <p className="arch__panel-body">
                    One deployable piece of your product. Here the{' '}
                    <span className="mono">kitchen_sink</span> Helm chart deploys
                    the API, the worker, and the UI you&rsquo;re reading.
                  </p>
                  {podSummary && (
                    <div className="row" style={{ marginTop: 12 }}>
                      <span className="chip">
                        {podSummary} pods ready in {namespace}
                      </span>
                    </div>
                  )}
                </>
              )}
              {openPart === 'runner' && (
                <>
                  <div className="arch__panel-label">03 · Runner</div>
                  <p className="arch__panel-body">
                    An agent Nuon runs inside the account. Every build and deploy
                    happens from in there, so your customer&rsquo;s credentials
                    never leave their cloud.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <p className="golden__aside">
          Everything else — inputs, policies, secrets, actions, break-glass
          roles, the other component types — is optional. Added when a customer
          asks, not before.
        </p>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Pick a question</h2>
          <div className="subtext muted">Three paths, each self-contained</div>
        </div>
        <div className="paths">
          {paths.map((path) => (
            <button
              key={path.to}
              className="path"
              onClick={() => navigate(path.to)}
            >
              <span className="path__icon">
                <Icon name={path.icon} />
              </span>
              <span className="path__q">{path.question}</span>
              <span className="path__body">{path.body}</span>
              <span className="path__cta">
                {path.cta} <Icon name="arrow-right" />
              </span>
            </button>
          ))}
          <button
            className={tictactoe ? 'path' : 'path path--locked'}
            onClick={() => navigate('/tictactoe')}
          >
            <span className="path__icon">
              <Icon name={tictactoe ? 'grid-four' : 'lock'} />
            </span>
            <span className="path__q">How do optional features ship?</span>
            <span className="path__body">
              A toggleable component: in the config for every install, deployed
              only where it&rsquo;s switched on. Here the feature is a game of
              tic-tac-toe, and this tile is read from the cluster like
              everything else.
            </span>
            {tictactoe ? (
              <span className="path__cta">
                Play tic-tac-toe <Icon name="arrow-right" />
              </span>
            ) : (
              <span className="path__lock">
                <Icon name="lock" /> Not included in this install. Enable the
                tictactoe component to unlock it.
              </span>
            )}
          </button>
        </div>
      </section>

      {config.links.install && (
        <section className="section">
          <div className="card">
            <div className="card__header">
              <div className="card__title">The other half of the tour</div>
            </div>
            <p className="small muted" style={{ maxWidth: '70ch' }}>
              This app shows you the install from the inside. The Nuon dashboard
              shows you the same install from the outside — its components,
              actions, runbooks and deploy history — and it&rsquo;s where you operate
              every other install too.
            </p>
            <div className="row" style={{ marginTop: 20 }}>
              <OutLink href={config.links.install}>
                Open this install in Nuon
              </OutLink>
              <OutLink
                href="https://docs.nuon.co/get-started/introduction"
                variant="secondary"
              >
                Read the docs
              </OutLink>
            </div>
          </div>
        </section>
      )}
    </>
  )
}
