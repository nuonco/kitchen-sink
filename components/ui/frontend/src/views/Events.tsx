import { useEffect, useRef, useState } from 'react'
import {
  AUDIT_LOG_SERVICE,
  hasAuditLogExporter,
  useIntrospectPoll,
  type NamespaceEvent,
  type NamespaceEventsResponse,
  type NamespaceResponse,
  type ServiceSummary,
  type UIConfig,
} from '../lib/api'
import { EntitlementPanel } from '../ui/EntitlementPanel'
import { LoadState, OutLink, PageHeader, Section } from '../ui/Primitives'

/* ============================================================
   The events feed, first-class and ungated: a headline product feature.
   The SIEM-export entitlement sits below it, at its point of use; the
   Nuon lesson behind it lives on the guide's entitlement page.
   ============================================================ */

/** How often the feed re-reads the namespace's events. */
const EVENTS_POLL_MS = 5_000

/** How often the page re-reads the namespace while the exporter is off. */
const MARKER_POLL_MS = 10_000

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

/**
 * The live feed: the namespace's own Kubernetes events, re-read every few
 * seconds for as long as the page is open. Rows that were not in the previous
 * poll flash once — that is a real operation landing, not a replay.
 */
export function EventsFeed({
  namespace,
  config,
}: {
  namespace: string
  config: UIConfig
}) {
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

export function Events({ config }: { config: UIConfig }) {
  const namespace = config.namespace ?? 'periscope'
  const install = config.install_id ?? '<your-install-id>'

  const [enabled, setEnabled] = useState(false)
  const [justEnabled, setJustEnabled] = useState(false)
  const [waiting, setWaiting] = useState(false)
  // True once the visitor has actually seen the off state, so an unlock
  // detected later is a real on-screen moment rather than the initial load.
  const sawOff = useRef(false)

  const ns = useIntrospectPoll<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
    MARKER_POLL_MS,
    !enabled,
  )

  useEffect(() => {
    if (ns.state !== 'ok') return
    const found = hasAuditLogExporter(ns.value.response.services ?? [])
    if (found) {
      if (sawOff.current) setJustEnabled(true)
      setEnabled(true)
    } else {
      sawOff.current = true
    }
  }, [ns])

  const service: ServiceSummary | undefined =
    ns.state === 'ok'
      ? (ns.value.response.services ?? []).find(
          (svc) => svc.metadata?.name === AUDIT_LOG_SERVICE,
        )
      : undefined

  return (
    <>
      <PageHeader
        title="Events"
        lede="Kubernetes events from the console's namespace, five-second poll."
      />

      <EventsFeed namespace={namespace} config={config} />

      <Section title="SIEM export" aside="components/audit_log_exporter.toml">
        <EntitlementPanel
          title="Enterprise plan"
          componentName="audit_log_exporter"
          on={enabled}
          justEnabled={justEnabled}
          waiting={waiting}
          onDashboardOpen={() => setWaiting(true)}
          dashboardHref={
            config.links.audit_log_exporter ?? config.links.components
          }
          cli={`nuon installs components toggle -i ${install} -c audit_log_exporter --enable`}
          pitch="Streams this feed to your SIEM. Available on the Enterprise plan."
          proof={
            <>
              One marker Service &mdash;{' '}
              <span className="mono">
                {service?.metadata?.name ?? AUDIT_LOG_SERVICE}
              </span>
              {service?.spec?.type ? ` (${service.spec.type})` : ''}. A real
              exporter puts its workload behind the same switch.
            </>
          }
          pollSeconds={MARKER_POLL_MS / 1000}
        />
        <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
          How the toggle works as config is on the{' '}
          <a href="#/guide/entitlement">entitlement page</a> of the evaluation
          guide.
        </p>
      </Section>
    </>
  )
}
