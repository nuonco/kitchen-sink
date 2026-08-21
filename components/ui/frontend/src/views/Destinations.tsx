import { useEffect, useRef, useState } from 'react'
import {
  COMPLIANCE_EXPORT_SERVICE,
  hasComplianceExport,
  useIntrospect,
  useIntrospectPoll,
  type NamespaceResponse,
  type ServiceSummary,
  type SyncPipelinesResponse,
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
   Where synced data goes. Two destinations, two commercial stories:

   - the S3 bucket every install gets (destination_bucket, always on), which
     carries the IRSA story: which identity writes, and why no credential
     ever leaves the account;
   - the Enterprise compliance export (compliance_export, toggleable,
     default off), which carries the entitlement mechanic — one config,
     deployed only where the plan includes it, detected live through its
     marker Service.
   ============================================================ */

/** How often the page re-reads the namespace looking for the deploy. */
const POLL_MS = 10_000

const component = toggleableComponents.find((c) => c.name === 'compliance_export')

/* ---------- destination 1: the bucket ---------- */

function BucketCard({ config }: { config: UIConfig }) {
  const sync = useIntrospect<SyncPipelinesResponse>('/api/sync/pipelines')
  const bucket = sync.state === 'ok' ? sync.value.response.bucket : undefined
  const install = config.install_id ?? '<install-id>'

  return (
    <div className="ent ent--on">
      <div className="ent__head">
        <span className="ent__plan">Every plan</span>
        <span className="entstat mono" role="status">
          <span className="entstat__dot entstat__dot--on" aria-hidden="true" />
          on
        </span>
      </div>
      <div className="ent__name mono">{bucket ?? 'destination_bucket'}</div>
      <p className="ent__pitch">
        The S3 bucket every sync lands in
        {config.region ? ` (${config.region})` : ''}. It belongs to this AWS
        account, not to Nuon.
      </p>
      <div className="ent__foot">
        <Badge tone="positive" dot>
          always deployed
        </Badge>
        <span className="ent__facts mono">
          components/pulumi · name = &quot;destination_bucket&quot;
        </span>
      </div>
      <p className="ent__how">
        Who writes to it: the sync engine&rsquo;s pod, as the IAM role{' '}
        <span className="mono">conduit-sync-{install}</span> &mdash; assumed
        through its Kubernetes service account (IRSA), scoped to this bucket
        only. The same Pulumi component creates the bucket, the role, and the
        trust between them; no access key exists anywhere.
      </p>
    </div>
  )
}

/* ---------- destination 2: the compliance export (entitlement) ---------- */

/** The plan state, drawn: a live readout up top (never a switch — the real
 * control is in the dashboard) and the dashboard deep link as the one action. */
function EntitlementCard({
  on,
  config,
  onDashboardOpen,
}: {
  on: boolean
  config: UIConfig
  onDashboardOpen: () => void
}) {
  const toggleLink = config.links.compliance_export ?? config.links.components
  return (
    <div className={on ? 'ent ent--on' : 'ent'}>
      <div className="ent__head">
        <span className="ent__plan">Enterprise plan</span>
        <span className="entstat mono" role="status">
          <span
            className={on ? 'entstat__dot entstat__dot--on' : 'entstat__dot'}
            aria-hidden="true"
          />
          {on ? 'on' : 'off · watching'}
        </span>
      </div>
      <div className="ent__name mono">compliance_export</div>
      <p className="ent__pitch">
        A second destination: every operation Nuon performs in this install,
        exported to your SIEM. Like the syncs themselves, the events never
        leave your cloud.
      </p>
      <div className="ent__foot">
        {on ? (
          <Badge tone="positive" dot>
            included in this install
          </Badge>
        ) : (
          <OutLink href={toggleLink} onClick={onDashboardOpen}>
            Turn it on in Nuon
          </OutLink>
        )}
        <span className="ent__facts mono">
          toggleable = true · default_enabled = false
        </span>
      </div>
      {!on && (
        <p className="ent__how">
          The switch lives in the Nuon dashboard &mdash; enable the component
          there and this page flips by itself within {POLL_MS / 1000}s of the
          deploy.
        </p>
      )}
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
      href: config.links.compliance_export ?? config.links.components,
    },
    { label: 'deploy', detail: `Nuon applies ${COMPLIANCE_EXPORT_SERVICE}` },
    {
      label: 'detect',
      detail: `this page re-reads ${namespace} every ${POLL_MS / 1000}s`,
    },
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

export function Destinations({ config }: { config: UIConfig }) {
  useMarkStepSeen('/destinations')
  const namespace = config.namespace ?? 'conduit'
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
    const found = hasComplianceExport(ns.value.response.services ?? [])
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
          (svc) => svc.metadata?.name === COMPLIANCE_EXPORT_SERVICE,
        )
      : undefined

  const ready = enabled || ns.state === 'ok'

  return (
    <>
      <BackLink to="/">Conduit</BackLink>
      <header className="page-header">
        <Eyebrow>{stepEyebrow('/destinations')}</Eyebrow>
        <h1>Sell a destination</h1>
        <p className="lede psp-lede">
          <PspTag kind="problem" /> Enterprise plans include a destination the
          other tiers don&rsquo;t, and every install runs the same config.
        </p>
      </header>

      <PspSection
        kind="solution"
        title="The destination every install gets"
        aside="components/pulumi · destination_bucket"
      >
        <BucketCard config={config} />
        <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
          What lands in it, run by run, is on the{' '}
          <a href="#/pipelines">pipelines page</a>.
        </p>
      </PspSection>

      {!enabled && <LoadState result={ns} what={`the ${namespace} namespace`} />}

      {ready && (
        <>
          <PspSection
            kind="solution"
            title="The destination only Enterprise gets"
            aside="components/compliance_export.toml"
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
              <EntitlementCard
                on={enabled}
                config={config}
                onDashboardOpen={() => setWaiting(true)}
              />
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
              <Callout label="What actually got deployed">
                One marker Service &mdash;{' '}
                {service?.metadata?.name ?? COMPLIANCE_EXPORT_SERVICE}
                {service?.spec?.type ? ` (${service.spec.type})` : ''}. A real
                exporter puts its workload behind the same switch. The
                teardown and redeploy land in the{' '}
                <a href="#/under-the-hood/events">events feed</a> as they
                happen.
              </Callout>
            ) : (
              <div className="ttt-watch">
                {waiting ? (
                  <>
                    <Badge tone="warning" dot>
                      waiting for the deploy
                    </Badge>
                    <span>
                      Toggle the component on in the dashboard tab and deploy
                      it; this page switches over when the Service appears.
                    </span>
                  </>
                ) : (
                  <>
                    <Badge tone="accent" dot>
                      watching live
                    </Badge>
                    <span>
                      Checking this namespace for the exporter&rsquo;s Service
                      every {POLL_MS / 1000} seconds.
                    </span>
                  </>
                )}
              </div>
            )}
          </PspSection>
        </>
      )}
      <StepNav current="/destinations" />
    </>
  )
}
