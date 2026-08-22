import { useEffect, useRef, useState } from 'react'
import {
  AUDIT_LOG_SERVICE,
  hasAuditLogExporter,
  useIntrospectPoll,
  type NamespaceResponse,
  type UIConfig,
} from '../lib/api'
import { proofPrompts } from '../lib/prompts'
import {
  Badge,
  CommandBlock,
  CopyButton,
  LoadState,
  OutLink,
  Section,
} from '../ui/Primitives'

/* ============================================================
   The delivery-log archive: what gets written to S3, where, and on what
   schedule — plus the run-it-now affordances. The surface is an Enterprise
   entitlement: a toggleable Nuon component whose marker Service in the
   namespace is how this console knows the plan includes it.
   ============================================================ */

const POLL_MS = 10_000

const installIdOf = (config: UIConfig) => config.install_id ?? '<your-install-id>'
const appIdOf = (config: UIConfig) => config.app_id ?? '<your-app-id>'

/** Agent prompt and raw commands, side by side with equal billing. */
function RunItYourself({ config }: { config: UIConfig }) {
  const [track, setTrack] = useState<'agent' | 'manual'>('agent')
  const prompt = proofPrompts.export(installIdOf(config), appIdOf(config))
  return (
    <div className="tracks">
      <div className="tracks__bar" role="tablist" aria-label="How to run this">
        <button
          type="button"
          role="tab"
          aria-selected={track === 'agent'}
          className={track === 'agent' ? 'tracks__tab tracks__tab--on' : 'tracks__tab'}
          onClick={() => setTrack('agent')}
        >
          Paste into your coding agent
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={track === 'manual'}
          className={track === 'manual' ? 'tracks__tab tracks__tab--on' : 'tracks__tab'}
          onClick={() => setTrack('manual')}
        >
          Run it yourself
        </button>
      </div>
      <div className="tracks__panel">
        {track === 'agent' ? (
          <div className="agent-prompt proof-prompt">
            <div className="cmd__head">
              <span className="cmd__label">the prompt, your ids filled in</span>
              <CopyButton text={prompt} />
            </div>
            <pre className="cmd__pre agent-prompt__pre proof-prompt__pre">{prompt}</pre>
          </div>
        ) : (
          <>
            <CommandBlock
              label="1 · create-run takes the workflow id (actw…), not the name"
              command={`nuon actions list --app-id ${appIdOf(config)}`}
            />
            <CommandBlock
              label="2 · run the export now"
              command={`nuon actions create-run --install-id ${installIdOf(config)} --action-workflow-id <actw-id>`}
              note={<>The run&rsquo;s transcript prints the S3 key it wrote.</>}
            />
          </>
        )}
      </div>
    </div>
  )
}

function LockedState({
  config,
  ns,
}: {
  config: UIConfig
  ns: ReturnType<typeof useIntrospectPoll<NamespaceResponse>>
}) {
  const toggleLink = config.links.audit_log_exporter ?? config.links.components
  return (
    <>
      <LoadState result={ns} what="the namespace" />
      {ns.state === 'ok' && (
        <div className="ent">
          <div className="ent__head">
            <span className="ent__plan">Enterprise plan</span>
            <span className="entstat mono" role="status">
              <span className="entstat__dot" aria-hidden="true" />
              off · watching
            </span>
          </div>
          <div className="ent__name">Delivery-log export</div>
          <p className="ent__pitch">
            Relay&rsquo;s full delivery record &mdash; stats, events, dead
            letters &mdash; archived every six hours to the S3 bucket in this
            install. The logs never leave your cloud.
          </p>
          <div className="ent__foot">
            {toggleLink && <OutLink href={toggleLink}>Turn it on in Nuon</OutLink>}
            <span className="ent__facts mono">
              audit_log_exporter · toggleable = true
            </span>
          </div>
          <p className="ent__how">
            The entitlement is a toggleable Nuon component. Enable it in the
            dashboard and this page flips by itself within {POLL_MS / 1000}s of
            the deploy &mdash; its marker Service ({AUDIT_LOG_SERVICE}) in the
            namespace is how this console knows.
          </p>
        </div>
      )}
    </>
  )
}

export function LogsExport({ config }: { config: UIConfig }) {
  const namespace = config.namespace ?? 'relay'
  const [enabled, setEnabled] = useState(false)
  const [justEnabled, setJustEnabled] = useState(false)
  const sawLocked = useRef(false)
  const install = installIdOf(config)

  const ns = useIntrospectPoll<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
    POLL_MS,
    !enabled,
  )

  useEffect(() => {
    if (ns.state !== 'ok') return
    if (hasAuditLogExporter(ns.value.response.services ?? [])) {
      if (sawLocked.current) setJustEnabled(true)
      setEnabled(true)
    } else {
      sawLocked.current = true
    }
  }, [ns])

  return (
    <>
      <header className="page-header">
        <h1>Logs &amp; export</h1>
        <p className="lede">
          The delivery-log archive: Relay&rsquo;s delivery record, written to
          S3 inside this install.
        </p>
      </header>

      {!enabled && <LockedState config={config} ns={ns} />}

      {enabled && (
        <>
          {justEnabled && (
            <div className="ttt-unlocked-note">
              <Badge tone="positive" dot>
                just deployed
              </Badge>
              <span>
                The component deployed, its Service appeared in the namespace,
                and this page noticed. No reload.
              </span>
            </div>
          )}

          <Section title="The archive" aside="delivery_log_export · every 6 hours">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>What</th>
                    <th>Where</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      One JSON document: the delivery stats, the recent events,
                      and the dead-letter queue at that moment
                    </td>
                    <td className="mono subtext">
                      s3://relay-{install}/delivery-logs/&lt;timestamp&gt;.json
                    </td>
                    <td className="mono subtext">cron 0 */6 * * * · on demand</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
              The bucket (versioned, encrypted) was provisioned by this
              install&rsquo;s <span className="mono">pulumi_infra</span>{' '}
              component. Relay&rsquo;s pods hold no IAM &mdash; the export runs
              on the install&rsquo;s runner, whose actions role carries the one
              PutObject grant.
            </p>
          </Section>

          <Section title="Run an export now" aside="the same run its cron fires">
            <RunItYourself config={config} />
          </Section>
        </>
      )}
    </>
  )
}
