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
import { stepEyebrow } from '../lib/taxonomy'
import { useMarkStepSeen } from '../lib/progress'
import { StepNav } from '../ui/CapabilityGrid'
import {
  BackLink,
  Badge,
  Callout,
  CodeBlock,
  Eyebrow,
  LoadState,
  OutLink,
  PspSection,
  PspTag,
} from '../ui/Primitives'

/* ============================================================
   The audit-log exporter: the second toggleable component, carrying the
   commercial framing tictactoe deliberately doesn't. Same mechanic end to
   end — toggleable = true, default_enabled = false, a marker Service this
   page watches for — shown as an entitlement card, not a paragraph.
   ============================================================ */

/** How often the page re-reads the namespace looking for the deploy. */
const POLL_MS = 10_000

const component = toggleableComponents.find(
  (c) => c.name === 'audit_log_exporter',
)

/** The plan/toggle state, drawn: one card, one switch, one badge. */
function EntitlementCard({ on }: { on: boolean }) {
  return (
    <div className={on ? 'ent ent--on' : 'ent'}>
      <div className="ent__head">
        <span className="ent__plan">Enterprise plan</span>
        <span
          className={on ? 'switch switch--on' : 'switch'}
          aria-hidden="true"
        />
      </div>
      <div className="ent__name mono">audit_log_exporter</div>
      <p className="ent__pitch">
        Streams every operation Nuon performs in this install to your SIEM.
        Events never leave your cloud.
      </p>
      <div className="ent__foot">
        {on ? (
          <Badge tone="positive" dot>
            included in this install
          </Badge>
        ) : (
          <Badge tone="warning" dot>
            not in this install&rsquo;s plan
          </Badge>
        )}
        <span className="ent__facts mono">
          toggleable = true · default_enabled = false
        </span>
      </div>
    </div>
  )
}

/** The mechanism, as three beats instead of a paragraph. */
function HowItKnows({
  config,
  namespace,
  onDashboardOpen,
}: {
  config: UIConfig
  namespace: string
  onDashboardOpen?: () => void
}) {
  const beats = [
    {
      label: 'toggle',
      detail: 'component on, in the dashboard',
      href: config.links.components,
    },
    { label: 'deploy', detail: `Nuon applies ${AUDIT_LOG_SERVICE}` },
    { label: 'detect', detail: `this page re-reads ${namespace} every ${POLL_MS / 1000}s` },
  ]
  return (
    <div className="ship" style={{ marginTop: 16 }}>
      {beats.map((beat, i) => {
        const body = (
          <>
            <span className="ship__num">0{i + 1}</span>
            <span className="ship__label">{beat.label}</span>
            <span className="ship__detail mono">{beat.detail}</span>
          </>
        )
        return beat.href ? (
          <a
            key={beat.label}
            className="ship__beat ship__beat--link"
            href={beat.href}
            target="_blank"
            rel="noreferrer"
            onClick={onDashboardOpen}
          >
            {body}
          </a>
        ) : (
          <span key={beat.label} className="ship__beat">
            {body}
          </span>
        )
      })}
    </div>
  )
}

export function AuditLog({ config }: { config: UIConfig }) {
  useMarkStepSeen('/audit-log')
  const namespace = config.namespace ?? 'kitchen-sink'
  const [enabled, setEnabled] = useState(false)
  const [justEnabled, setJustEnabled] = useState(false)
  const [waiting, setWaiting] = useState(false)
  // True once the visitor has actually seen the locked state, so an unlock
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

  const service: ServiceSummary | undefined =
    ns.state === 'ok'
      ? (ns.value.response.services ?? []).find(
          (svc) => svc.metadata?.name === AUDIT_LOG_SERVICE,
        )
      : undefined

  const ready = enabled || ns.state === 'ok'

  return (
    <>
      <BackLink to="/">Customize the Kitchen Sink</BackLink>
      <header className="page-header">
        <Eyebrow>{stepEyebrow('/audit-log')}</Eyebrow>
        <h1>Sell an entitlement</h1>
        <p className="lede psp-lede">
          <PspTag kind="problem" /> One plan tier includes a feature the
          others don&rsquo;t, and every install runs the same config.
        </p>
      </header>

      {!enabled && (
        <LoadState result={ns} what={`the ${namespace} namespace`} />
      )}

      {ready && (
        <>
          <PspSection
            kind="solution"
            title="A toggleable component"
            aside="components/audit_log_exporter.toml"
          >
            <div className={justEnabled ? 'ttt--just-unlocked' : undefined}>
              {justEnabled && (
                <div className="ttt-unlocked-note">
                  <Badge tone="positive" dot>
                    just deployed
                  </Badge>
                  <span>
                    The component deployed, its Service appeared in the
                    namespace, and this page noticed. No reload.
                  </span>
                </div>
              )}
              <EntitlementCard on={enabled} />
            </div>
            {component && (
              <CodeBlock
                label="the real config, comments stripped"
                code={component.toml}
              />
            )}
          </PspSection>

          <PspSection
            kind="proof"
            title={enabled ? 'What introspection sees' : 'Flip it on and watch'}
            aside={`GET /introspect/namespace/${namespace}`}
          >
            <HowItKnows
              config={config}
              namespace={namespace}
              onDashboardOpen={enabled ? undefined : () => setWaiting(true)}
            />
            {enabled ? (
              <>
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
                        <td className="mono">
                          {service?.metadata?.name ?? AUDIT_LOG_SERVICE}
                        </td>
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
                <Callout label="What actually got deployed">
                  One marker Service; the table above is the app finding it. A
                  real exporter puts its workload behind the same switch.
                </Callout>
              </>
            ) : (
              <>
                <div className="row" style={{ marginTop: 20 }}>
                  <OutLink
                    href={config.links.components}
                    onClick={() => setWaiting(true)}
                  >
                    Open components in Nuon
                  </OutLink>
                </div>
                <div className="ttt-watch">
                  {waiting ? (
                    <>
                      <Badge tone="warning" dot>
                        waiting for the deploy
                      </Badge>
                      <span>
                        Toggle the component on in the dashboard tab and
                        deploy it; this page switches over when the Service
                        appears.
                      </span>
                    </>
                  ) : (
                    <>
                      <Badge tone="accent" dot>
                        watching live
                      </Badge>
                      <span>
                        Checking this namespace for the exporter&rsquo;s
                        Service every {POLL_MS / 1000} seconds.
                      </span>
                    </>
                  )}
                </div>
              </>
            )}
          </PspSection>
        </>
      )}
      <StepNav current="/audit-log" />
    </>
  )
}
