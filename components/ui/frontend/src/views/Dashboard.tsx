import {
  countReady,
  useIntrospect,
  useIntrospectPoll,
  type KubeResponse,
  type NamespaceEvent,
  type NamespaceEventsResponse,
  type NamespaceResponse,
  type UIConfig,
} from '../lib/api'
import { OnboardingDrawer } from '../ui/Drawer'
import { OutLink, PageHeader, StatTile } from '../ui/Primitives'
import { namespaceOwner } from './Workloads'

/* ============================================================
   The landing: state at a glance, from live reads only. Four stat tiles,
   the newest events, and the install's identity. The events poll here is
   30s; the 5s poll stays on the Events screen.
   ============================================================ */

const EVENTS_POLL_MS = 30_000

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

/** "api :8080 · web :3000", trimmed for a tile note. */
function servingNote(data: NamespaceResponse): string {
  return (data.services ?? [])
    .map((svc) => {
      const name = svc.metadata?.name?.replace(/^periscope-/, '') ?? '?'
      const port = svc.spec?.ports?.[0]?.port
      return port ? `${name} :${port}` : name
    })
    .join(' · ')
}

/** Warning-type events whose last occurrence is within the past hour. */
function warningsLastHour(events: NamespaceEvent[], now: number): number {
  return events.filter((ev) => {
    if (ev.type !== 'Warning') return false
    const iso = ev.lastTimestamp ?? ev.firstTimestamp
    if (!iso) return false
    const t = Date.parse(iso)
    return !Number.isNaN(t) && now - t <= 60 * 60 * 1000
  }).length
}

function LatestEvents({
  events,
  now,
}: {
  events: NamespaceEvent[] | undefined
  now: number
}) {
  const latest = (events ?? []).slice(0, 5)
  return (
    <div className="panel">
      <div className="panel__head">
        <h2 className="panel__title">Latest events</h2>
        <a className="panel__more" href="#/events">
          All events →
        </a>
      </div>
      {events === undefined ? (
        <p className="panel__empty">—</p>
      ) : latest.length === 0 ? (
        <p className="panel__empty">
          Nothing yet — Kubernetes expires events after about an hour of quiet.
        </p>
      ) : (
        <ol className="evtfeed__list panel__list">
          {latest.map((ev, i) => {
            const obj = [ev.involvedObject?.kind, ev.involvedObject?.name]
              .filter(Boolean)
              .join('/')
            return (
              <li
                key={i}
                className={ev.type === 'Warning' ? 'evt evt--warning' : 'evt'}
              >
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
    </div>
  )
}

function InstallPanel({ config }: { config: UIConfig }) {
  const facts: Array<{ k: string; v?: string; href?: string; external?: boolean }> = [
    { k: 'install', v: config.install_id, href: config.links.install, external: true },
    { k: 'cluster', v: config.cluster_name, href: '#/workloads/cluster' },
    { k: 'region', v: config.region },
    { k: 'domain', v: config.public_domain },
  ]
  const known = facts.filter((f) => f.v)
  return (
    <div className="panel">
      <div className="panel__head">
        <h2 className="panel__title">This install</h2>
      </div>
      {known.length === 0 ? (
        <p className="panel__empty">—</p>
      ) : (
        <dl className="kv panel__kv">
          {known.map((f) => (
            <div key={f.k} style={{ display: 'contents' }}>
              <dt>{f.k}</dt>
              <dd>
                {f.href ? (
                  <a
                    href={f.href}
                    {...(f.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                  >
                    {f.v}
                  </a>
                ) : (
                  f.v
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {config.links.install && (
        <div className="panel__foot">
          <OutLink href={config.links.install} variant="secondary">
            Open in Nuon
          </OutLink>
        </div>
      )}
    </div>
  )
}

export function Dashboard({
  config,
  drawerOpen,
  onDrawerClose,
}: {
  config: UIConfig
  drawerOpen: boolean
  onDrawerClose: () => void
}) {
  const namespace = config.namespace ?? 'periscope'
  const kube = useIntrospect<KubeResponse>('/api/introspect/kube')
  const ns = useIntrospect<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
  )
  const events = useIntrospectPoll<NamespaceEventsResponse>(
    `/api/introspect/namespace/${namespace}/events`,
    EVENTS_POLL_MS,
    true,
  )

  const now = Date.now()
  const nsData = ns.state === 'ok' ? ns.value.response : undefined
  const pods = nsData?.pods ?? []
  const kubeRows =
    kube.state === 'ok' ? (kube.value.response.namespaces ?? []) : undefined
  const appRows = kubeRows?.filter(
    (row) => namespaceOwner(row.name, config.install_id).app,
  )
  const eventList =
    events.state === 'ok' ? (events.value.response.events ?? []) : undefined
  const warnings =
    eventList === undefined ? undefined : warningsLastHour(eventList, now)

  return (
    <>
      <PageHeader title="Dashboard" />

      <div className="stats">
        <StatTile
          label="Pods ready"
          value={nsData ? `${countReady(pods)} of ${pods.length}` : undefined}
          note={`in ${namespace}`}
          href="#/workloads/namespace"
        />
        <StatTile
          label="Services"
          value={nsData ? (nsData.services ?? []).length : undefined}
          note={nsData ? servingNote(nsData) : undefined}
          href="#/workloads/namespace"
        />
        <StatTile
          label="Namespaces"
          value={kubeRows ? kubeRows.length : undefined}
          note={appRows ? `${appRows.length} from this install` : undefined}
          href="#/workloads/cluster"
        />
        <StatTile
          label="Warnings, last hour"
          value={warnings}
          note={`${namespace} events`}
          href="#/events"
          warn={(warnings ?? 0) > 0}
        />
      </div>

      <div className="dash-grid">
        <LatestEvents events={eventList} now={now} />
        <InstallPanel config={config} />
      </div>

      <OnboardingDrawer
        open={drawerOpen}
        onClose={onDrawerClose}
        config={config}
        kube={kube}
        ns={ns}
      />
    </>
  )
}
