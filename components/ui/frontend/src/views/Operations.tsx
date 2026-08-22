import type { UIConfig } from '../lib/api'
import { adhocActions, runbooks } from '../lib/config-data.gen'
import { agentPrompt } from '../lib/prompts'
import {
  Badge,
  CommandBlock,
  CopyButton,
  Icon,
  Mono,
  OutLink,
  PageHeader,
  Section,
} from '../ui/Primitives'

/* ============================================================
   The SOP page an ops team pins: health checks, the four runbooks, the
   break-glass restart at its point of use, ad-hoc actions, and the agent
   prompt at equal billing. Everything renders from config-data.gen.ts and
   ui-config; commands carry this install's real ids.
   ============================================================ */

const installIdOf = (config: UIConfig) => config.install_id ?? '<your-install-id>'
const appIdOf = (config: UIConfig) => config.app_id ?? '<your-app-id>'

function nameList(items: Array<{ name: string }>) {
  return items.map((item) => item.name).join(' · ')
}

function SopTable() {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Runbook</th>
            <th>Mode</th>
            <th>What it does</th>
            <th>Steps</th>
          </tr>
        </thead>
        <tbody>
          {runbooks.map((rb) => (
            <tr key={rb.name}>
              <td className="mono">{rb.name}</td>
              <td>
                {rb.mutates ? (
                  <Badge tone="warning" dot>
                    applies changes
                  </Badge>
                ) : (
                  <Badge tone="positive" dot>
                    read-only
                  </Badge>
                )}
              </td>
              <td>{rb.description}</td>
              <td className="mono subtext">{rb.steps.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Operations({ config }: { config: UIConfig }) {
  const install = installIdOf(config)
  const app = appIdOf(config)
  const breakGlass = runbooks.find((rb) => rb.name === 'break-glass')

  return (
    <>
      <PageHeader
        title="Operations"
        lede="Real commands against this install, ids filled in."
      />

      <Section title="Health check" aside="probes run on the runner">
        <p className="small muted" style={{ maxWidth: '72ch' }}>
          Component health probes gate every deploy;{' '}
          <Mono>full-health-check</Mono> re-checks nodes, workloads, ingress,
          and the public endpoint on demand.
        </p>
        <CommandBlock
          label="check this install now"
          command={`nuon runbooks create-run --install-id ${install} --runbook-id full-health-check`}
          note={
            <>
              It also runs automatically after every deploy (
              <Mono>post_deploy_runbooks</Mono>) and archives its report — see{' '}
              <a href="#/reports">Reports</a>.
            </>
          }
        />
      </Section>

      <Section title="SOPs" aside="runbooks/*.toml">
        <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
          Multi-step procedures, versioned with the app config, run on the
          install&rsquo;s runner.
        </p>
        <SopTable />
        <CommandBlock
          label="runbooks take their name directly"
          command={`nuon runbooks create-run --install-id ${install} --runbook-id debug-bundle`}
          note={
            config.links.runbooks && (
              <OutLink href={config.links.runbooks} variant="plain">
                Transcripts
              </OutLink>
            )
          }
        />
        <p className="small muted" style={{ marginTop: 12, maxWidth: '72ch' }}>
          The two read-only SOPs archive their output to the install&rsquo;s
          report bucket — <a href="#/reports">Reports</a> narrates what lands
          where.
        </p>
      </Section>

      <Section title="Emergency restart" aside="break_glass.toml" id="emergency">
        <div className="breakglass">
          <div className="breakglass__head">
            <Badge tone="warning" dot>
              break glass
            </Badge>
            <span className="breakglass__name mono">break-glass</span>
          </div>
          <p className="breakglass__body">
            Restarts Periscope&rsquo;s three deployments under{' '}
            <Mono>{install}-app-break-glass</Mono>: AdministratorAccess minus
            an explicit Secrets Manager Deny — the run&rsquo;s transcript shows
            the denial.
            {breakGlass && (
              <>
                {' '}
                {breakGlass.steps.length} steps: it captures state first and
                probes the public endpoint after.
              </>
            )}
          </p>
          <CommandBlock
            label="the recorded procedure, not ad-hoc console access"
            command={`nuon runbooks create-run --install-id ${install} --runbook-id break-glass`}
            note={
              <>
                Pod ages reset on <a href="#/workloads/namespace">Workloads</a>{' '}
                as the restart lands.
              </>
            }
          />
        </div>
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
            <>
              <Mono>--role-name</Mono> overrides the IAM role for one run.
              {config.links.actions && (
                <>
                  {' '}
                  <OutLink href={config.links.actions} variant="plain">
                    Run history
                  </OutLink>
                </>
              )}
            </>
          }
        />
      </Section>

      <Section title="Run it with your agent" aside="Claude Code · Codex">
        <div className="agent-prompt">
          <div className="cmd__head">
            <span className="cmd__label">the prompt, your ids filled in</span>
            <CopyButton text={agentPrompt(install, app)} />
          </div>
          <pre className="cmd__pre agent-prompt__pre">
            {agentPrompt(install, app)}
          </pre>
        </div>
        <p className="small muted" style={{ marginTop: 12, maxWidth: '72ch' }}>
          <a href="#/guide/agent">
            Read it first <Icon name="arrow-right" />
          </a>
        </p>
      </Section>
    </>
  )
}
