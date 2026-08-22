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
import { toggleableComponents } from '../lib/config-data.gen'
import { stepEyebrow } from '../lib/taxonomy'
import { useMarkStepSeen } from '../lib/progress'
import { StepNav } from '../ui/CapabilityGrid'
import {
  BackLink,
  Badge,
  Callout,
  CodeBlock,
  Eyebrow,
  LoadState,
  OutLink,
  PspSection,
  PspTag,
} from '../ui/Primitives'

/* ============================================================
   The audit-log exporter: the second toggleable component, carrying the
   commercial framing tictactoe deliberately doesn't. Same mechanic end to
   end — toggleable = true, default_enabled = false, a marker Service this
   page watches for — shown as an entitlement card, not a paragraph.
   ============================================================ */

/** How often the page re-reads the namespace looking for the deploy. */
const POLL_MS = 10_000

/** How often the unlocked page re-reads the namespace's events. */
const EVENTS_POLL_MS = 5_000

const component = toggleableComponents.find(
  (c) => c.name === 'audit_log_exporter',
)

/** The plan state, drawn: a live readout up top (never a switch — the real
 * control is in the dashboard) and the dashboard deep link as the one action. */
function EntitlementCard({
  on,
  config,
  onDashboardOpen,
}: {
  on: boolean
  config: UIConfig
  onDashboardOpen: () => void
}) {
  return (
    <div className={on ? 'ent ent--on' : 'ent'}>
      <div className="ent__head">
        <span className="ent__plan">Enterprise plan</span>
        <span className="entstat mono" role="status">
          <span
            className={on ? 'entstat__dot entstat__dot--on' : 'entstat__dot'}
            aria-hidden="true"
          />
          {on ? 'on' : 'off · watching'}
        </span>
      </div>
      <div className="ent__name mono">audit_log_exporter</div>
      <p className="ent__pitch">
        Delivery-log export: Relay&rsquo;s full delivery record, archived to
        the S3 bucket in this install. The logs never leave your cloud.
      </p>
      <div className="ent__foot">
        {on ? (
          <Badge tone="positive" dot>
            included in this install
          </Badge>
        ) : (
          <OutLink href={config.links.components} onClick={onDashboardOpen}>
            Turn it on in Nuon
          </OutLink>
        )}
        <span className="ent__facts mono">
          toggleable = true · default_enabled = false
        </span>
      </div>
      {!on && (
        <p className="ent__how">
          The switch lives in the Nuon dashboard — enable the component there
          and this page flips by itself within {POLL_MS / 1000}s of the deploy.
        </p>
      )}
    </div>
  )
}

/** The mechanism, as three beats instead of a paragraph. */
function HowItKnows({
  config,
  namespace,
  live,
  onDashboardOpen,
}: {
  config: UIConfig
  namespace: string
  live?: boolean
  onDashboardOpen?: () => void
}) {
  const beats = [
    {
      label: 'toggle',
      detail: 'component on, in the dashboard',
      href: config.links.components,
    },
    { label: 'deploy', detail: `Nuon applies ${AUDIT_LOG_SERVICE}` },
    {
      label: live ? 'narrate' : 'detect',
      detail: live
        ? `this page reads ${namespace} events every ${EVENTS_POLL_MS / 1000}s`
        : `this page re-reads ${namespace} every ${POLL_MS / 1000}s`,
    },
  ]
  return (
    <div className="ship" style={{ marginTop: 16 }}>
      {beats.map((beat, i) => {
        const body = (
          <>
            <span className="ship__num">0{i + 1}</span>
            <span className="ship__label">{beat.label}</span>
            <span className="ship__detail mono">{beat.detail}</span>
          </>
        )
        return beat.href ? (
          <a
            key={beat.label}
            className="ship__beat ship__beat--link"
            href={beat.href}
            target="_blank"
            rel="noreferrer"
            onClick={onDashboardOpen}
          >
            {body}
          </a>
        ) : (
          <span key={beat.label} className="ship__beat">
            {body}
          </span>
        )
      })}
    </div>
  )
}

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
 * The live part: the namespace's own Kubernetes events, re-read every few
 * seconds for as long as the page is open. Rows that were not in the previous
 * poll flash once — that is a real operation landing, not a replay.
 */
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
        Toggle the component off and on in{' '}
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

export function AuditLog({ config }: { config: UIConfig }) {
  useMarkStepSeen('/audit-log')
  const namespace = config.namespace ?? 'relay'
  const [enabled, setEnabled] = useState(false)
  const [justEnabled, setJustEnabled] = useState(false)
  const [waiting, setWaiting] = useState(false)
  // True once the visitor has actually seen the locked state, so an unlock
  // detected later is a real on-screen moment rather than the initial load.
  const sawLocked = useRef(false)

  const ns = useIntrospectPoll<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
    POLL_MS,
    !enabled,
  )

  useEffect(() => {
    if (ns.state !== 'ok') return
    const found = hasAuditLogExporter(ns.value.response.services ?? [])
    if (found) {
      if (sawLocked.current) setJustEnabled(true)
      setEnabled(true)
    } else {
      sawLocked.current = true
    }
  }, [ns])

  const service: ServiceSummary | undefined =
    ns.state === 'ok'
      ? (ns.value.response.services ?? []).find(
          (svc) => svc.metadata?.name === AUDIT_LOG_SERVICE,
        )
      : undefined

  const ready = enabled || ns.state === 'ok'

  return (
    <>
      <BackLink to="/">Relay</BackLink>
      <header className="page-header">
        <Eyebrow>{stepEyebrow('/audit-log')}</Eyebrow>
        <h1>Sell an entitlement</h1>
        <p className="lede psp-lede">
          <PspTag kind="problem" /> Enterprise customers want the delivery
          log archived; other plans don&rsquo;t pay for it. Every install runs
          the same config.
        </p>
      </header>

      {!enabled && (
        <LoadState result={ns} what={`the ${namespace} namespace`} />
      )}

      {ready && (
        <>
          <PspSection
            kind="solution"
            title="A toggleable component"
            aside="components/audit_log_exporter.toml"
          >
            <div className={justEnabled ? 'ttt--just-unlocked' : undefined}>
              {justEnabled && (
                <div className="ttt-unlocked-note">
                  <Badge tone="positive" dot>
                    just deployed
                  </Badge>
                  <span>
                    The component deployed, its Service appeared in the
                    namespace, and this page noticed. No reload.
                  </span>
                </div>
              )}
              <EntitlementCard
                on={enabled}
                config={config}
                onDashboardOpen={() => setWaiting(true)}
              />
            </div>
            {component && (
              <CodeBlock
                label="the real config, comments stripped"
                code={component.toml}
              />
            )}
          </PspSection>

          <PspSection
            kind="proof"
            title={enabled ? 'What introspection sees' : 'Flip it on and watch'}
            aside={
              enabled
                ? `GET /introspect/namespace/${namespace}/events`
                : `GET /introspect/namespace/${namespace}`
            }
          >
            <HowItKnows
              config={config}
              namespace={namespace}
              live={enabled}
              onDashboardOpen={enabled ? undefined : () => setWaiting(true)}
            />
            {enabled ? (
              <>
                <EventsFeed namespace={namespace} config={config} />
                <Callout label="What actually got deployed">
                  One marker Service —{' '}
                  {service?.metadata?.name ?? AUDIT_LOG_SERVICE}
                  {service?.spec?.type ? ` (${service.spec.type})` : ''} — the
                  entitlement flag. The export itself is the{' '}
                  <span className="mono">delivery_log_export</span> action,
                  which archives the delivery record to this install&rsquo;s
                  S3 bucket every six hours; a full exporter would put its
                  workload behind this same switch.
                </Callout>
              </>
            ) : (
              <>
                <div className="ttt-watch">
                  {waiting ? (
                    <>
                      <Badge tone="warning" dot>
                        waiting for the deploy
                      </Badge>
                      <span>
                        Toggle the component on in the dashboard tab and
                        deploy it; this page switches over when the Service
                        appears.
                      </span>
                    </>
                  ) : (
                    <>
                      <Badge tone="accent" dot>
                        watching live
                      </Badge>
                      <span>
                        Checking this namespace for the exporter&rsquo;s
                        Service every {POLL_MS / 1000} seconds.
                      </span>
                    </>
                  )}
                </div>
              </>
            )}
          </PspSection>
        </>
      )}
      <StepNav current="/audit-log" />
    </>
  )
}
