import { useState } from 'react'
import {
  useDelivery,
  type DeliveryEvent,
  type DeliveryLoadable,
  type DeliveryStats,
  type UIConfig,
} from '../lib/api'
import { useNavigate } from '../lib/router'
import { Callout, Icon, Section } from '../ui/Primitives'
import { VolumeChart } from '../ui/VolumeChart'
import { DeliveryLoad, StatusBadge, relativeTime } from '../ui/delivery'

const EVENTS_POLL_MS = 15_000
/** The API's list cap; a full page means the 24h window may be truncated. */
const EVENTS_LIMIT = 200

/* ---------- Getting started, once ---------- */

const INTRO_KEY = 'relay-intro-dismissed'

function introDismissed(): boolean {
  try {
    return window.localStorage.getItem(INTRO_KEY) === '1'
  } catch {
    return false
  }
}

function GettingStarted() {
  const [dismissed, setDismissed] = useState(introDismissed)
  if (dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(INTRO_KEY, '1')
    } catch {
      // Without storage the card returns next visit; dismiss still works now.
    }
  }

  return (
    <div className="intro">
      <button className="intro__dismiss" onClick={dismiss} aria-label="Dismiss">
        Dismiss
      </button>
      <div className="intro__title">How Relay works</div>
      <p className="intro__line">
        Events arrive at the ingest API, queue in Postgres, and the worker
        POSTs them to every active endpoint — retrying 30s &rarr; 2m &rarr;
        10m &rarr; 30m, dead-lettering after five failures.
      </p>
      <p className="intro__line">
        The traffic is real: a CronJob posts sample events every two minutes,
        delivered to the seeded <span className="mono">relay-echo</span>{' '}
        receiver. Nuon deployed all of it into this cluster.
      </p>
      <div className="row" style={{ marginTop: 12 }}>
        <a className="btn btn--secondary btn--sm" href="#/events">
          Watch events <Icon name="arrow-right" />
        </a>
        <a className="btn btn--ghost btn--sm" href="#/infrastructure">
          What Nuon deployed <Icon name="arrow-right" />
        </a>
      </div>
    </div>
  )
}

/* ---------- Stat tiles ---------- */

function StatTile({
  label,
  value,
  note,
  tone,
  href,
}: {
  label: string
  value?: string
  note?: string
  tone?: 'bad'
  href?: string
}) {
  const cls = [
    'fact',
    href ? 'fact--link' : '',
    value === undefined ? 'fact--pending' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const body = (
    <>
      <div className="fact__label">{label}</div>
      <div
        className="fact__value fact__value--num"
        style={tone === 'bad' ? { color: 'var(--status-negative)' } : undefined}
      >
        {value ?? '…'}
      </div>
      {note && <div className="fact__note">{note}</div>}
    </>
  )
  if (href) {
    return (
      <a className={cls} href={href}>
        {body}
      </a>
    )
  }
  return <div className={cls}>{body}</div>
}

function StatTiles({ stats }: { stats: DeliveryLoadable<DeliveryStats> }) {
  const s = stats.state === 'ok' ? stats.value : undefined
  return (
    <div className="facts" style={{ marginTop: 0 }}>
      <StatTile label="Events (24h)" value={s ? String(s.events_24h) : undefined} />
      <StatTile
        label="Delivered (24h)"
        value={s ? String(s.delivered_24h) : undefined}
      />
      <StatTile
        label="Success rate (24h)"
        value={s ? `${(s.success_rate * 100).toFixed(1)}%` : undefined}
        note="of resolved attempts"
      />
      <StatTile
        label="Dead letters"
        value={s ? String(s.dlq_depth) : undefined}
        tone={s && s.dlq_depth > 0 ? 'bad' : undefined}
        href="#/dead-letters"
      />
      <StatTile
        label="Active endpoints"
        value={s ? String(s.endpoints_active) : undefined}
        href="#/endpoints"
      />
    </div>
  )
}

/* ---------- The view ---------- */

export function Dashboard({
  config,
  stats,
}: {
  config: UIConfig
  stats: DeliveryLoadable<DeliveryStats>
}) {
  void config
  const navigate = useNavigate()
  const [events] = useDelivery<{ events: DeliveryEvent[] }>(
    `/api/delivery/events?limit=${EVENTS_LIMIT}`,
    EVENTS_POLL_MS,
  )
  const list = events.state === 'ok' ? events.value.events : []
  const capped = list.length >= EVENTS_LIMIT
  const failures = list.filter((ev) => ev.status === 'dead').slice(0, 5)
  const dlqDepth = stats.state === 'ok' ? stats.value.dlq_depth : 0
  const now = Date.now()

  return (
    <>
      <header className="page-header">
        <h1>Dashboard</h1>
      </header>

      <GettingStarted />

      <DeliveryLoad result={stats} what="delivery stats" />
      <StatTiles stats={stats} />

      <Section
        title="Events per hour"
        aside={
          capped
            ? `newest ${EVENTS_LIMIT} events · re-read every ${EVENTS_POLL_MS / 1000}s`
            : `last 24h · re-read every ${EVENTS_POLL_MS / 1000}s`
        }
      >
        <DeliveryLoad result={events} what="events" />
        {events.state === 'ok' &&
          (list.length === 0 ? (
            <div className="status">
              No events yet. The relay-event-generator CronJob posts the first
              ones within two minutes of the install coming up.
            </div>
          ) : (
            <VolumeChart events={list} now={now} capped={capped} />
          ))}
      </Section>

      <Section title="Recent failures" aside="events that exhausted their retries">
        {events.state === 'ok' && failures.length === 0 && (
          <div className="status">
            None in the fetched window. Failures land here after five failed
            attempts.
          </div>
        )}
        {failures.length > 0 && (
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
                {failures.map((ev) => (
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
        )}
        {dlqDepth > 0 && (
          <Callout label={`${dlqDepth} dead ${dlqDepth === 1 ? 'delivery' : 'deliveries'} waiting`}>
            Each can be replayed for an immediate real attempt.{' '}
            <a href="#/dead-letters">Open dead letters</a>
          </Callout>
        )}
      </Section>
    </>
  )
}
