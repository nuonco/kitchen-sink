import { useState } from 'react'
import {
  useDelivery,
  type DeliveryAttempt,
  type DeliveryEvent,
  type DeliveryEventStatus,
} from '../lib/api'
import { useNavigate } from '../lib/router'
import { BackLink, RawJSON, Section } from '../ui/Primitives'
import { DeliveryLoad, StatusBadge, relativeTime, responseCode } from '../ui/delivery'

const EVENTS_POLL_MS = 10_000
const ATTEMPTS_POLL_MS = 10_000

/* ---------- The list ---------- */

const statusFilters: Array<'all' | DeliveryEventStatus> = [
  'all',
  'pending',
  'delivered',
  'dead',
]

function EventList() {
  const navigate = useNavigate()
  const [events] = useDelivery<{ events: DeliveryEvent[] }>(
    '/api/delivery/events?limit=100',
    EVENTS_POLL_MS,
  )
  const [status, setStatus] = useState<'all' | DeliveryEventStatus>('all')
  const [type, setType] = useState('all')
  const now = Date.now()

  const list = events.state === 'ok' ? events.value.events : []
  const types = [...new Set(list.map((ev) => ev.type))].sort()
  const filtered = list.filter(
    (ev) =>
      (status === 'all' || ev.status === status) &&
      (type === 'all' || ev.type === type),
  )

  return (
    <>
      <header className="page-header">
        <h1>Events</h1>
        <p className="lede">
          Everything the ingest API accepted, newest first. Open one for its
          attempt-by-attempt delivery record.
        </p>
      </header>

      <div className="filters" role="group" aria-label="Filter events">
        <span className="filters__group" role="group" aria-label="Status">
          {statusFilters.map((s) => (
            <button
              key={s}
              className={status === s ? 'filters__pill filters__pill--on' : 'filters__pill'}
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
            >
              {s}
            </button>
          ))}
        </span>
        <label className="filters__select">
          <span className="sr-only">Event type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">all types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <DeliveryLoad result={events} what="events" />
      {events.state === 'ok' &&
        (list.length === 0 ? (
          <div className="status">
            No events yet. The relay-event-generator CronJob posts the first
            ones within two minutes of the install coming up.
          </div>
        ) : filtered.length === 0 ? (
          <div className="status">Nothing matches these filters.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Event</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ev) => (
                  <tr
                    key={ev.id}
                    className="row-select"
                    onClick={() => navigate(`/events/${ev.id}`)}
                  >
                    <td className="mono subtext">{relativeTime(ev.created_at, now)}</td>
                    <td className="mono">{ev.type}</td>
                    <td>
                      <StatusBadge status={ev.status} />
                    </td>
                    <td className="mono subtext">{ev.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </>
  )
}

/* ---------- One event: the attempt timeline ---------- */

export function AttemptTimeline({
  attempts,
  now,
  showEndpoint = true,
}: {
  attempts: DeliveryAttempt[]
  now: number
  showEndpoint?: boolean
}) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>#</th>
            <th>Status</th>
            <th>Response</th>
            <th>Latency</th>
            {showEndpoint && <th>Endpoint</th>}
            <th>Next retry</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((att) => (
            <tr key={att.id}>
              <td className="mono subtext">{att.attempt_number}</td>
              <td>
                <StatusBadge status={att.status} />
              </td>
              <td className="mono subtext">{responseCode(att.response_code)}</td>
              <td className="mono subtext">
                {att.latency_ms === null ? '—' : `${att.latency_ms}ms`}
              </td>
              {showEndpoint && <td className="mono subtext">{att.endpoint_name}</td>}
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

function EventDetail({ id }: { id: string }) {
  const [result] = useDelivery<{ event: DeliveryEvent; attempts: DeliveryAttempt[] }>(
    `/api/delivery/events/${encodeURIComponent(id)}/attempts`,
    ATTEMPTS_POLL_MS,
  )
  const now = Date.now()

  return (
    <>
      <BackLink to="/events">Events</BackLink>
      <DeliveryLoad result={result} what="this event" />
      {result.state === 'ok' && (
        <>
          <header className="page-header">
            <h1 className="mono" style={{ fontSize: 'var(--text-title)' }}>
              {result.value.event.type}
            </h1>
            <div className="row" style={{ marginTop: 8 }}>
              <StatusBadge status={result.value.event.status} />
              <span className="mono subtext muted">{result.value.event.id}</span>
              <span className="mono subtext muted">
                {relativeTime(result.value.event.created_at, now)}
              </span>
            </div>
          </header>

          <Section
            title="Delivery attempts"
            aside={`retries back off 30s → 2m → 10m → 30m · dead after five failures`}
          >
            <AttemptTimeline attempts={result.value.attempts} now={now} />
          </Section>

          <RawJSON
            value={result.value.event.payload}
            label="Payload (credential-shaped values redacted by the proxy)"
          />
        </>
      )}
    </>
  )
}

export function Events({ id }: { id?: string }) {
  if (id) return <EventDetail id={id} />
  return <EventList />
}
