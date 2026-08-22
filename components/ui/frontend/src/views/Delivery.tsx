import { useState } from 'react'
import {
  fetchDelivery,
  replayAttempt,
  useDelivery,
  type DeliveryAttempt,
  type DeliveryEndpoint,
  type DeliveryEvent,
  type DeliveryLoadable,
  type DeliveryStats,
  type UIConfig,
} from '../lib/api'
import { useMarkStepSeen } from '../lib/progress'
import { StepNav } from '../ui/CapabilityGrid'
import {
  BackLink,
  Badge,
  Callout,
  Icon,
  Section,
} from '../ui/Primitives'

/* ============================================================
   Relay's own console: the delivery pipeline, read live from relay-api
   through this app's proxy. Everything on this page is a real row in the
   delivery store; the replay button is a real write.
   ============================================================ */

const STATS_POLL_MS = 10_000
const EVENTS_POLL_MS = 10_000
const DLQ_POLL_MS = 10_000

function relativeTime(iso: string | null | undefined, now: number): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const s = Math.round((now - t) / 1000)
  if (s < -1) return `in ${formatSpan(-s)}`
  return `${formatSpan(Math.max(0, s))} ago`
}

function formatSpan(s: number): string {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function EventStatusBadge({ status }: { status: string }) {
  if (status === 'delivered' || status === 'success') {
    return (
      <Badge tone="positive" dot>
        {status}
      </Badge>
    )
  }
  if (status === 'dead') {
    return (
      <Badge tone="negative" dot>
        dead
      </Badge>
    )
  }
  if (status === 'failed') {
    return (
      <Badge tone="warning" dot>
        failed
      </Badge>
    )
  }
  return (
    <Badge tone="warning" dot>
      {status}
    </Badge>
  )
}

/** Renders the not-ok states of a delivery read; null once data is there. */
function DeliveryLoad({
  result,
  what,
}: {
  result: DeliveryLoadable<unknown>
  what: string
}) {
  if (result.state === 'loading') {
    return (
      <div className="status">
        <div className="stack" style={{ maxWidth: 360 }}>
          <div className="skeleton" style={{ width: '70%' }} />
          <div className="skeleton" style={{ width: '90%' }} />
          <div className="skeleton" style={{ width: '45%' }} />
        </div>
      </div>
    )
  }
  if (result.state === 'starting') {
    return (
      <div className="status">
        <div className="status__title">The delivery store is starting.</div>
        <p className="small">
          relay-api answers 503 for {what} until Postgres (relay-db) is
          reachable. On a fresh deploy that is under a minute; this page
          re-reads on its own.
        </p>
      </div>
    )
  }
  if (result.state === 'error') {
    return (
      <div className="status status--error">
        <div className="status__title">Could not read {what}.</div>
        <p className="status__detail">{result.message}</p>
      </div>
    )
  }
  return null
}

/* ---------- Stats ---------- */

function StatFact({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value?: string
  note?: string
  tone?: 'bad'
}) {
  return (
    <div className={value === undefined ? 'fact fact--pending' : 'fact'}>
      <div className="fact__label">{label}</div>
      <div
        className="fact__value fact__value--num"
        style={tone === 'bad' ? { color: 'var(--negative, #ff6b6b)' } : undefined}
      >
        {value ?? '…'}
      </div>
      {note && <div className="fact__note">{note}</div>}
    </div>
  )
}

function StatsBar({ stats }: { stats: DeliveryLoadable<DeliveryStats> }) {
  const s = stats.state === 'ok' ? stats.value : undefined
  return (
    <div className="facts" style={{ marginTop: 0 }}>
      <StatFact
        label="Events (24h)"
        value={s ? String(s.events_24h) : undefined}
      />
      <StatFact
        label="Delivered (24h)"
        value={s ? String(s.delivered_24h) : undefined}
      />
      <StatFact
        label="Success rate (24h)"
        value={s ? `${(s.success_rate * 100).toFixed(1)}%` : undefined}
        note="of resolved attempts"
      />
      <StatFact
        label="Dead letters"
        value={s ? String(s.dlq_depth) : undefined}
        note={s && s.dlq_depth > 0 ? 'replayable below' : undefined}
        tone={s && s.dlq_depth > 0 ? 'bad' : undefined}
      />
      <StatFact
        label="Active endpoints"
        value={s ? String(s.endpoints_active) : undefined}
      />
    </div>
  )
}

/* ---------- Per-event attempt timeline ---------- */

type AttemptsState =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ok'; attempts: DeliveryAttempt[] }

function AttemptTimeline({ attempts, now }: { attempts: DeliveryAttempt[]; now: number }) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>#</th>
            <th>Status</th>
            <th>Response</th>
            <th>Latency</th>
            <th>Endpoint</th>
            <th>Next retry</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((att) => (
            <tr key={att.id}>
              <td className="mono subtext">{att.attempt_number}</td>
              <td>
                <EventStatusBadge status={att.status} />
              </td>
              <td className="mono subtext">
                {att.response_code === null
                  ? '—'
                  : att.response_code === 0
                    ? 'no connection'
                    : att.response_code}
              </td>
              <td className="mono subtext">
                {att.latency_ms === null ? '—' : `${att.latency_ms}ms`}
              </td>
              <td className="mono subtext">{att.endpoint_name}</td>
              <td className="mono subtext">
                {att.next_retry_at ? relativeTime(att.next_retry_at, now) : '—'}
              </td>
              <td className="mono subtext">{relativeTime(att.created_at, now)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EventRow({
  event,
  open,
  onToggle,
  attempts,
  now,
}: {
  event: DeliveryEvent
  open: boolean
  onToggle: () => void
  attempts?: AttemptsState
  now: number
}) {
  return (
    <>
      <tr
        className={open ? 'row-select row-select--active' : 'row-select'}
        onClick={onToggle}
      >
        <td className="mono subtext">{relativeTime(event.created_at, now)}</td>
        <td className="mono">{event.type}</td>
        <td>
          <EventStatusBadge status={event.status} />
        </td>
        <td className="mono subtext">{event.id}</td>
        <td aria-hidden="true" style={open ? { transform: 'rotate(90deg)' } : undefined}>
          <Icon name="caret-right" />
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} style={{ padding: '4px 0 16px' }}>
            {!attempts || attempts.state === 'loading' ? (
              <div className="skeleton" style={{ width: '60%', margin: '8px 0' }} />
            ) : attempts.state === 'error' ? (
              <div className="status status--error">
                <p className="status__detail">{attempts.message}</p>
              </div>
            ) : (
              <AttemptTimeline attempts={attempts.attempts} now={now} />
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function EventsSection() {
  const [events] = useDelivery<{ events: DeliveryEvent[] }>(
    '/api/delivery/events?limit=30',
    EVENTS_POLL_MS,
  )
  const [open, setOpen] = useState<string | null>(null)
  const [attempts, setAttempts] = useState<Record<string, AttemptsState>>({})
  const now = Date.now()

  const toggle = (id: string) => {
    if (open === id) {
      setOpen(null)
      return
    }
    setOpen(id)
    setAttempts((prev) => ({ ...prev, [id]: { state: 'loading' } }))
    fetchDelivery<{ event: DeliveryEvent; attempts: DeliveryAttempt[] }>(
      `/api/delivery/events/${encodeURIComponent(id)}/attempts`,
    )
      .then((res) =>
        setAttempts((prev) => ({
          ...prev,
          [id]: { state: 'ok', attempts: res.attempts },
        })),
      )
      .catch((err: unknown) =>
        setAttempts((prev) => ({
          ...prev,
          [id]: {
            state: 'error',
            message: err instanceof Error ? err.message : String(err),
          },
        })),
      )
  }

  const list = events.state === 'ok' ? events.value.events : []

  return (
    <Section
      id="events"
      title="Recent events"
      aside={`GET /delivery/events · re-read every ${EVENTS_POLL_MS / 1000}s`}
    >
      <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
        Newest first. Open one for its attempt-by-attempt delivery record:
        retries back off 30s &rarr; 2m &rarr; 10m &rarr; 30m, and a fifth
        failure sends the delivery to the dead-letter queue.
      </p>
      <DeliveryLoad result={events} what="events" />
      {events.state === 'ok' &&
        (list.length === 0 ? (
          <div className="status">
            No events yet. The relay-event-generator CronJob posts the first
            ones within two minutes of the install coming up.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Event</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    open={open === event.id}
                    onToggle={() => toggle(event.id)}
                    attempts={attempts[event.id]}
                    now={now}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </Section>
  )
}

/* ---------- Endpoints ---------- */

function EndpointsSection() {
  const [endpoints] = useDelivery<{ endpoints: DeliveryEndpoint[] }>(
    '/api/delivery/endpoints',
    30_000,
  )
  const list = endpoints.state === 'ok' ? endpoints.value.endpoints : []
  const now = Date.now()

  return (
    <Section
      id="endpoints"
      title="Registered endpoints"
      aside="GET /delivery/endpoints"
    >
      <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
        Every event fans out to each active endpoint. The seeded default is
        relay-echo, an in-cluster receiver deployed by the same chart, so a
        fresh install delivers end to end with nothing registered yet.
      </p>
      <DeliveryLoad result={endpoints} what="endpoints" />
      {endpoints.state === 'ok' && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>URL</th>
                <th>Status</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {list.map((ep) => (
                <tr key={ep.id}>
                  <td>{ep.name}</td>
                  <td className="mono subtext">{ep.url}</td>
                  <td>
                    {ep.active ? (
                      <Badge tone="positive" dot>
                        active
                      </Badge>
                    ) : (
                      <Badge>inactive</Badge>
                    )}
                  </td>
                  <td className="mono subtext">
                    {relativeTime(ep.created_at, now)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

/* ---------- DLQ ---------- */

function DLQSection({
  onMutated,
}: {
  /** Called after a successful replay so the stats header catches up. */
  onMutated: () => void
}) {
  const [dlq, refreshDlq] = useDelivery<{ attempts: DeliveryAttempt[] }>(
    '/api/delivery/dlq',
    DLQ_POLL_MS,
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [replayed, setReplayed] = useState(0)
  const list = dlq.state === 'ok' ? dlq.value.attempts : []
  const now = Date.now()

  const replay = (id: string) => {
    setBusy(id)
    setLastError(null)
    replayAttempt(id)
      .then(() => {
        setReplayed((n) => n + 1)
        refreshDlq()
        onMutated()
      })
      .catch((err: unknown) => {
        setLastError(err instanceof Error ? err.message : String(err))
        refreshDlq()
      })
      .finally(() => setBusy(null))
  }

  return (
    <Section
      id="dlq"
      title="Dead-letter queue"
      aside="GET /delivery/dlq · POST /delivery/dlq/{id}/replay"
    >
      <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
        Deliveries that failed five times. Replay re-queues one for an
        immediate real attempt &mdash; the only write this console can make,
        and the same call the break-glass runbook uses to drain a stuck
        pipeline.
      </p>
      <DeliveryLoad result={dlq} what="the dead-letter queue" />
      {lastError && (
        <div className="status status--error" style={{ marginBottom: 12 }}>
          <div className="status__title">Replay failed.</div>
          <p className="status__detail">{lastError}</p>
        </div>
      )}
      {dlq.state === 'ok' &&
        (list.length === 0 ? (
          <div className="status">
            {replayed > 0 ? (
              <>
                Empty &mdash; the worker picked your replay up. Watch the
                event&rsquo;s new attempt land under Recent events.
              </>
            ) : (
              <>Empty. Nothing has exhausted its retries.</>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Endpoint</th>
                  <th>Attempts</th>
                  <th>Last response</th>
                  <th>Died</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((att) => (
                  <tr key={att.id}>
                    <td className="mono">{att.event_type}</td>
                    <td className="mono subtext">{att.endpoint_name}</td>
                    <td className="mono subtext">{att.attempt_number}</td>
                    <td className="mono subtext">
                      {att.response_code === null
                        ? '—'
                        : att.response_code === 0
                          ? 'no connection'
                          : att.response_code}
                    </td>
                    <td className="mono subtext">
                      {relativeTime(att.created_at, now)}
                    </td>
                    <td>
                      <button
                        className="copy-btn"
                        disabled={busy !== null}
                        onClick={() => replay(att.id)}
                      >
                        {busy === att.id ? 'Replaying…' : 'Replay'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </Section>
  )
}

/* ---------- The view ---------- */

export function Delivery({ config }: { config: UIConfig }) {
  useMarkStepSeen('/delivery')
  const [stats, refreshStats] = useDelivery<DeliveryStats>(
    '/api/delivery/stats',
    STATS_POLL_MS,
  )
  void config

  return (
    <>
      <BackLink to="/">Relay</BackLink>
      <header className="page-header">
        <h1>Relay is delivering.</h1>
        <p className="lede">
          Events arrive at the ingest API, queue in Postgres, and the worker
          POSTs them to every registered endpoint &mdash; retrying with
          backoff, dead-lettering after five failures. All of it below is
          live data from that store.
        </p>
      </header>

      <DeliveryLoad result={stats} what="delivery stats" />
      <StatsBar stats={stats} />

      <EventsSection />
      <DLQSection onMutated={refreshStats} />
      <EndpointsSection />

      <Callout label="Where the traffic comes from">
        A CronJob, relay-event-generator, POSTs one to three sample events to
        /ingest every two minutes. Generated payloads, real pipeline: every
        row here is a genuine HTTP delivery to relay-echo. The oldest rows
        are seed data so day one isn&rsquo;t blank &mdash; including three
        dead chains, so the replay above has something real to act on.
      </Callout>
      <StepNav current="/delivery" />
    </>
  )
}
