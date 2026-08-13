import {
  countReady,
  useIntrospect,
  type EnvResponse,
  type HelmResponse,
  type KubeResponse,
  type NamespaceResponse,
  type SecretSummary,
  type UIConfig,
} from '../lib/api'
import {
  BackLink,
  Badge,
  Callout,
  Eyebrow,
  EmptyState,
  LoadState,
  OutLink,
  PhaseBadge,
  RawJSON,
  Section,
} from '../ui/Primitives'

/** Namespaces this app config is responsible for, so the table can mark them. */
function namespaceNote(name: string, installID?: string): string | null {
  if (name === 'kitchen-sink') return 'This app'
  if (installID && name === `${installID}-dne`) return 'The kustomize component'
  if (name === 'nuon') return 'The Nuon runner'
  if (name.startsWith('kube-') || name === 'default') return null
  return null
}

function Namespaces({ config }: { config: UIConfig }) {
  const kube = useIntrospect<KubeResponse>('/api/introspect/kube')

  return (
    <Section
      title="Cluster and namespaces"
      aside="GET /introspect/kube"
    >
      <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
        The API pod asks the Kubernetes API what else is in the cluster. Some of
        these namespaces are the sandbox&rsquo;s (the EKS add-ons, the Nuon runner);
        the rest are this app&rsquo;s components.
      </p>

      <LoadState result={kube} what="the cluster" />

      {kube.state === 'ok' && (
        <>
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
                {(kube.value.response.namespaces ?? []).map((ns) => {
                  const note = namespaceNote(ns.name, config.install_id)
                  return (
                    <tr key={ns.name}>
                      <td className="mono">{ns.name}</td>
                      <td>
                        <PhaseBadge phase={ns.status?.phase} />
                      </td>
                      <td>{note ?? <span className="muted">Sandbox</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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

function ThisNamespace({ config }: { config: UIConfig }) {
  const namespace = config.namespace ?? 'kitchen-sink'
  const ns = useIntrospect<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
  )

  const data = ns.state === 'ok' ? redactSecrets(ns.value.response) : null

  return (
    <Section
      title={`Inside the ${namespace} namespace`}
      aside={`GET /introspect/namespace/${namespace}`}
    >
      <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
        Everything the <span className="mono">kitchen_sink</span> Helm component
        created. Three deployments, three services, and the Kubernetes secrets
        Nuon syncs into the namespace.
      </p>

      <LoadState result={ns} what={`the ${namespace} namespace`} />

      {ns.state === 'ok' && data && (
        <div className="stack stack--lg">
          <div>
            <div className="row" style={{ marginBottom: 12 }}>
              <Badge tone="accent">
                {countReady(data.pods ?? [])} of {data.pods_count} pods ready
              </Badge>
            </div>
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
                  {(data.pods ?? []).map((pod, i) => {
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
          </div>

          <div>
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
                  {(data.services ?? []).map((svc, i) => (
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
          </div>

          <div>
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
                  {(data.secrets ?? []).map((secret, i) => (
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
            <Callout label="Where the secret values went">
              This endpoint returns whole Kubernetes Secret objects, values
              included, and the introspection API has no authentication — while
              this page is published on the install&rsquo;s internet-facing load
              balancer. So the server behind this UI strips every secret value
              out of the response before it reaches your browser, and forwards
              only the four introspection endpoints these views read.{' '}
              <span className="mono">/introspect/helm-values</span> and{' '}
              <span className="mono">/introspect/secrets</span> are not among
              them. Filtering in the browser instead would protect nobody: you
              could just call the endpoint yourself.
            </Callout>
          </div>

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
  const hasThisApp = releases.some(([, rel]) => rel.name === 'kitchen-sink')

  return (
    <Section title="Helm releases" aside="GET /introspect/helm">
      <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
        Nuon deploys the <span className="mono">kitchen_sink</span> component by
        running Helm from the runner, so Helm&rsquo;s own release history is the record
        of what was deployed and when.
      </p>

      <LoadState result={helm} what="Helm releases" />

      {helm.state === 'ok' && (
        <>
          {releases.length === 0 ? (
            <EmptyState>No Helm releases were returned.</EmptyState>
          ) : (
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
          )}

          {!hasThisApp && (
            <Callout label="Why this app is missing from the list">
              This app&rsquo;s own release is stored with Helm&rsquo;s{' '}
              <code>configmap</code> driver —{' '}
              <span className="mono">components/chart/nuon.toml</span> sets{' '}
              <span className="mono">storage_driver = &quot;configmap&quot;</span>, and{' '}
              <span className="mono">runner.toml</span> sets{' '}
              <span className="mono">helm_driver = &quot;configmap&quot;</span>. The
              introspection API reads the <code>secret</code> driver, so it lists
              the sandbox&rsquo;s releases and not this one. Storage driver is an
              install-wide decision worth making once.
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
    <Section title="What the pod actually sees" aside="GET /introspect/env">
      <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
        The API pod&rsquo;s own environment. This is the honest answer to &ldquo;what does
        Nuon inject into my container?&rdquo; — and the answer is: exactly what your
        chart passes it, and nothing else. Any value whose name looks like a
        credential is replaced before the response leaves the cluster.
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
                Nuon interpolates install values —{' '}
                <span className="mono">{'{{.nuon.install.id}}'}</span>,{' '}
                <span className="mono">
                  {'{{.nuon.install.sandbox.outputs...}}'}
                </span>{' '}
                — into your Helm values file at deploy time. Getting them into a
                container is still your chart&rsquo;s job. This app&rsquo;s API deployment
                forwards none of them, so its environment has none. The UI you&rsquo;re
                reading does forward them, which is how this page knows which
                install it belongs to.
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

export function Deployed({ config }: { config: UIConfig }) {
  return (
    <>
      <BackLink to="/">All paths</BackLink>
      <header className="page-header">
        <Eyebrow>Path 01</Eyebrow>
        <h1>What did Nuon actually deploy?</h1>
        <p className="lede">
          Four live reads against this install. Each one is a summary of what the
          introspection API returned, with the untouched response one click
          behind it.
        </p>
      </header>

      <Namespaces config={config} />
      <ThisNamespace config={config} />
      <HelmReleases config={config} />
      <PodEnvironment />
    </>
  )
}
