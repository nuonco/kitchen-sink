import { useEffect, useState } from 'react'

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

export function useIntrospect<T>(path: string): Loadable<Envelope<T>> {
  const [result, setResult] = useState<Loadable<Envelope<T>>>({ state: 'loading' })

  useEffect(() => {
    let live = true
    setResult({ state: 'loading' })

    get<T>(path)
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

export interface UIConfig {
  install_id?: string
  org_id?: string
  app_id?: string
  cluster_name?: string
  region?: string
  public_domain?: string
  namespace?: string
  links: Partial<Record<'install' | 'components' | 'actions' | 'runbooks', string>>
}

const emptyConfig: UIConfig = { links: {} }

export function useUIConfig(): UIConfig {
  const [config, setConfig] = useState<UIConfig>(emptyConfig)

  useEffect(() => {
    let live = true
    fetch('/api/ui-config', { headers: { Accept: 'application/json' } })
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

export function countReady(pods: PodSummary[]): number {
  return pods.filter((pod) => {
    const statuses = pod.status?.containerStatuses ?? []
    return statuses.length > 0 && statuses.every((c) => c.ready)
  }).length
}
