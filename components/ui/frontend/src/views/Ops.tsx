import type { UIConfig } from '../lib/api'
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
  // Straight to the component's own page on this install (its toggle lives
  // there); the components list is the fallback when the id didn't resolve.
  const toggleLink = config.links.audit_log_exporter ?? config.links.components

  return (
    <>
      <BackLink to="/">Kitchen Sink</BackLink>

      <header className="page-header">
        <h1>The things it can do.</h1>
        <p className="lede">Real commands against this install, ids filled in.</p>
      </header>

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
          entitlement: flip it on and Nuon deploys it.
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
          <Mono>full-health-check</Mono> re-checks nodes, workloads, ingress,
          and the public endpoint on demand.
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
          label="2 · run it with an id from step 1"
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
          label="override the role for one run — actw id from step 1 above"
          command={`nuon actions create-run --install-id ${install} --action-workflow-id <actw-id> --role-name maintenance`}
          note={
            <>
              Roles: {nameList(roles)}.{' '}
              <Mono>break_glass_remediation</Mono> runs as{' '}
              <Mono>app-break-glass</Mono>: AdministratorAccess minus an
              explicit Secrets Manager Deny &mdash; the transcript shows the
              denial.
            </>
          }
        />
      </Section>
    </>
  )
}
