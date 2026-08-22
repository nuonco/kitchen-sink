import type { DeliveryLoadable } from '../lib/api'
import { Badge } from './Primitives'

/* ============================================================
   Small pieces every delivery surface shares: relative timestamps, the
   status badge for events and attempts, response-code formatting, and the
   loading / store-starting / error states of a delivery read.
   ============================================================ */

export function relativeTime(iso: string | null | undefined, now: number): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const s = Math.round((now - t) / 1000)
  if (s < -1) return `in ${formatSpan(-s)}`
  return `${formatSpan(Math.max(0, s))} ago`
}

export function formatSpan(s: number): string {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

/** "—" before an attempt resolves; response_code 0 is a connection error. */
export function responseCode(code: number | null): string {
  if (code === null) return '—'
  if (code === 0) return 'no connection'
  return String(code)
}

export function StatusBadge({ status }: { status: string }) {
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
  return (
    <Badge tone="warning" dot>
      {status}
    </Badge>
  )
}

/** Renders the not-ok states of a delivery read; null once data is there. */
export function DeliveryLoad({
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
