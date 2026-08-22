import { useCallback, useEffect, useState } from 'react'
import { trackBoot } from './boot'

/** Every introspection endpoint wraps its payload the same way. */
export interface Envelope<T> {
  description: string
  response: T
}

/** The shape the API uses for handler errors. */
interface ErrEnvelope {
  description?: string
  err?: string
}

export type Loadable<T> =
  | { state: 'loading' }
  | { state: 'error'; message: string; unreachable: boolean }
  | { state: 'ok'; value: T }

/** An error the UI can explain, rather than a bare "Failed to fetch". */
class ApiError extends Error {
  /** True when the API never answered, as opposed to answering with an error. */
  readonly unreachable: boolean

  constructor(message: string, unreachable: boolean) {
    super(message)
    this.unreachable = unreachable
  }
}

async function get<T>(path: string): Promise<Envelope<T>> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } })
  const text = await res.text()

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const parsed = JSON.parse(text) as ErrEnvelope
      if (parsed.err) detail = parsed.err
    } catch {
      if (text.trim()) detail = text.trim().slice(0, 400)
    }
    // 502/503/504 come from this app's own proxy, which means it could not get
    // an answer out of the API at all.
    throw new ApiError(detail, res.status >= 502 && res.status <= 504)
  }

  return JSON.parse(text) as Envelope<T>
}

/**
 * Like useIntrospect, but keeps the value fresh: while `active` is true and
 * the tab is visible, the endpoint is re-fetched every `intervalMs`. Refreshes
 * are silent -- once a value has loaded, a failed refresh keeps the last good
 * value rather than flashing an error. This is how the UI notices cluster
 * changes (a toggleable component deploying) without a manual reload; flip
 * `active` to false once the thing being watched has happened.
 */
export function useIntrospectPoll<T>(
  path: string,
  intervalMs: number,
  active: boolean,
): Loadable<Envelope<T>> {
  const [result, setResult] = useState<Loadable<Envelope<T>>>({ state: 'loading' })

  useEffect(() => {
    let live = true
    let inFlight = false

    const refresh = (first: boolean) => {
      if (inFlight) return
      inFlight = true
      const fetched = get<T>(path)
      // Only the very first fetch takes part in the boot overlay.
      ;(first ? trackBoot(fetched) : fetched)
        .then((value) => {
          if (live) setResult({ state: 'ok', value })
        })
        .catch((err: unknown) => {
          if (!live) return
          setResult((prev) => {
            if (prev.state === 'ok') return prev // silent refresh failure
            const message = err instanceof Error ? err.message : String(err)
            return {
              state: 'error',
              message,
              unreachable:
                err instanceof TypeError || (err as ApiError)?.unreachable === true,
            }
          })
        })
        .finally(() => {
          inFlight = false
        })
    }

    refresh(true)

    if (!active) return () => {
      live = false
    }

    const tick = () => {
      if (document.visibilityState === 'visible') refresh(false)
    }
    const timer = window.setInterval(tick, intervalMs)
    // A backgrounded tab skips ticks; catch up the moment it is visible again.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh(false)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      live = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [path, intervalMs, active])

  return result
}

export function useIntrospect<T>(path: string): Loadable<Envelope<T>> {
  const [result, setResult] = useState<Loadable<Envelope<T>>>({ state: 'loading' })

  useEffect(() => {
    let live = true
    setResult({ state: 'loading' })

    trackBoot(get<T>(path))
      .then((value) => {
        if (live) setResult({ state: 'ok', value })
      })
      .catch((err: unknown) => {
        if (!live) return
        const message = err instanceof Error ? err.message : String(err)
        // A TypeError from fetch means the request never completed at all -- the
        // pod went away mid-response. That reads very differently from an
        // endpoint returning an error, so the views explain it differently.
        setResult({
          state: 'error',
          message,
          unreachable: err instanceof TypeError || (err as ApiError)?.unreachable === true,
        })
      })

    return () => {
      live = false
    }
  }, [path])

  return result
}

/* ============================================================
   Response types. Only the fields the views read are modelled; the raw JSON
   disclosure renders whatever else came back.
   ============================================================ */

export interface KubeResponse {
  namespaces: Array<{
    name: string
    status?: { phase?: string }
  }>
}

export interface PodSummary {
  metadata?: { name?: string; creationTimestamp?: string }
  spec?: { nodeName?: string; containers?: Array<{ name?: string; image?: string }> }
  status?: {
    phase?: string
    containerStatuses?: Array<{
      name?: string
      ready?: boolean
      restartCount?: number
      image?: string
    }>
  }
}

export interface ServiceSummary {
  metadata?: { name?: string }
  spec?: {
    type?: string
    clusterIP?: string
    ports?: Array<{ port?: number; targetPort?: number | string; protocol?: string }>
  }
}

export interface SecretSummary {
  metadata?: { name?: string }
  type?: string
  data?: Record<string, string>
}

export interface NamespaceResponse {
  name: string
  pods_count: number
  pods: PodSummary[]
  services_count: number
  services: ServiceSummary[]
  secrets_count: number
  secrets: SecretSummary[]
}

/** One Kubernetes event, as GET /introspect/namespace/:ns/events returns it. */
export interface NamespaceEvent {
  type?: string
  reason?: string
  message?: string
  count?: number
  firstTimestamp?: string | null
  lastTimestamp?: string | null
  involvedObject?: { kind?: string; name?: string }
}

export interface NamespaceEventsResponse {
  name: string
  events_count: number
  events: NamespaceEvent[]
}

export interface HelmRelease {
  name?: string
  namespace?: string
  version?: number
  info?: {
    status?: string
    last_deployed?: string
    description?: string
  }
  chart_metadata?: { name?: string; version?: string; appVersion?: string }
}

export interface HelmResponse {
  Charts: Record<string, HelmRelease>
}

export type EnvResponse = Record<string, string>

/* ============================================================
   Runtime config served by the Go server, not the introspection API.
   ============================================================ */

/**
 * Deep links into the Nuon dashboard, built server-side (main.go) from the
 * install's own org/app/install ids. The frontend never constructs dashboard
 * URLs; it renders whichever of these it received and hides the rest.
 */
export type DashboardLink =
  | 'install' // the install's overview page
  | 'components' // the install's components (toggle lives here)
  | 'audit_log_exporter' // the audit_log_exporter component's own page on this install
  | 'actions' // action workflows + run history
  | 'runbooks' // runbooks + per-run transcripts
  | 'workflows' // deploy/provision workflow history, incl. approvals
  | 'versions' // the install's app-config version history
  | 'branches' // the app's branches: staged rollout runs + pending approvals
  | 'tokens' // org API tokens (CLI / agent setup)

export interface UIConfig {
  install_id?: string
  org_id?: string
  app_id?: string
  cluster_name?: string
  region?: string
  public_domain?: string
  namespace?: string
  links: Partial<Record<DashboardLink, string>>
}

const emptyConfig: UIConfig = { links: {} }

export function useUIConfig(): UIConfig {
  const [config, setConfig] = useState<UIConfig>(emptyConfig)

  useEffect(() => {
    let live = true
    trackBoot(fetch('/api/ui-config', { headers: { Accept: 'application/json' } }))
      .then((res) => (res.ok ? res.json() : emptyConfig))
      .then((value: UIConfig) => {
        if (live) setConfig({ ...value, links: value.links ?? {} })
      })
      .catch(() => {
        // Local dev without the server, or an old image. The views hide any
        // fact and any link they did not receive.
      })
    return () => {
      live = false
    }
  }, [])

  return config
}

/**
 * The marker Service the toggleable `tictactoe` component deploys. Its
 * presence in the namespace is how the UI knows that component is enabled on
 * this install.
 */
export function hasTicTacToe(services: ServiceSummary[]): boolean {
  return services.some((svc) => svc.metadata?.name === 'relay-tictactoe')
}

/** The marker Service name the toggleable `audit_log_exporter` deploys. */
export const AUDIT_LOG_SERVICE = 'relay-audit-log-exporter'

/**
 * Same mechanic as hasTicTacToe, for the audit-log exporter: the toggleable
 * component deploys one marker Service, and its presence in the namespace is
 * how the UI knows the entitlement is switched on for this install.
 */
export function hasAuditLogExporter(services: ServiceSummary[]): boolean {
  return services.some((svc) => svc.metadata?.name === AUDIT_LOG_SERVICE)
}

export function countReady(pods: PodSummary[]): number {
  return pods.filter((pod) => {
    const statuses = pod.status?.containerStatuses ?? []
    return statuses.length > 0 && statuses.every((c) => c.ready)
  }).length
}

/* ============================================================
   The delivery API: Relay's own data, served by relay-api and forwarded by
   this app's proxy. Unlike the introspection endpoints these responses are
   not enveloped, and the store connects in the background after the api pod
   starts, answering 503 until Postgres is reachable — a state worth naming
   in the UI rather than reporting as an error.
   ============================================================ */

export interface DeliveryStats {
  events_24h: number
  delivered_24h: number
  /** 0..1 over attempts resolved in the last 24h. */
  success_rate: number
  dlq_depth: number
  endpoints_active: number
}

export interface DeliveryEndpoint {
  id: string
  name: string
  url: string
  active: boolean
  created_at: string
}

export type DeliveryEventStatus = 'pending' | 'delivered' | 'dead'

export interface DeliveryEvent {
  id: string
  type: string
  payload: unknown
  status: DeliveryEventStatus
  created_at: string
}

export type DeliveryAttemptStatus = 'pending' | 'success' | 'failed' | 'dead'

export interface DeliveryAttempt {
  id: string
  event_id: string
  endpoint_id: string
  attempt_number: number
  status: DeliveryAttemptStatus
  /** null until the attempt resolves; 0 means a connection error. */
  response_code: number | null
  latency_ms: number | null
  next_retry_at: string | null
  created_at: string
  event_type: string
  endpoint_name: string
  endpoint_url: string
}

export type DeliveryLoadable<T> =
  | { state: 'loading' }
  /** The api answered 503: Postgres is still coming up. Normal on a fresh
      deploy; the store self-heals and the next poll gets data. */
  | { state: 'starting' }
  | { state: 'error'; message: string }
  | { state: 'ok'; value: T }

class StoreStartingError extends Error {}

async function deliveryGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } })
  const text = await res.text()
  if (res.status === 503) throw new StoreStartingError()
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const parsed = JSON.parse(text) as ErrEnvelope
      if (parsed.err) detail = parsed.err
    } catch {
      if (text.trim()) detail = text.trim().slice(0, 400)
    }
    throw new Error(detail)
  }
  return JSON.parse(text) as T
}

/**
 * Reads a delivery endpoint and keeps it fresh while the tab is visible.
 * Returns the result plus a refresh function for the moment right after a
 * replay, when waiting out the poll interval would feel broken.
 */
export function useDelivery<T>(
  path: string,
  intervalMs: number,
): [DeliveryLoadable<T>, () => void] {
  const [result, setResult] = useState<DeliveryLoadable<T>>({ state: 'loading' })
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    let live = true
    let inFlight = false

    const refresh = (first: boolean) => {
      if (inFlight) return
      inFlight = true
      const fetched = deliveryGet<T>(path)
      ;(first ? trackBoot(fetched) : fetched)
        .then((value) => {
          if (live) setResult({ state: 'ok', value })
        })
        .catch((err: unknown) => {
          if (!live) return
          if (err instanceof StoreStartingError) {
            setResult((prev) =>
              prev.state === 'ok' ? prev : { state: 'starting' },
            )
            return
          }
          setResult((prev) => {
            if (prev.state === 'ok') return prev // silent refresh failure
            const message = err instanceof Error ? err.message : String(err)
            return { state: 'error', message }
          })
        })
        .finally(() => {
          inFlight = false
        })
    }

    refresh(refreshTick === 0)

    const tick = () => {
      if (document.visibilityState === 'visible') refresh(false)
    }
    const timer = window.setInterval(tick, intervalMs)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh(false)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      live = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [path, intervalMs, refreshTick])

  const refreshNow = useCallback(() => setRefreshTick((n) => n + 1), [])
  return [result, refreshNow]
}

/** One-shot read, for on-demand loads like an event's attempt timeline. */
export async function fetchDelivery<T>(path: string): Promise<T> {
  return deliveryGet<T>(path)
}

/**
 * Replays one dead attempt: the only write this app's proxy forwards. The
 * server re-queues the delivery (a real new attempt, due immediately) and the
 * dead attempt leaves the DLQ.
 */
export async function replayAttempt(
  id: string,
): Promise<{ replayed: boolean; attempt: DeliveryAttempt }> {
  const res = await fetch(`/api/delivery/dlq/${encodeURIComponent(id)}/replay`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  })
  const text = await res.text()
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const parsed = JSON.parse(text) as ErrEnvelope
      if (parsed.err) detail = parsed.err
    } catch {
      // keep the status line
    }
    throw new Error(detail)
  }
  return JSON.parse(text) as { replayed: boolean; attempt: DeliveryAttempt }
}
