import {
  countReady,
  imageTag,
  useIntrospect,
  type KubeResponse,
  type NamespaceResponse,
} from '../../lib/api'
import type { PanelProps } from '../../lib/panels'
import { Badge, LoadState, PhaseBadge } from '../Primitives'
import { PanelPrompts, podAge, useNamespacePoll } from './shared'

/* ============================================================
   workloads: what is running in this install's namespace, read live.
   From the old "What Nuon deployed" page.
   ============================================================ */

/** Which namespaces this app config put in the cluster, as opposed to the
    sandbox's and Kubernetes' own. */
function isAppNamespace(name: string | undefined, installID: string | undefined): boolean {
  if (!name) return false
  if (name === 'kitchen-sink' || name === 'nuon') return true
  return Boolean(installID && name === `${installID}-dne`)
}

function Fact({
  label,
  value,
  note,
  numeric = false,
}: {
  label: string
  value?: string
  note?: string
  numeric?: boolean
}) {
  return (
    <div className={value ? 'fact' : 'fact fact--pending'}>
      <div className="fact__label">{label}</div>
      <div className={numeric ? 'fact__value fact__value--num' : 'fact__value'}>{value ?? '…'}</div>
      {note && <div className="fact__note">{note}</div>}
    </div>
  )
}

/** "api :8080 · ui :3000", for a tile note. */
function servingNote(data: NamespaceResponse): string {
  return (data.services ?? [])
    .map((svc) => {
      const name = svc.metadata?.name?.replace(/^kitchen-sink-/, '') ?? '?'
      const port = svc.spec?.ports?.[0]?.port
      return port ? `${name} :${port}` : name
    })
    .join(' · ')
}

export function WorkloadsTile({ config }: PanelProps) {
  const { namespace, ns } = useNamespacePoll(config, 20_000)
  const pods = ns.state === 'ok' ? (ns.value.response.pods ?? []) : []
  return (
    <>
      <span className="ptile__value">
        {ns.state === 'ok' ? `${countReady(pods)} of ${pods.length} pods ready` : 'reading pods…'}
      </span>
      <span className="ptile__label mono">namespace {namespace}</span>
    </>
  )
}

export function WorkloadsDrawer({ config }: PanelProps) {
  const { namespace, ns } = useNamespacePoll(config)
  const kube = useIntrospect<KubeResponse>('/api/introspect/kube')
  const nsData = ns.state === 'ok' ? ns.value.response : undefined
  const pods = nsData?.pods ?? []
  const kubeRows = kube.state === 'ok' ? (kube.value.response.namespaces ?? []) : undefined
  const appRows = kubeRows?.filter((row) => isAppNamespace(row.name, config.install_id))
  const thisNs = kubeRows?.find((row) => row.name === namespace)

  return (
    <>
      <div className="facts" style={{ marginTop: 0 }}>
        <Fact
          label="Pods ready"
          value={nsData ? `${countReady(pods)} of ${pods.length}` : undefined}
          note={`in ${namespace}`}
          numeric
        />
        <Fact
          label="Serving"
          value={nsData ? `${(nsData.services ?? []).length} services` : undefined}
          note={nsData ? servingNote(nsData) : undefined}
          numeric
        />
        <Fact
          label="This app’s namespace"
          value={kubeRows ? namespace : undefined}
          note={thisNs?.status?.phase ?? undefined}
        />
        <Fact
          label="Namespaces in the cluster"
          value={kubeRows ? String(kubeRows.length) : undefined}
          note={
            kubeRows && appRows
              ? `${appRows.length} from this install · ${kubeRows.length - appRows.length} infrastructure`
              : undefined
          }
          numeric
        />
      </div>
      <LoadState result={kube} what="the cluster" />
      <LoadState result={ns} what={`the ${namespace} namespace`} />

      {ns.state === 'ok' && (
        <section className="section">
          <div className="section__head">
            <h3 className="section__title">Pods in {namespace}</h3>
            <div className="subtext muted">
              GET /api/introspect/namespace/{namespace} · re-read every 10s
            </div>
          </div>
          <div className="row" style={{ marginBottom: 12 }}>
            <Badge tone="positive" dot>
              live
            </Badge>
            <Badge tone="accent">
              {countReady(pods)} of {pods.length} pods ready
            </Badge>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Pod</th>
                  <th>Image tag</th>
                  <th>Age</th>
                  <th>Phase</th>
                  <th>Restarts</th>
                </tr>
              </thead>
              <tbody>
                {pods.map((pod, i) => {
                  const statuses = pod.status?.containerStatuses ?? []
                  const image = statuses[0]?.image ?? pod.spec?.containers?.[0]?.image
                  const restarts = statuses.reduce((sum, c) => sum + (c.restartCount ?? 0), 0)
                  return (
                    <tr key={pod.metadata?.name ?? i}>
                      <td className="mono">{pod.metadata?.name}</td>
                      <td className="mono subtext">{imageTag(image)}</td>
                      <td className="mono subtext">{podAge(pod.metadata?.creationTimestamp)}</td>
                      <td>
                        <PhaseBadge phase={pod.status?.phase} />
                      </td>
                      <td>{restarts}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <PanelPrompts panel="workloads" config={config} />
    </>
  )
}
