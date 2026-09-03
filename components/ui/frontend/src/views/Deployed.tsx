import type { ReactNode } from 'react'
import {
  countReady,
  useIntrospect,
  type Envelope,
  type KubeResponse,
  type Loadable,
  type NamespaceResponse,
  type UIConfig,
} from '../lib/api'
import { branchName, installGroups } from '../lib/config-data.gen'
import { stepEyebrow } from '../lib/taxonomy'
import { useMarkStepSeen } from '../lib/progress'
import { StepNav } from '../ui/CapabilityGrid'
import { BackLink, Eyebrow, LoadState, Mono, OutLink, Section } from '../ui/Primitives'

/**
 * Which namespaces this app config put in the cluster, as opposed to the
 * sandbox's and Kubernetes' own. Feeds the glance tile's split.
 */
function isAppNamespace(
  name: string | undefined,
  installID: string | undefined,
): boolean {
  if (!name) return false
  if (name === 'kitchen-sink' || name === 'nuon') return true
  return Boolean(installID && name === `${installID}-dne`)
}

type KubeResult = Loadable<Envelope<KubeResponse>>
type NsResult = Loadable<Envelope<NamespaceResponse>>

function GlanceFact({
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
      <div className={numeric ? 'fact__value fact__value--num' : 'fact__value'}>
        {value ?? '…'}
      </div>
      {note && <div className="fact__note">{note}</div>}
    </div>
  )
}

/** "api :8080 · ui :80", trimmed for a tile note. */
function servingNote(data: NamespaceResponse): string {
  return (data.services ?? [])
    .map((svc) => {
      const name = svc.metadata?.name?.replace(/^kitchen-sink-/, '') ?? '?'
      const port = svc.spec?.ports?.[0]?.port
      return port ? `${name} :${port}` : name
    })
    .join(' · ')
}

/* ============================================================
   The whole live read, as four facts from two introspection calls made as
   the page loads.
   ============================================================ */

function Glance({
  kube,
  ns,
  namespace,
  installID,
}: {
  kube: KubeResult
  ns: NsResult
  namespace: string
  installID?: string
}) {
  const nsData = ns.state === 'ok' ? ns.value.response : undefined
  const pods = nsData?.pods ?? []
  const kubeRows =
    kube.state === 'ok' ? (kube.value.response.namespaces ?? []) : undefined
  const appRows = kubeRows?.filter((row) => isAppNamespace(row.name, installID))
  const thisNs = kubeRows?.find((row) => row.name === namespace)

  return (
    <div className="facts" style={{ marginTop: 0 }}>
      <GlanceFact
        label="Pods ready"
        value={nsData ? `${countReady(pods)} of ${pods.length}` : undefined}
        note={`in ${namespace}`}
        numeric
      />
      <GlanceFact
        label="Serving"
        value={nsData ? `${(nsData.services ?? []).length} services` : undefined}
        note={nsData ? servingNote(nsData) : undefined}
        numeric
      />
      <GlanceFact
        label="This app's namespace"
        value={kubeRows ? namespace : undefined}
        note={thisNs?.status?.phase ?? undefined}
      />
      <GlanceFact
        label="Namespaces in the cluster"
        value={kubeRows ? String(kubeRows.length) : undefined}
        note={
          kubeRows && appRows
            ? `${appRows.length} from this install · ${kubeRows.length - appRows.length} infrastructure`
            : undefined
        }
        numeric
      />
      <GlanceFact
        label="Deployed by branch"
        value={branchName}
        note={installGroups.map((g) => g.name).join(' → ')}
      />
    </div>
  )
}

/* ============================================================
   The point of the page: not the inventory, but what the install's shape
   shows. Four patterns, all real, each worked for real elsewhere in the app.
   ============================================================ */

function Patterns({ namespace }: { namespace: string }) {
  const patterns: Array<{ name: string; note: ReactNode }> = [
    {
      name: 'One chart, one namespace',
      note: (
        <>
          The <Mono>kitchen_sink</Mono> Helm component runs the api, the
          worker, and this UI in <Mono>{namespace}</Mono> — the pods counted
          above.
        </>
      ),
    },
    {
      name: 'Many services, one domain',
      note: (
        <>
          A Terraform module issues the certificate, a second chart runs the
          ALB in front of every service, deployed in dependency order.
        </>
      ),
    },
    {
      name: 'Injected config and secrets',
      note: (
        <>
          Nuon templates install values into the chart at deploy time and
          syncs its secrets into the namespace as Kubernetes Secrets.
        </>
      ),
    },
    {
      name: 'Entitlement-gated components',
      note: (
        <>
          <Mono>audit_log_exporter</Mono> and <Mono>tictactoe</Mono> deploy
          only where they are toggled on; their marker Services here are how
          this app notices.
        </>
      ),
    },
  ]

  return (
    <Section title="The patterns it demonstrates" aside="components/*.toml">
      <div className="groups">
        {patterns.map((p) => (
          <div className="group-card" key={p.name}>
            <div className="group-card__head">
              <span className="group-card__name">{p.name}</span>
            </div>
            <div className="group-card__note">{p.note}</div>
          </div>
        ))}
      </div>
    </Section>
  )
}

export function Deployed({ config }: { config: UIConfig }) {
  const namespace = config.namespace ?? 'kitchen-sink'
  const kube = useIntrospect<KubeResponse>('/api/introspect/kube')
  const ns = useIntrospect<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
  )

  useMarkStepSeen('/deployed')

  return (
    <>
      <BackLink to="/">Customize the Kitchen Sink</BackLink>
      <header className="page-header">
        <Eyebrow>{stepEyebrow('/deployed')}</Eyebrow>
        <h1>What did Nuon actually deploy?</h1>
        <p className="lede">
          Live reads from this install, and the architecture they demonstrate
          — the rest of the checklist goes deeper on each piece.
        </p>
      </header>

      <Glance kube={kube} ns={ns} namespace={namespace} installID={config.install_id} />
      {config.links.versions && (
        <p className="small muted" style={{ marginTop: 12, maxWidth: '72ch' }}>
          Every config version this install has run is on record.{' '}
          <OutLink href={config.links.versions} variant="plain">
            See its config versions
          </OutLink>
        </p>
      )}
      <LoadState result={kube} what="the cluster" />
      {kube.state === 'ok' && (
        <LoadState result={ns} what={`the ${namespace} namespace`} />
      )}

      <Patterns namespace={namespace} />
      <StepNav current="/deployed" />
    </>
  )
}
