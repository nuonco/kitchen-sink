import { useEffect, useState } from 'react'
import {
  fetchDelivery,
  useDelivery,
  type DeliveryAttempt,
  type DeliveryEndpoint,
  type DeliveryEvent,
} from '../lib/api'
import { useNavigate } from '../lib/router'
import { BackLink, Badge, Section } from '../ui/Primitives'
import { DeliveryLoad, StatusBadge, relativeTime, responseCode } from '../ui/delivery'

const ENDPOINTS_POLL_MS = 30_000

/** How many recent events the health sample walks. */
const SAMPLE_EVENTS = 20

/* ============================================================
   The health sample: the attempts of the newest N events, fetched once per
   page view. There is no global attempts endpoint, so per-endpoint health is
   computed from this sample and labeled as such.
   ============================================================ */

type Sample =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ok'; attempts: DeliveryAttempt[]; events: number }

function useAttemptSample(): Sample {
  const [sample, setSample] = useState<Sample>({ state: 'loading' })

  useEffect(() => {
    let live = true
    fetchDelivery<{ events: DeliveryEvent[] }>(
      `/api/delivery/events?limit=${SAMPLE_EVENTS}`,
    )
      .then((res) =>
        Promise.all(
          res.events.map((ev) =>
            fetchDelivery<{ event: DeliveryEvent; attempts: DeliveryAttempt[] }>(
              `/api/delivery/events/${encodeURIComponent(ev.id)}/attempts`,
            ),
          ),
        ).then((all) => {
          if (!live) return
          const attempts = all
            .flatMap((r) => r.attempts)
            .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
          setSample({ state: 'ok', attempts, events: res.events.length })
        }),
      )
      .catch((err: unknown) => {
        if (!live) return
        setSample({
          state: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })
    return () => {
      live = false
    }
  }, [])

  return sample
}

/** success / resolved over the sample, for one endpoint. */
function endpointHealth(attempts: DeliveryAttempt[], endpointID: string) {
  const mine = attempts.filter((att) => att.endpoint_id === endpointID)
  const resolved = mine.filter((att) => att.status !== 'pending')
  const success = resolved.filter((att) => att.status === 'success').length
  return {
    delivered: mine.length,
    resolved: resolved.length,
    rate: resolved.length > 0 ? success / resolved.length : null,
  }
}

function HealthCell({
  sample,
  endpointID,
}: {
  sample: Sample
  endpointID: string
}) {
  if (sample.state === 'loading') return <span className="muted subtext">…</span>
  if (sample.state === 'error') return <span className="muted subtext">—</span>
  const h = endpointHealth(sample.attempts, endpointID)
  if (h.resolved === 0) return <span className="muted subtext">no recent deliveries</span>
  const pct = Math.round((h.rate ?? 0) * 100)
  const tone = pct === 100 ? 'positive' : pct >= 80 ? 'warning' : 'negative'
  return (
    <Badge tone={tone} dot>
      {pct}% of {h.resolved}
    </Badge>
  )
}

/* ---------- The list ---------- */

function EndpointList() {
  const navigate = useNavigate()
  const [endpoints] = useDelivery<{ endpoints: DeliveryEndpoint[] }>(
    '/api/delivery/endpoints',
    ENDPOINTS_POLL_MS,
  )
  const sample = useAttemptSample()
  const list = endpoints.state === 'ok' ? endpoints.value.endpoints : []
  const now = Date.now()

  return (
    <>
      <header className="page-header">
        <h1>Endpoints</h1>
        <p className="lede">
          Every event fans out to each active endpoint.{' '}
          <span className="mono">relay-echo</span> is the seeded default — an
          in-cluster receiver, so a fresh install delivers end to end before
          anything external is registered.
        </p>
      </header>

      <DeliveryLoad result={endpoints} what="endpoints" />
      {endpoints.state === 'ok' && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>URL</th>
                <th>Status</th>
                <th>Success ({sample.state === 'ok' ? `last ${sample.events} events` : 'recent'})</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {list.map((ep) => (
                <tr
                  key={ep.id}
                  className="row-select"
                  onClick={() => navigate(`/endpoints/${ep.id}`)}
                >
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
                  <td>
                    <HealthCell sample={sample} endpointID={ep.id} />
                  </td>
                  <td className="mono subtext">{relativeTime(ep.created_at, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

/* ---------- One endpoint ---------- */

function EndpointDetail({ id }: { id: string }) {
  const navigate = useNavigate()
  const [endpoints] = useDelivery<{ endpoints: DeliveryEndpoint[] }>(
    '/api/delivery/endpoints',
    ENDPOINTS_POLL_MS,
  )
  const sample = useAttemptSample()
  const now = Date.now()

  const ep =
    endpoints.state === 'ok'
      ? endpoints.value.endpoints.find((e) => e.id === id)
      : undefined
  const mine =
    sample.state === 'ok'
      ? sample.attempts.filter((att) => att.endpoint_id === id)
      : []

  return (
    <>
      <BackLink to="/endpoints">Endpoints</BackLink>
      <DeliveryLoad result={endpoints} what="this endpoint" />
      {endpoints.state === 'ok' && !ep && (
        <div className="status">No endpoint with id {id}.</div>
      )}
      {ep && (
        <>
          <header className="page-header">
            <h1 style={{ fontSize: 'var(--text-title)' }}>{ep.name}</h1>
            <div className="row" style={{ marginTop: 8 }}>
              {ep.active ? (
                <Badge tone="positive" dot>
                  active
                </Badge>
              ) : (
                <Badge>inactive</Badge>
              )}
              <span className="mono subtext muted">{ep.url}</span>
              <HealthCell sample={sample} endpointID={ep.id} />
            </div>
            {ep.id === 'ep_echo_default' && (
              <p className="small muted" style={{ marginTop: 12, maxWidth: '72ch' }}>
                The default destination: an echo receiver deployed by the same
                chart, answering 200 to every POST.
              </p>
            )}
            {!ep.active && (
              <p className="small muted" style={{ marginTop: 12, maxWidth: '72ch' }}>
                Inactive endpoints receive nothing; new events skip them.
              </p>
            )}
          </header>

          <Section
            title="Recent deliveries"
            aside={
              sample.state === 'ok'
                ? `attempts from the last ${sample.events} events`
                : undefined
            }
          >
            {sample.state === 'loading' && (
              <div className="status">
                <div className="skeleton" style={{ width: '60%' }} />
              </div>
            )}
            {sample.state === 'error' && (
              <div className="status status--error">
                <p className="status__detail">{sample.message}</p>
              </div>
            )}
            {sample.state === 'ok' &&
              (mine.length === 0 ? (
                <div className="status">
                  Nothing in the sampled window
                  {ep.active ? '.' : ' — this endpoint is inactive.'}
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>#</th>
                        <th>Status</th>
                        <th>Response</th>
                        <th>Latency</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mine.map((att) => (
                        <tr
                          key={att.id}
                          className="row-select"
                          onClick={() => navigate(`/events/${att.event_id}`)}
                        >
                          <td className="mono">{att.event_type}</td>
                          <td className="mono subtext">{att.attempt_number}</td>
                          <td>
                            <StatusBadge status={att.status} />
                          </td>
                          <td className="mono subtext">{responseCode(att.response_code)}</td>
                          <td className="mono subtext">
                            {att.latency_ms === null ? '—' : `${att.latency_ms}ms`}
                          </td>
                          <td className="mono subtext">
                            {relativeTime(att.created_at, now)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </Section>
        </>
      )}
    </>
  )
}

export function Endpoints({ id }: { id?: string }) {
  if (id) return <EndpointDetail id={id} />
  return <EndpointList />
}
