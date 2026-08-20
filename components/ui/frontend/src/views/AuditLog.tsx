import { useEffect, useRef, useState } from 'react'
import {
  AUDIT_LOG_SERVICE,
  hasAuditLogExporter,
  useIntrospectPoll,
  type NamespaceResponse,
  type ServiceSummary,
  type UIConfig,
} from '../lib/api'
import { toggleableComponents } from '../lib/config-data.gen'
import {
  BackLink,
  Badge,
  Callout,
  CodeBlock,
  Eyebrow,
  Icon,
  LoadState,
  OutLink,
} from '../ui/Primitives'

/* ============================================================
   The audit-log exporter: the second toggleable component, carrying the
   commercial framing tictactoe deliberately doesn't. Same mechanic end to
   end — toggleable = true, default_enabled = false, a marker Service the
   page watches for — but this page talks the way a vendor talks to their
   own customers: entitlements, plan tiers, what turning it on buys.
   ============================================================ */

/** How often the page re-reads the namespace looking for the deploy. */
const POLL_MS = 10_000

const component = toggleableComponents.find(
  (c) => c.name === 'audit_log_exporter',
)

function Enabled({
  justDeployed,
  service,
  namespace,
}: {
  justDeployed: boolean
  service?: ServiceSummary
  namespace: string
}) {
  return (
    <section className="section">
      {justDeployed && (
        <div className="ttt-unlocked-note">
          <Badge tone="positive" dot>
            just deployed
          </Badge>
          <span>
            That was the entitlement landing: the component deployed, its
            Service appeared in the namespace, and this page noticed. No
            reload.
          </span>
        </div>
      )}
      <div className={justDeployed ? 'ttt ttt--just-unlocked entitled' : 'ttt entitled'}>
        <div className="row" style={{ marginBottom: 12 }}>
          <Badge tone="positive" dot>
            included in this install
          </Badge>
        </div>
        <p className="small" style={{ maxWidth: '70ch' }}>
          The <span className="mono">audit_log_exporter</span> component is
          switched on for this install and deployed. Everything below is read
          from the cluster, right now.
        </p>
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="data">
            <thead>
              <tr>
                <th>What introspection sees</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Service</td>
                <td className="mono">{service?.metadata?.name ?? AUDIT_LOG_SERVICE}</td>
              </tr>
              <tr>
                <td>Namespace</td>
                <td className="mono">{namespace}</td>
              </tr>
              <tr>
                <td>Type</td>
                <td className="mono">{service?.spec?.type ?? '—'}</td>
              </tr>
              <tr>
                <td>Ports</td>
                <td className="mono">
                  {(service?.spec?.ports ?? [])
                    .map((p) => `${p.port ?? '—'}/${p.protocol ?? 'TCP'}`)
                    .join(', ') || '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <Callout label="What actually got deployed">
        This demo component ships one marker Service,{' '}
        <span className="mono">{AUDIT_LOG_SERVICE}</span> — the table above is
        the app finding it through the introspection API. A real exporter would
        put its actual workload behind the same switch: the shipper pods, the
        delivery config, the lot. The entitlement mechanic you just used — one
        config, toggled per install, deployed by Nuon — is exactly the one
        you&rsquo;d ship to your own customers.
      </Callout>
    </section>
  )
}

function Locked({
  config,
  waiting,
  onDashboardOpen,
}: {
  config: UIConfig
  waiting: boolean
  onDashboardOpen: () => void
}) {
  return (
    <section className="section">
      <div className="ttt-locked">
        <span className="ttt-locked__icon">
          <Icon name="lock" />
        </span>
        <div className="ttt-locked__title">
          Audit-log exporter &middot; included in the Enterprise plan.
        </div>
        <p className="ttt-locked__body">
          Stream every operation Nuon performs in this install &mdash; deploys,
          actions, runbook runs, break-glass access &mdash; to your own SIEM,
          without the events ever leaving your cloud. That is the pitch a
          vendor makes to their customer; this tile is what the customer sees
          on a plan that doesn&rsquo;t include it. Behind it is one line of
          config: <span className="mono">toggleable = true</span>,{' '}
          <span className="mono">default_enabled = false</span> &mdash; every
          install knows the component exists, and only entitled installs run
          it. Flip it on for this install in the dashboard and deploy it
          &mdash; this page is watching the namespace and switches over the
          moment the deploy lands.
        </p>
        <div className="row" style={{ marginTop: 20 }}>
          <OutLink href={config.links.components} onClick={onDashboardOpen}>
            Open components in Nuon
          </OutLink>
          <OutLink
            href="https://docs.nuon.co/concepts/components"
            variant="secondary"
          >
            Read about components
          </OutLink>
        </div>
        <div className="ttt-watch">
          {waiting ? (
            <>
              <Badge tone="warning" dot>
                waiting for the deploy
              </Badge>
              <span>
                Toggle the component on in the dashboard tab and deploy it.
                This page re-reads the namespace every {POLL_MS / 1000} seconds
                and switches over when the exporter&rsquo;s Service appears.
              </span>
            </>
          ) : (
            <>
              <Badge tone="accent" dot>
                watching live
              </Badge>
              <span>
                Checking this namespace for the exporter&rsquo;s Service every{' '}
                {POLL_MS / 1000} seconds.
              </span>
            </>
          )}
        </div>
      </div>
      <Callout label="How this page knows">
        When enabled, the component applies a Service named{' '}
        <span className="mono">{AUDIT_LOG_SERVICE}</span>. This page lists the
        namespace&rsquo;s Services through the introspection API and did not
        find it, so you get the upsell instead of the feature &mdash; the same
        screen your customer would see.
      </Callout>
    </section>
  )
}

export function AuditLog({ config }: { config: UIConfig }) {
  const namespace = config.namespace ?? 'kitchen-sink'
  const [enabled, setEnabled] = useState(false)
  const [justEnabled, setJustEnabled] = useState(false)
  const [waiting, setWaiting] = useState(false)
  // True once the visitor has actually seen the locked pitch, so an unlock
  // detected later is a real on-screen moment rather than the initial load.
  const sawLocked = useRef(false)

  const ns = useIntrospectPoll<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
    POLL_MS,
    !enabled,
  )

  useEffect(() => {
    if (ns.state !== 'ok') return
    const found = hasAuditLogExporter(ns.value.response.services ?? [])
    if (found) {
      if (sawLocked.current) setJustEnabled(true)
      setEnabled(true)
    } else {
      sawLocked.current = true
    }
  }, [ns])

  const service =
    ns.state === 'ok'
      ? (ns.value.response.services ?? []).find(
          (svc) => svc.metadata?.name === AUDIT_LOG_SERVICE,
        )
      : undefined

  return (
    <>
      <BackLink to="/">Customize the Kitchen Sink</BackLink>
      <header className="page-header">
        <Eyebrow>Toggleable component &middot; the entitlement story</Eyebrow>
        <h1>One config, per-plan entitlements.</h1>
        <p className="lede">
          The <span className="mono">audit_log_exporter</span> component is
          how a SKU looks in a Nuon config: declared once for every install,
          deployed only where the plan includes it. This page reads the live
          cluster to find out which kind of install this one is, then behaves
          accordingly.
        </p>
      </header>

      {!enabled && <LoadState result={ns} what={`the ${namespace} namespace`} />}
      {enabled ? (
        <Enabled
          justDeployed={justEnabled}
          service={service}
          namespace={namespace}
        />
      ) : (
        ns.state === 'ok' && (
          <Locked
            config={config}
            waiting={waiting}
            onDashboardOpen={() => setWaiting(true)}
          />
        )
      )}

      {component && (
        <CodeBlock
          label="components/audit_log_exporter.toml (the real config, comments stripped)"
          code={component.toml}
        />
      )}

      <Callout label="The other toggleable component">
        This app ships two of these. The other one is less businesslike &mdash;
        go find it on the hub.
      </Callout>
    </>
  )
}
