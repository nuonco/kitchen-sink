import { useState } from 'react'
import { replayAttempt, useDelivery, type DeliveryAttempt } from '../lib/api'
import { DeliveryLoad, relativeTime, responseCode } from '../ui/delivery'

const DLQ_POLL_MS = 10_000

export function DeadLetters({
  onMutated,
}: {
  /** Called after a successful replay so the shared stats catch up. */
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
    <>
      <header className="page-header">
        <h1>Dead letters</h1>
        <p className="lede">
          Deliveries that failed five times. Replay re-queues one for an
          immediate real attempt; if it fails again it comes straight back.
        </p>
      </header>

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
                Empty &mdash; the worker picked your replay up. Watch the new
                attempt land under <a href="#/events">Events</a>.
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
                    <td>
                      <a className="mono" href={`#/events/${att.event_id}`}>
                        {att.event_type}
                      </a>
                    </td>
                    <td className="mono subtext">{att.endpoint_name}</td>
                    <td className="mono subtext">{att.attempt_number}</td>
                    <td className="mono subtext">{responseCode(att.response_code)}</td>
                    <td className="mono subtext">{relativeTime(att.created_at, now)}</td>
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
      <p className="small muted" style={{ marginTop: 20, maxWidth: '72ch' }}>
        Bulk operations run through an elevated-role runbook &mdash;{' '}
        <a href="#/infrastructure/operate">break-glass</a> drains the whole
        queue with the same replay call.
      </p>
    </>
  )
}
