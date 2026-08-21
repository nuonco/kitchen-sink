import { useEffect, useRef, useState } from 'react'
import {
  countReady,
  useIntrospect,
  useIntrospectPoll,
  type Envelope,
  type EnvResponse,
  type HelmResponse,
  type KubeResponse,
  type Loadable,
  type NamespaceEvent,
  type NamespaceEventsResponse,
  type NamespaceResponse,
  type SecretSummary,
  type UIConfig,
} from '../lib/api'
import { stepEyebrow } from '../lib/taxonomy'
import { useMarkStepSeen } from '../lib/progress'
import { StepNav } from '../ui/CapabilityGrid'
import {
  BackLink,
  Callout,
  Disclosure,
  Eyebrow,
  EmptyState,
  LoadState,
  OutLink,
  PhaseBadge,
  RawJSON,
  Section,
} from '../ui/Primitives'

/* ============================================================
   Under the hood: what Nuon actually put in the account to make the product
   pages upstairs true. Live reads through the same fail-closed proxy the
   sync endpoints use; nothing here is required to use Conduit, all of it is
   available when you want to check its work.
   ============================================================ */

/**
 * Who put a namespace there. `app: true` marks the rows this app config is
 * responsible for; the rest is cluster plumbing, grouped out of the way.
 * A row with no name is a malformed response; a public demo page must
 * degrade to a muted cell, never a crash.
 */
function namespaceOwner(name: string | undefined): { label: string; app: boolean } {
  if (!name) return { label: '', app: false }
  if (name === 'conduit') return { label: 'This app', app: true }
  if (name === 'nuon') return { label: 'The Nuon runner', app: true }
  if (name.startsWith('kube-') || name === 'default')
    return { label: 'Kubernetes', app: false }
  return { label: 'The sandbox', app: false }
}

type KubeResult = Loadable<Envelope<KubeResponse>>
type NsResult = Loadable<Envelope<NamespaceResponse>>

/* ============================================================
   The page's summary: the few facts an evaluator checks first, live from the
   same two introspection reads the sections below break down.
   ============================================================ */

function GlanceFact({
  label,
  value,
  note,
  numeric = false,
}: {
  label: string
  value?: string
  note?: string
  numeric?: boolean
}) {
  return (
    <div className={value ? 'fact' : 'fact fact--pending'}>
      <div className="fact__label">{label}</div>
      <div className={numeric ? 'fact__value fact__value--num' : 'fact__value'}>
        {value ?? '…'}
      </div>
      {note && <div className="fact__note">{note}</div>}
    </div>
  )
}

/** "api :8080 · ui :3000 · postgres :5432", trimmed for a tile note. */
function servingNote(data: NamespaceResponse): string {
  return (data.services ?? [])
    .map((svc) => {
      const name = svc.metadata?.name?.replace(/^conduit-/, '') ?? '?'
      const port = svc.spec?.ports?.[0]?.port
      return port ? `${name} :${port}` : name
    })
    .join(' · ')
}

function Glance({
  kube,
  ns,
  namespace,
}: {
  kube: KubeResult
  ns: NsResult
  namespace: string
}) {
  const nsData = ns.state === 'ok' ? ns.value.response : undefined
  const pods = nsData?.pods ?? []
  const kubeRows = kube.state === 'ok' ? (kube.value.response.namespaces ?? []) : undefined
  const appRows = kubeRows?.filter((row) => namespaceOwner(row.name).app)
  const thisNs = kubeRows?.find((row) => row.name === namespace)

  return (
    <div className="facts" style={{ marginTop: 0 }}>
      <GlanceFact
        label="Pods ready"
        value={nsData ? `${countReady(pods)} of ${pods.length}` : undefined}
        note={`in ${namespace}`}
        numeric
      />
      <GlanceFact
        label="Serving"
        value={nsData ? `${(nsData.services ?? []).length} services` : undefined}
        note={nsData ? servingNote(nsData) : undefined}
        numeric
      />
      <GlanceFact
        label="This app's namespace"
        value={kubeRows ? namespace : undefined}
        note={thisNs?.status?.phase ?? undefined}
      />
      <GlanceFact
        label="Namespaces in the cluster"
        value={kubeRows ? String(kubeRows.length) : undefined}
        note={
          kubeRows && appRows
            ? `${appRows.length} from this install · ${kubeRows.length - appRows.length} infrastructure`
            : undefined
        }
        numeric
      />
    </div>
  )
}

function NamespaceTable({ rows }: { rows: KubeResponse['namespaces'] }) {
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
            const owner = namespaceOwner(row.name)
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
  const mine = rows.filter((row) => namespaceOwner(row.name).app)
  const infra = rows.filter((row) => !namespaceOwner(row.name).app)
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
          <NamespaceTable rows={mine} />
          {infra.length > 0 && (
            <Disclosure
              summary={`Show the ${infra.length} infrastructure namespaces (${preview}${
                infra.length > 3 ? ', …' : ''
              })`}
            >
              <NamespaceTable rows={infra} />
            </Disclosure>
          )}
          <RawJSON value={kube.value} />
          {config.links.install && (
            <div className="row" style={{ marginTop: 20 }}>
              <OutLink href={config.links.install} variant="secondary">
                Open this install in Nuon
              </OutLink>
            </div>
          )}
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
  if (name === 'db-password')
    return 'Synced from the Nuon secret db_password — Postgres, the engine, and the API all consume it'
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
        Everything the <span className="mono">conduit</span> Helm component
        created &mdash; the sync engine, the source Postgres, the API, this UI
        &mdash; including the Kubernetes secrets Nuon syncs into the
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
            <Callout label="Where the secret values went">
              This endpoint returns whole Secret objects, values included, and
              this page sits on the install&rsquo;s internet-facing load
              balancer. So the server strips every secret value before the
              response leaves the cluster, and proxies only the introspection
              and sync endpoints these views read. Filtering in the browser
              instead would protect nobody: you could just call the endpoint
              yourself.
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
  const hasThisApp = releases.some(([, rel]) => rel.name === 'conduit')

  return (
    <Section id="helm" title="Helm releases" aside="GET /introspect/helm">
      <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
        Nuon deploys the <span className="mono">conduit</span> component by
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
            <Callout label="Why this app is missing from the list">
              This app&rsquo;s release is stored with Helm&rsquo;s{' '}
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
              <>
                <dl className="kv">
                  {ownKeys.map((k) => (
                    <div key={k} style={{ display: 'contents' }}>
                      <dt>{k}</dt>
                      <dd>{all[k]}</dd>
                    </div>
                  ))}
                </dl>
                <p className="small muted" style={{ marginTop: 12, maxWidth: '72ch' }}>
                  <span className="mono">S3_BUCKET</span> is worth a look: its
                  value is another component&rsquo;s output (
                  <span className="mono">
                    {'{{.nuon.components.destination_bucket.outputs.bucket_name}}'}
                  </span>
                  ), interpolated into the chart&rsquo;s values at deploy time.{' '}
                  <span className="mono">PGPASSWORD</span> arrives as a
                  secretKeyRef, never a literal &mdash; and shows up here
                  redacted.
                </p>
              </>
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
                container is still your chart&rsquo;s job. This app&rsquo;s API deployment
                forwards none of them under their NUON names, so this list is
                empty. The UI you&rsquo;re reading does forward them, which is
                how this page knows which install it belongs to.
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

/* ============================================================
   The live events feed, absorbed from the old audit-log page: the
   namespace's own Kubernetes events, re-read every few seconds. Rows that
   were not in the previous poll flash once — a real operation landing, not
   a replay.
   ============================================================ */

/** How often the events section re-reads the namespace's events. */
const EVENTS_POLL_MS = 5_000

function relativeTime(iso: string | null | undefined, now: number): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/**
 * Stable identities for the rows, so a poll can be diffed against the last
 * one. Kubernetes dedupes events server-side; the suffix covers the rare
 * identical pair anyway.
 */
function eventKeys(events: NamespaceEvent[]): string[] {
  const used = new Map<string, number>()
  return events.map((ev) => {
    const base = [
      ev.involvedObject?.kind,
      ev.involvedObject?.name,
      ev.reason,
      ev.message,
      ev.lastTimestamp,
      ev.count,
    ].join('|')
    const n = used.get(base) ?? 0
    used.set(base, n + 1)
    return n === 0 ? base : `${base}#${n}`
  })
}

function EventsFeed({ namespace, config }: { namespace: string; config: UIConfig }) {
  const events = useIntrospectPoll<NamespaceEventsResponse>(
    `/api/introspect/namespace/${namespace}/events`,
    EVENTS_POLL_MS,
    true,
  )
  // Keys seen by the previous poll; null until the first one lands, so the
  // initial render never flashes.
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (events.state !== 'ok') return
    const keys = eventKeys(events.value.response.events ?? [])
    if (seen.current !== null) {
      const arrived = keys.filter((k) => !seen.current?.has(k))
      if (arrived.length > 0) setFresh(new Set(arrived))
    }
    seen.current = new Set(keys)
  }, [events])

  if (events.state !== 'ok') {
    return <LoadState result={events} what={`events in ${namespace}`} />
  }

  const list = events.value.response.events ?? []
  const keys = eventKeys(list)
  const now = Date.now()

  return (
    <div className="evtfeed" style={{ marginTop: 16 }}>
      <div className="evtfeed__head">
        <span className="evtfeed__dot" aria-hidden="true" />
        <span>Kubernetes events in {namespace}, newest first</span>
        <span className="evtfeed__meta mono">
          re-read every {EVENTS_POLL_MS / 1000}s
        </span>
      </div>
      {list.length === 0 ? (
        <p className="evtfeed__empty">
          Nothing yet — Kubernetes expires events after about an hour of quiet.
        </p>
      ) : (
        <ol className="evtfeed__list">
          {list.map((ev, i) => {
            const key = keys[i]
            const cls = [
              'evt',
              ev.type === 'Warning' ? 'evt--warning' : '',
              fresh.has(key) ? 'evt--new' : '',
            ]
              .filter(Boolean)
              .join(' ')
            const obj = [ev.involvedObject?.kind, ev.involvedObject?.name]
              .filter(Boolean)
              .join('/')
            return (
              <li key={key} className={cls}>
                <span className="evt__time mono">
                  {relativeTime(ev.lastTimestamp ?? ev.firstTimestamp, now)}
                </span>
                <span className="evt__reason mono">{ev.reason || '—'}</span>
                <span className="evt__obj mono">{obj || '—'}</span>
                <span className="evt__msg">
                  {ev.message}
                  {(ev.count ?? 1) > 1 && (
                    <span className="evt__count mono"> ×{ev.count}</span>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
      )}
      <p className="evtfeed__invite">
        Toggle a component off and on in{' '}
        {config.links.components ? (
          <OutLink href={config.links.components} variant="plain">
            the dashboard
          </OutLink>
        ) : (
          'the dashboard'
        )}{' '}
        and the teardown and redeploy land here as they happen.
      </p>
    </div>
  )
}

function Events({ namespace, config }: { namespace: string; config: UIConfig }) {
  return (
    <Section
      id="events"
      title="Live events"
      aside={`GET /introspect/namespace/${namespace}/events`}
    >
      <p className="small muted" style={{ marginBottom: 0, maxWidth: '72ch' }}>
        Every operation that touches this namespace &mdash; deploys, restarts,
        the toggleable components arriving and leaving &mdash; as Kubernetes
        records it.
      </p>
      <EventsFeed namespace={namespace} config={config} />
    </Section>
  )
}

export function UnderTheHood({
  config,
  section,
}: {
  config: UIConfig
  /** Optional deep-link target: #/under-the-hood/cluster scrolls there. */
  section?: string
}) {
  const namespace = config.namespace ?? 'conduit'
  const kube = useIntrospect<KubeResponse>('/api/introspect/kube')
  const ns = useIntrospect<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
  )

  useEffect(() => {
    if (!section) return
    document.getElementById(section)?.scrollIntoView({ block: 'start' })
  }, [section])

  useMarkStepSeen('/under-the-hood')

  return (
    <>
      <BackLink to="/">Conduit</BackLink>
      <header className="page-header">
        <Eyebrow>{stepEyebrow('/under-the-hood')}</Eyebrow>
        <h1>Under the hood</h1>
        <p className="lede">
          The pipelines page shows what Conduit did; this one shows what Nuon
          actually put in the account to make that true. Live reads &mdash;
          the summary first, every table and raw response one click deeper.
        </p>
      </header>

      <Glance kube={kube} ns={ns} namespace={namespace} />

      <Namespaces kube={kube} config={config} />
      <ThisNamespace ns={ns} namespace={namespace} openPods={section === 'namespace'} />
      <Events namespace={namespace} config={config} />
      <HelmReleases config={config} />
      <PodEnvironment />
      <StepNav current="/under-the-hood" />
    </>
  )
}
