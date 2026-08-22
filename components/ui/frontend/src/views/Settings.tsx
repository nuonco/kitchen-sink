import { useEffect, useRef, useState } from 'react'
import {
  AUDIT_LOG_SERVICE,
  hasAuditLogExporter,
  hasTicTacToe,
  useIntrospectPoll,
  type NamespaceResponse,
  type ServiceSummary,
  type UIConfig,
} from '../lib/api'
import { toggleableComponents } from '../lib/config-data.gen'
import { EntitlementPanel } from '../ui/EntitlementPanel'
import { Badge, OutLink, PageHeader, Section } from '../ui/Primitives'

/* ============================================================
   A read-only console's settings: facts and entitlements, not forms.
   Instance identity from ui-config, one entitlement row per toggleable
   component (live marker detection — the tictactoe row exists only while
   its marker Service does), and the security boundary stated as policy.
   ============================================================ */

/** How often the page re-reads the namespace while any toggleable is off. */
const MARKER_POLL_MS = 20_000

function Instance({ config }: { config: UIConfig }) {
  const facts: Array<[string, string | undefined]> = [
    ['install id', config.install_id],
    ['org id', config.org_id],
    ['app id', config.app_id],
    ['cluster', config.cluster_name],
    ['region', config.region],
    ['domain', config.public_domain],
    ['namespace', config.namespace],
  ]
  const known = facts.filter(([, v]) => v)
  return (
    <Section title="Instance" aside="/api/ui-config">
      {known.length > 0 && (
        <dl className="kv">
          {known.map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {config.links.versions && (
        <p className="small" style={{ marginTop: 16 }}>
          <OutLink href={config.links.versions} variant="plain">
            Config versions
          </OutLink>
        </p>
      )}
    </Section>
  )
}

function Entitlements({ config }: { config: UIConfig }) {
  const namespace = config.namespace ?? 'periscope'
  const install = config.install_id ?? '<your-install-id>'

  const [siemOn, setSiemOn] = useState(false)
  const [siemJustOn, setSiemJustOn] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [tictactoeOn, setTictactoeOn] = useState(false)
  const sawSiemOff = useRef(false)

  const ns = useIntrospectPoll<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
    MARKER_POLL_MS,
    !(siemOn && tictactoeOn),
  )

  useEffect(() => {
    if (ns.state !== 'ok') return
    const services = ns.value.response.services ?? []
    if (hasAuditLogExporter(services)) {
      if (sawSiemOff.current) setSiemJustOn(true)
      setSiemOn(true)
    } else {
      sawSiemOff.current = true
    }
    setTictactoeOn(hasTicTacToe(services))
  }, [ns])

  const service: ServiceSummary | undefined =
    ns.state === 'ok'
      ? (ns.value.response.services ?? []).find(
          (svc) => svc.metadata?.name === AUDIT_LOG_SERVICE,
        )
      : undefined

  const tictactoe = toggleableComponents.find((c) => c.name === 'tictactoe')

  return (
    <Section title="Entitlements" aside="toggleable components, detected live">
      <EntitlementPanel
        title="Enterprise plan"
        componentName="audit_log_exporter"
        on={siemOn}
        justEnabled={siemJustOn}
        waiting={waiting}
        onDashboardOpen={() => setWaiting(true)}
        dashboardHref={
          config.links.audit_log_exporter ?? config.links.components
        }
        cli={`nuon installs components toggle -i ${install} -c audit_log_exporter --enable`}
        pitch={
          <>
            Streams the <a href="#/events">events feed</a> to your SIEM.
            Available on the Enterprise plan.
          </>
        }
        proof={
          <>
            One marker Service &mdash;{' '}
            <span className="mono">
              {service?.metadata?.name ?? AUDIT_LOG_SERVICE}
            </span>
            {service?.spec?.type ? ` (${service.spec.type})` : ''}. The export
            state also shows on <a href="#/events">Events</a>, at its point of
            use.
          </>
        }
        pollSeconds={MARKER_POLL_MS / 1000}
      />
      {tictactoeOn && tictactoe && (
        <div className="ent ent--on ent--panel" style={{ marginTop: 16 }}>
          <div className="ent__head">
            <span className="ent__plan">Custom feature</span>
            <span className="entstat mono" role="status">
              <span className="entstat__dot entstat__dot--on" aria-hidden="true" />
              on
            </span>
          </div>
          <div className="ent__name mono">{tictactoe.name}</div>
          <div className="ent__foot">
            <Badge tone="positive" dot>
              Enabled on this install
            </Badge>
            <a href="#/tictactoe">Open it</a>
          </div>
        </div>
      )}
    </Section>
  )
}

function SecurityBoundary({ config }: { config: UIConfig }) {
  const namespace = config.namespace ?? 'periscope'
  const paths = [
    '/introspect/kube',
    '/introspect/helm',
    '/introspect/env',
    `/introspect/namespace/${namespace}`,
    `/introspect/namespace/${namespace}/events`,
  ]
  return (
    <Section title="Security boundary" aside="apifilter, in the web pod">
      <p className="small muted" style={{ maxWidth: '76ch' }}>
        This console sits on the install&rsquo;s internet-facing load
        balancer, so its proxy forwards only the five introspection endpoints
        these screens read. Secret values are stripped server-side, before a
        response leaves the cluster. A response the proxy cannot parse is
        never forwarded &mdash; it fails closed.
      </p>
      <ul className="mono small" style={{ marginTop: 16, paddingLeft: 20 }}>
        {paths.map((p) => (
          <li key={p} style={{ marginBottom: 4 }}>
            {p}
          </li>
        ))}
      </ul>
    </Section>
  )
}

export function Settings({ config }: { config: UIConfig }) {
  return (
    <>
      <PageHeader
        title="Settings"
        lede="A read-only console: settings here are facts, not forms."
      />
      <Instance config={config} />
      <Entitlements config={config} />
      <SecurityBoundary config={config} />
    </>
  )
}
