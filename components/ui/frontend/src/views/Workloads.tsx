import { useEffect } from 'react'
import {
  countReady,
  useIntrospect,
  type Envelope,
  type EnvResponse,
  type HelmResponse,
  type KubeResponse,
  type Loadable,
  type NamespaceResponse,
  type SecretSummary,
  type UIConfig,
} from '../lib/api'
import { useMarkStepSeen } from '../lib/progress'
import { useNavigate } from '../lib/router'
import {
  Callout,
  Disclosure,
  EmptyState,
  LoadState,
  OutLink,
  PageHeader,
  PhaseBadge,
  RawJSON,
  Section,
} from '../ui/Primitives'

/**
 * Who put a namespace there. `app: true` marks the rows this app config is
 * responsible for; the rest is cluster plumbing, grouped out of the way.
 * A row with no name is a malformed response; a public demo page must
 * degrade to a muted cell, never a crash.
 */
export function namespaceOwner(
  name: string | undefined,
  installID: string | undefined,
): { label: string; app: boolean } {
  if (!name) return { label: '', app: false }
  if (name === 'periscope') return { label: 'The console', app: true }
  if (installID && name === `${installID}-observed`)
    return { label: 'The observed workload', app: true }
  if (name === 'nuon') return { label: 'The Nuon runner', app: true }
  if (name.startsWith('kube-') || name === 'default')
    return { label: 'Kubernetes', app: false }
  return { label: 'The sandbox', app: false }
}

type KubeResult = Loadable<Envelope<KubeResponse>>
type NsResult = Loadable<Envelope<NamespaceResponse>>

function NamespaceTable({
  rows,
  installID,
}: {
  rows: KubeResponse['namespaces']
  installID?: string
}) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Namespace</th>
            <th>Phase</th>
            <th>Owner</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const owner = namespaceOwner(row.name, installID)
            return (
              <tr key={row.name ?? i}>
                <td className="mono">{row.name}</td>
                <td>
                  <PhaseBadge phase={row.status?.phase} />
                </td>
                <td>
                  {owner.app ? owner.label : <span className="muted">{owner.label}</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Namespaces({ kube, config }: { kube: KubeResult; config: UIConfig }) {
  const rows = kube.state === 'ok' ? (kube.value.response.namespaces ?? []) : []
  const mine = rows.filter((row) => namespaceOwner(row.name, config.install_id).app)
  const infra = rows.filter((row) => !namespaceOwner(row.name, config.install_id).app)
  const preview = infra
    .slice(0, 3)
    .map((row) => row.name)
    .join(', ')

  return (
    <Section
      id="cluster"
      title="Cluster and namespaces"
      aside="GET /introspect/kube"
    >
      <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
        The API pod asks the Kubernetes API what else is in the cluster. These
        namespaces are this install&rsquo;s:
      </p>

      <LoadState result={kube} what="the cluster" />

      {kube.state === 'ok' && (
        <>
          <NamespaceTable rows={mine} installID={config.install_id} />
          {config.install_id && (
            <p className="small muted" style={{ marginTop: 12, maxWidth: '72ch' }}>
              <span className="mono">{config.install_id}-observed</span> is the
              sample workload Periscope observes. A generator there starts a
              real job every five minutes, so the console always has live
              activity to show.
            </p>
          )}
          {infra.length > 0 && (
            <Disclosure
              summary={`Show the ${infra.length} infrastructure namespaces (${preview}${
                infra.length > 3 ? ', …' : ''
              })`}
            >
              <NamespaceTable rows={infra} installID={config.install_id} />
            </Disclosure>
          )}
          <RawJSON value={kube.value} />
        </>
      )}
    </Section>
  )
}

/**
 * Belt and braces. The server already strips these before the response leaves
 * the cluster (see apifilter.go, which is the boundary that actually matters);
 * this covers a dev pointing the frontend straight at an unfiltered API.
 */
function redactSecrets(response: NamespaceResponse): NamespaceResponse {
  return {
    ...response,
    secrets: (response.secrets ?? []).map((secret) => ({
      ...secret,
      data: Object.fromEntries(
        Object.keys(secret.data ?? {}).map((key) => [key, '<redacted by the UI>']),
      ),
    })),
  }
}

function secretNote(secret: SecretSummary): string | null {
  const name = secret.metadata?.name
  if (name === 'db-password') return 'Synced from the Nuon secret db_password (auto-generated)'
  if (name === 'api-key') return 'Synced from the Nuon secret api_key'
  if (secret.type === 'helm.sh/release.v1') return 'Helm release history'
  return null
}

function ThisNamespace({
  ns,
  namespace,
  openPods,
}: {
  ns: NsResult
  namespace: string
  /** True when a deep link targeted this section: open the pods table. */
  openPods: boolean
}) {
  const data = ns.state === 'ok' ? redactSecrets(ns.value.response) : null
  const pods = data?.pods ?? []
  const services = data?.services ?? []
  const secrets = data?.secrets ?? []

  return (
    <Section
      id="namespace"
      title={`Inside the ${namespace} namespace`}
      aside={`GET /introspect/namespace/${namespace}`}
    >
      <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
        Everything the <span className="mono">periscope</span> Helm component
        created, including the Kubernetes secrets Nuon syncs into the
        namespace.
      </p>

      <LoadState result={ns} what={`the ${namespace} namespace`} />

      {ns.state === 'ok' && data && (
        <div className="stack">
          <Disclosure
            summary={`Show the ${pods.length} pods (${countReady(pods)} ready)`}
            defaultOpen={openPods}
          >
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Pod</th>
                    <th>Phase</th>
                    <th>Restarts</th>
                    <th>Image</th>
                  </tr>
                </thead>
                <tbody>
                  {pods.map((pod, i) => {
                    const statuses = pod.status?.containerStatuses ?? []
                    const restarts = statuses.reduce(
                      (sum, c) => sum + (c.restartCount ?? 0),
                      0,
                    )
                    const image =
                      statuses[0]?.image ?? pod.spec?.containers?.[0]?.image ?? ''
                    return (
                      <tr key={pod.metadata?.name ?? i}>
                        <td className="mono">{pod.metadata?.name}</td>
                        <td>
                          <PhaseBadge phase={pod.status?.phase} />
                        </td>
                        <td>{restarts}</td>
                        <td className="mono subtext">{image}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Disclosure>

          <Disclosure summary={`Show the ${services.length} services`}>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Type</th>
                    <th>Cluster IP</th>
                    <th>Ports</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((svc, i) => (
                    <tr key={svc.metadata?.name ?? i}>
                      <td className="mono">{svc.metadata?.name}</td>
                      <td>{svc.spec?.type}</td>
                      <td className="mono subtext">{svc.spec?.clusterIP}</td>
                      <td className="mono subtext">
                        {(svc.spec?.ports ?? [])
                          .map((p) => `${p.port}/${p.protocol ?? 'TCP'}`)
                          .join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Disclosure>

          <Disclosure
            summary={`Show the ${secrets.length} secrets (values redacted by the server)`}
          >
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Secret</th>
                    <th>Keys</th>
                    <th>Where it came from</th>
                  </tr>
                </thead>
                <tbody>
                  {secrets.map((secret, i) => (
                    <tr key={secret.metadata?.name ?? i}>
                      <td className="mono">{secret.metadata?.name}</td>
                      <td className="mono subtext">
                        {Object.keys(secret.data ?? {}).join(', ') || '—'}
                      </td>
                      <td>
                        {secretNote(secret) ?? (
                          <span className="muted">Created in the cluster</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Callout label="The redaction boundary">
              This endpoint returns whole Secret objects, values included, and
              this page sits on the install&rsquo;s internet-facing load
              balancer. Periscope&rsquo;s proxy is the boundary: it forwards
              only the endpoints these views read, strips every secret value
              before a response leaves the cluster, and fails closed &mdash; a
              response it cannot parse is never forwarded. Filtering in the
              browser instead would protect nobody: you could just call the
              endpoint yourself.
            </Callout>
          </Disclosure>

          <RawJSON
            value={{ ...ns.value, response: data }}
            label="Raw JSON response (as served, secret values redacted)"
          />
        </div>
      )}
    </Section>
  )
}

function HelmReleases({ config }: { config: UIConfig }) {
  const helm = useIntrospect<HelmResponse>('/api/introspect/helm')
  const releases =
    helm.state === 'ok' ? Object.entries(helm.value.response.Charts ?? {}) : []
  const hasThisApp = releases.some(([, rel]) => rel.name === 'periscope')

  return (
    <Section id="helm" title="Helm releases" aside="GET /introspect/helm">
      <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
        Nuon deploys the <span className="mono">periscope</span> component by
        running Helm from the runner, so Helm&rsquo;s own release history is the record
        of what was deployed and when.
      </p>

      <LoadState result={helm} what="Helm releases" />

      {helm.state === 'ok' && (
        <>
          {releases.length === 0 ? (
            <EmptyState>No Helm releases were returned.</EmptyState>
          ) : (
            <Disclosure
              summary={`Show the ${releases.length} releases stored with the secret driver`}
            >
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Release</th>
                      <th>Namespace</th>
                      <th>Chart</th>
                      <th>Rev</th>
                      <th>Status</th>
                      <th>Last deployed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {releases.map(([key, rel]) => (
                      <tr key={key}>
                        <td className="mono">{rel.name}</td>
                        <td className="mono subtext">{rel.namespace}</td>
                        <td className="mono subtext">
                          {rel.chart_metadata?.name}
                          {rel.chart_metadata?.version
                            ? ` ${rel.chart_metadata.version}`
                            : ''}
                        </td>
                        <td>{rel.version}</td>
                        <td>
                          <PhaseBadge phase={rel.info?.status} />
                        </td>
                        <td className="subtext muted">
                          {rel.info?.last_deployed?.slice(0, 19).replace('T', ' ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Disclosure>
          )}

          {!hasThisApp && (
            <Callout label="Why the console is missing from the list">
              Periscope&rsquo;s release is stored with Helm&rsquo;s{' '}
              <code>configmap</code> driver (
              <span className="mono">components/chart/nuon.toml</span> sets{' '}
              <span className="mono">storage_driver = &quot;configmap&quot;</span>;{' '}
              <span className="mono">runner.toml</span> matches). The
              introspection API reads the <code>secret</code> driver, so it lists
              the sandbox&rsquo;s releases and not this one.
            </Callout>
          )}

          <RawJSON value={helm.value} />
          {config.links.components && (
            <div className="row" style={{ marginTop: 20 }}>
              <OutLink href={config.links.components} variant="secondary">
                See these components in Nuon
              </OutLink>
            </div>
          )}
        </>
      )}
    </Section>
  )
}

const kubeInjected = (key: string) =>
  key.startsWith('KUBERNETES_') || /_SERVICE_(HOST|PORT)/.test(key) || /_PORT(_|$)/.test(key)

function PodEnvironment() {
  const env = useIntrospect<EnvResponse>('/api/introspect/env')
  const all = env.state === 'ok' ? env.value.response : {}
  const keys = Object.keys(all).sort()
  const nuonKeys = keys.filter((k) => k.startsWith('NUON'))
  const ownKeys = keys.filter((k) => !k.startsWith('NUON') && !kubeInjected(k))
  const discovered = keys.filter(kubeInjected)

  return (
    <Section id="env" title="What the pod actually sees" aside="GET /introspect/env">
      <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
        The API pod&rsquo;s own environment: exactly what your chart passes it,
        and nothing else. Any value whose name looks like a credential is
        replaced before the response leaves the cluster.
      </p>

      <LoadState result={env} what="the pod environment" />

      {env.state === 'ok' && (
        <div className="stack stack--lg">
          <div>
            <h3 style={{ marginBottom: 12 }}>Set by the chart</h3>
            {ownKeys.length === 0 ? (
              <EmptyState>Nothing.</EmptyState>
            ) : (
              <dl className="kv">
                {ownKeys.map((k) => (
                  <div key={k} style={{ display: 'contents' }}>
                    <dt>{k}</dt>
                    <dd>{all[k]}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <div>
            <h3 style={{ marginBottom: 12 }}>Nuon values forwarded into the pod</h3>
            {nuonKeys.length === 0 ? (
              <Callout label="Empty, and that is the lesson">
                Nuon interpolates install values, like{' '}
                <span className="mono">{'{{.nuon.install.id}}'}</span> and{' '}
                <span className="mono">
                  {'{{.nuon.install.sandbox.outputs...}}'}
                </span>
                , into your Helm values file at deploy time. Getting them into a
                container is still your chart&rsquo;s job. Periscope&rsquo;s API
                deployment forwards none of them, so its environment has none.
                The web UI you&rsquo;re reading does forward them, which is how
                this page knows which install it belongs to.
              </Callout>
            ) : (
              <dl className="kv">
                {nuonKeys.map((k) => (
                  <div key={k} style={{ display: 'contents' }}>
                    <dt>{k}</dt>
                    <dd>{all[k]}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <div>
            <h3 style={{ marginBottom: 4 }}>
              Injected by Kubernetes{' '}
              <span className="muted small">({discovered.length} vars)</span>
            </h3>
            <p className="small muted">
              Service discovery variables, added by the kubelet, not by Nuon.
            </p>
            <RawJSON
              value={Object.fromEntries(discovered.map((k) => [k, all[k]]))}
              label="Show the injected variables"
            />
          </div>

          <RawJSON value={env.value} label="Raw JSON response (full environment)" />
        </div>
      )}
    </Section>
  )
}

const sections = [
  { id: 'cluster', label: 'Namespaces' },
  { id: 'namespace', label: 'This namespace' },
  { id: 'helm', label: 'Helm' },
  { id: 'env', label: 'Environment' },
]

function SectionNav({ section }: { section?: string }) {
  const navigate = useNavigate()
  return (
    <nav className="subnav" aria-label="Workloads sections">
      {sections.map((sec) => (
        <a
          key={sec.id}
          className={
            section === sec.id ? 'subnav__link subnav__link--active' : 'subnav__link'
          }
          href={`#/workloads/${sec.id}`}
          onClick={(e) => {
            e.preventDefault()
            navigate(`/workloads/${sec.id}`)
          }}
        >
          {sec.label}
        </a>
      ))}
    </nav>
  )
}

export function Workloads({
  config,
  section,
}: {
  config: UIConfig
  /** Optional deep-link target: #/workloads/cluster scrolls to that section. */
  section?: string
}) {
  const namespace = config.namespace ?? 'periscope'
  const kube = useIntrospect<KubeResponse>('/api/introspect/kube')
  const ns = useIntrospect<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
  )

  useEffect(() => {
    if (!section) return
    document.getElementById(section)?.scrollIntoView({ block: 'start' })
  }, [section])

  useMarkStepSeen('/deployed')

  return (
    <>
      <PageHeader
        title="Workloads"
        lede="Live reads from the cluster this console runs in."
      />

      <SectionNav section={section} />

      <Namespaces kube={kube} config={config} />
      <ThisNamespace ns={ns} namespace={namespace} openPods={section === 'namespace'} />
      <HelmReleases config={config} />
      <PodEnvironment />
    </>
  )
}
