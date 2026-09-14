import { useState, type ReactNode } from 'react'
import { useIntrospectPoll, type NamespaceResponse, type UIConfig } from '../lib/api'
import { cases } from '../lib/cases'
import { adhocActions, branchName, runbooks } from '../lib/config-data.gen'
import { paste } from '../lib/nuon-loop-paste'
import { setup } from '../lib/prompts'
import { AccountDiagram } from '../ui/CaseDiagrams'
import { CopyButton, Icon } from '../ui/Primitives'

/* ============================================================
   Home: the page after the opener and the returning visitor's front door.
   One live diagram of this install, the three common requests (each an app
   branch), the coding-agent setup, the CLI commands with this install's
   ids, and the exit to the doing path.
   ============================================================ */

/* ============================================================
   The CLI card's payload: every command this app hands out, grouped and
   scoped to this install and app. Ids are real, so each row pastes into a
   terminal.
   ============================================================ */

interface CliRow {
  cmd: string
  note?: ReactNode
}

export function cliGroups(install: string, app: string): Array<{ name: string; rows: CliRow[] }> {
  return [
    {
      name: 'Once',
      rows: [
        { cmd: 'nuon auth login', note: 'Keeps a session in ~/.nuon. Skip if you already have one.' },
        {
          cmd: setup.claudeCode,
          note: (
            <>
              Registers Nuon&rsquo;s MCP server, the CLI&rsquo;s stdio proxy, with Claude Code. Amp:{' '}
              <span className="mono">{setup.amp}</span>. Cursor: <span className="mono">~/.cursor/mcp.json</span>.
            </>
          ),
        },
        { cmd: setup.verify, note: 'Prints your org, app, and install ids and the tools your agent gets.' },
      ],
    },
    {
      name: 'This install',
      rows: [
        {
          cmd: `nuon installs get --install-id ${install}`,
          note: 'Status, sandbox, runner, and every component on it.',
        },
      ],
    },
    {
      name: 'Runbooks',
      rows: [
        {
          cmd: `nuon runbooks list --install-id ${install}`,
          note: (
            <>
              {runbooks.length} recorded procedures;{' '}
              {runbooks
                .filter((r) => r.mutates)
                .map((r) => r.name)
                .join(' and ')}{' '}
              mutate.
            </>
          ),
        },
        {
          cmd: `nuon runbooks create-run --install-id ${install} --runbook-id full-health-check`,
          note: 'Nodes, workloads, rollout convergence, ingress, and the public endpoint.',
        },
        {
          cmd: `nuon runbooks create-run --install-id ${install} --runbook-id debug-bundle`,
          note: 'Read-only diagnostics: pod state, events, logs, endpoint probe.',
        },
      ],
    },
    {
      name: 'Actions',
      rows: [
        {
          cmd: `nuon actions list --app-id ${app}`,
          note: (
            <>
              Prints the {adhocActions.length} configured actions. Copy the
              workflow id (
              <span className="mono">actw&hellip;</span>) for create-run.
            </>
          ),
        },
        {
          cmd: `nuon actions create-run --install-id ${install} --action-workflow-id <actw-id>`,
          note: 'Runs on the install’s runner; no kubeconfig handed out.',
        },
        {
          cmd: `nuon actions create-run --install-id ${install} --action-workflow-id <actw-id> --role-name maintenance`,
          note: 'The same run under a different per-operation IAM role.',
        },
      ],
    },
    {
      name: 'Branch run',
      rows: [
        {
          cmd: `nuon branches trigger --app-id ${app} --branch-id ${branchName} --no-wait`,
          note: (
            <>
              Runs <span className="mono">{branchName}</span> at its head on GitHub; each install group
              holds for an approval. A new app&rsquo;s first config upload stays{' '}
              <span className="mono">nuon sync --create</span>, from the config directory.
            </>
          ),
        },
      ],
    },
  ]
}

export function CliPanel({ install, app }: { install: string; app: string }) {
  return (
    <div className="clipanel" id="cli-commands">
      {cliGroups(install, app).map((group) => (
        <section className="clipanel__group" key={group.name}>
          <div className="clipanel__label">{group.name}</div>
          {group.rows.map((row) => (
            <div className="clirow" key={row.cmd}>
              <div className="clirow__body">
                <pre className="clirow__cmd">{row.cmd}</pre>
                {row.note && <div className="clirow__note">{row.note}</div>}
              </div>
              <CopyButton text={row.cmd} />
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

/** One command with its copy button, the card-sized form. */
function CmdRow({ cmd }: { cmd: string }) {
  return (
    <div className="home__cmd">
      <code className="mono">{cmd}</code>
      <CopyButton text={cmd} />
    </div>
  )
}

export function Home({ config }: { config: UIConfig }) {
  const install = config.install_id ?? '<your-install-id>'
  const app = config.app_id ?? '<your-app-id>'
  const namespace = config.namespace ?? 'kitchen-sink'
  const [cliOpen, setCliOpen] = useState(false)

  const ns = useIntrospectPoll<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
    20_000,
    true,
  )
  const pods = ns.state === 'ok' ? (ns.value.response.pods ?? []) : []

  const groups = cliGroups(install, app)
  const commandCount = groups.reduce((n, g) => n + g.rows.length, 0)
  // The three rows the card shows before the expander: inspect, health, ship.
  const byName = (name: string) => groups.find((g) => g.name === name)?.rows ?? []
  const headline = [
    ...byName('This install').slice(0, 1),
    ...byName('Runbooks').slice(1, 2),
    ...byName('Branch run').slice(0, 1),
  ]

  return (
    <div className="home">
      <header className="page-header home__head">
        <div className="eyebrow eyebrow--accent">Kitchen sink demo · home</div>
        <h1>Kitchen Sink: one install, {cases.length} requests.</h1>
      </header>

      <div className="home__wings">
        <section className="home__card home__card--requests">
          <div className="home__card-head">
            <h2 className="home__card-title">Common requests</h2>
            <span className="mono home__aside">
              {cases.length} cases · {cases.length} app branches
            </span>
          </div>
          <AccountDiagram
            pods={pods}
            namespace={namespace}
            installId={config.install_id}
            vpcId={config.vpc_id}
          />
          <div className="home__reqs">
            {cases.map((c, i) => (
              <a key={c.branch} className="home__req" href={`#/cases/${c.branch}`}>
                <span className="home__req-n mono">{i + 1}</span>
                <span className="home__req-body">
                  <span className="home__req-name">{c.title}</span>
                  <span className="mono home__req-branch">@{c.branch}</span>
                </span>
              </a>
            ))}
          </div>
          <a className="btn btn--primary home__all" href="#/cases">
            {cases.length} cases <Icon name="arrow-right" />
          </a>
        </section>

        <div className="home__side">
          <section className="home__card">
            <div className="home__card-head">
              <h2 className="home__card-title">Coding agent</h2>
              <span className="mono home__aside">MCP · read tools</span>
            </div>
            <CmdRow cmd={setup.claudeCode} />
            <div className="home__row">
              <CopyButton text={setup.cursor} label="Cursor" doneLabel="Copied" />
              <CopyButton text={setup.amp} label="Amp" doneLabel="Copied" />
              <span className="home__spacer" />
              <span className="mono home__aside">one prompt per case</span>
            </div>
          </section>

          <section className="home__card home__card--cli">
            <div className="home__card-head">
              <h2 className="home__card-title">Nuon CLI</h2>
              <span className="mono home__aside">
                {config.install_id ? 'this install · ids filled in' : 'ids not served; placeholders shown'}
              </span>
            </div>
            {headline.map((row) => (
              <CmdRow key={row.cmd} cmd={row.cmd} />
            ))}
            <button
              type="button"
              className="home__more mono"
              aria-expanded={cliOpen}
              aria-controls="cli-commands"
              onClick={() => setCliOpen((open) => !open)}
            >
              {groups.length} groups · {commandCount} commands
              <span className={cliOpen ? 'home__caret home__caret--open' : 'home__caret'} aria-hidden="true">
                <Icon name="caret-right" />
              </span>
            </button>
          </section>
        </div>
      </div>

      {cliOpen && <CliPanel install={install} app={app} />}

      <section className="home__exit">
        <div className="home__exit-lead">
          <h2 className="home__card-title">Your app on Nuon</h2>
          <span className="mono home__aside">your repo → app config → first install</span>
        </div>
        <div className="home__cmd home__cmd--paste">
          <code className="mono">
            <span className="home__goal">{paste.slice(0, 5)}</span>
            {paste.slice(5)}
          </code>
        </div>
        <CopyButton text={paste} label="Copy prompt" doneLabel="Copied" big />
        <a className="mono home__link" href="#/try">
          The paste, in full <Icon name="arrow-right" />
        </a>
      </section>
    </div>
  )
}
