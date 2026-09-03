import { useEffect, useState } from 'react'
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
  return services.some((svc) => svc.metadata?.name === 'kitchen-sink-tictactoe')
}

/** The marker Service name the toggleable `audit_log_exporter` deploys. */
export const AUDIT_LOG_SERVICE = 'kitchen-sink-audit-log-exporter'

/**
 * Same mechanic as hasTicTacToe, for the audit-log exporter: the toggleable
 * component deploys one marker Service, and its presence in the namespace is
 * how the UI knows the entitlement is switched on for this install.
 */
export function hasAuditLogExporter(services: ServiceSummary[]): boolean {
  return services.some((svc) => svc.metadata?.name === AUDIT_LOG_SERVICE)
}

/** "sha-45200f2" from a full image reference; "latest" when untagged. */
export function imageTag(image?: string): string {
  if (!image) return '—'
  const tail = image.split('/').pop() ?? image
  const i = tail.lastIndexOf(':')
  return i === -1 ? 'latest' : tail.slice(i + 1)
}

/** The distinct image tags running in a namespace, first container of each pod. */
export function runningImageTags(pods: PodSummary[]): string[] {
  const tags = pods.map((pod) =>
    imageTag(
      pod.status?.containerStatuses?.[0]?.image ??
        pod.spec?.containers?.[0]?.image,
    ),
  )
  return Array.from(new Set(tags.filter((t) => t !== '—')))
}

export function countReady(pods: PodSummary[]): number {
  return pods.filter((pod) => {
    const statuses = pod.status?.containerStatuses ?? []
    return statuses.length > 0 && statuses.every((c) => c.ready)
  }).length
}
