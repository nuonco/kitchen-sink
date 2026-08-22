import { useDelivery, type DeliveryStats, type UIConfig } from '../lib/api'
import {
  adhocActions,
  branchName,
  roles,
  runbooks,
} from '../lib/config-data.gen'
import {
  BackLink,
  CommandBlock,
  Mono,
  OutLink,
  Section,
} from '../ui/Primitives'

/* ============================================================
   The expert digest: every day-2 feature as one row — what it does, the
   command that tries it. The narrative versions live under #/customize.
   ============================================================ */

const installIdOf = (config: UIConfig) => config.install_id ?? '<your-install-id>'
const appIdOf = (config: UIConfig) => config.app_id ?? '<your-app-id>'

/** " · "-joined names, mutating ones marked. */
function nameList(items: Array<{ name: string; mutates?: boolean }>) {
  return items
    .map((item) => (item.mutates ? `${item.name} (mutates)` : item.name))
    .join(' · ')
}

export function Ops({ config }: { config: UIConfig }) {
  const install = installIdOf(config)
  const app = appIdOf(config)
  const [stats] = useDelivery<DeliveryStats>('/api/delivery/stats', 15_000)
  const s = stats.state === 'ok' ? stats.value : undefined
  const appURL = config.public_domain
    ? `https://app.${config.public_domain}`
    : 'https://app.<your-install-domain>'
  // Straight to the component's own page on this install (its toggle lives
  // there); the components list is the fallback when the id didn't resolve.
  const toggleLink = config.links.audit_log_exporter ?? config.links.components

  return (
    <>
      <BackLink to="/">Relay</BackLink>

      <header className="page-header">
        <h1>Delivery operations.</h1>
        <p className="lede">Real commands against this install, ids filled in.</p>
        {s && (
          <div className="row" style={{ marginTop: 8 }}>
            <span className="chip">{s.events_24h} events 24h</span>
            <span className="chip">{s.delivered_24h} delivered</span>
            <span className="chip">
              {(s.success_rate * 100).toFixed(1)}% success
            </span>
            <span className="chip">{s.dlq_depth} dead</span>
            <span className="chip">{s.endpoints_active} active endpoints</span>
          </div>
        )}
      </header>

      <Section title="The pipeline" aside="GET /delivery/*">
        <p className="small muted" style={{ maxWidth: '72ch' }}>
          Events, per-attempt retries, and the DLQ are at{' '}
          <a href="#/delivery">#/delivery</a>. The same data is on the public
          API, and the DLQ replay is its one write:
        </p>
        <CommandBlock
          label="drain one dead delivery (ids in the DLQ table or GET /api/delivery/dlq)"
          command={`curl -X POST ${appURL}/api/delivery/dlq/<att-id>/replay`}
          note={
            <>
              Re-queues a real attempt, due immediately.{' '}
              <Mono>break-glass</Mono> below does this for the whole queue.
            </>
          }
        />
      </Section>

      <Section title="App branches" aside="branch.toml">
        <p className="small muted" style={{ maxWidth: '72ch' }}>
          Every push to <Mono>{branchName}</Mono> rolls out staging &rarr;
          customers &rarr; enterprise, holding for approval per group.
        </p>
        <CommandBlock
          label="edit any file in your clone, then"
          command={`nuon sync --app-id ${app} --force --branch ${branchName}`}
          note={
            <>
              Uncommitted files count. <Mono>--preview</Mono> plans without
              applying. Approvals are dashboard-only
              {config.links.branches ? (
                <>
                  {' '}
                  &mdash;{' '}
                  <OutLink href={config.links.branches} variant="plain">
                    watch the run
                  </OutLink>
                </>
              ) : (
                '.'
              )}
            </>
          }
        />
      </Section>

      <Section
        title="Toggleable components"
        aside="components/audit_log_exporter.toml"
      >
        <p className="small muted" style={{ maxWidth: '72ch' }}>
          A component with <Mono>toggleable = true</Mono> is a per-install
          entitlement. <Mono>audit_log_exporter</Mono> marks the Enterprise
          delivery-log export: flip it on and Nuon deploys it.
        </p>
        {toggleLink && (
          <div className="row" style={{ marginTop: 16 }}>
            <OutLink href={toggleLink}>
              Toggle audit_log_exporter on in Nuon
            </OutLink>
          </div>
        )}
        <p className="small muted" style={{ marginTop: 12, maxWidth: '72ch' }}>
          When its Service reaches the namespace,{' '}
          <a href="#/audit-log">#/audit-log</a> unlocks &mdash; usually under a
          minute.
        </p>
      </Section>

      <Section title="Health checks" aside="probes run on the runner">
        <p className="small muted" style={{ maxWidth: '72ch' }}>
          Component health probes gate every deploy;{' '}
          <Mono>full-health-check</Mono> is the delivery health sweep: nodes,
          workloads, ingress, the public endpoint, and live delivery stats.
        </p>
        <CommandBlock
          label="check this install now"
          command={`nuon runbooks create-run --install-id ${install} --runbook-id full-health-check`}
        />
      </Section>

      <Section title="Runbooks" aside="runbooks/*.toml">
        <p className="small muted" style={{ maxWidth: '72ch' }}>
          Multi-step procedures, versioned with the app config, run on the
          install&rsquo;s runner.
        </p>
        <CommandBlock
          label="runbooks take their name directly"
          command={`nuon runbooks create-run --install-id ${install} --runbook-id debug-bundle`}
          note={
            <>
              Also{' '}
              {nameList(runbooks.filter((r) => r.name !== 'debug-bundle'))}.
              {config.links.runbooks && (
                <>
                  {' '}
                  <OutLink href={config.links.runbooks} variant="plain">
                    Transcripts
                  </OutLink>
                </>
              )}
            </>
          }
        />
      </Section>

      <Section title="Ad-hoc actions" aside="actions/*">
        <p className="small muted" style={{ maxWidth: '72ch' }}>
          One-off operational scripts &mdash; {nameList(adhocActions)} &mdash;
          run on the runner.
        </p>
        <CommandBlock
          label="1 · create-run takes the workflow id (actw…), not the name"
          command={`nuon actions list --app-id ${app}`}
        />
        <CommandBlock
          label="2 · run it"
          command={`nuon actions create-run --install-id ${install} --action-workflow-id <actw-id>`}
          note={
            config.links.actions && (
              <OutLink href={config.links.actions} variant="plain">
                Run history
              </OutLink>
            )
          }
        />
      </Section>

      <Section title="Operation roles" aside="permissions/*">
        <p className="small muted" style={{ maxWidth: '72ch' }}>
          Every operation assumes its own scoped IAM role in the account,
          named <Mono>{install}-&lt;role&gt;</Mono>.
        </p>
        <CommandBlock
          label="override the role for one run"
          command={`nuon actions create-run --install-id ${install} --action-workflow-id <actw-id> --role-name <role>`}
          note={
            <>
              Roles: {nameList(roles)}.{' '}
              <Mono>break_glass_remediation</Mono> runs as{' '}
              <Mono>app-break-glass</Mono>: AdministratorAccess minus an
              explicit Secrets Manager Deny &mdash; the transcript shows the
              denial, then the pipeline restart and DLQ drain.
            </>
          }
        />
      </Section>
    </>
  )
}
