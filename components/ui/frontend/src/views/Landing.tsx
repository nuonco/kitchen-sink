import { useState, type ReactNode } from 'react'
import type { UIConfig } from '../lib/api'
import { adhocActions, branchName, repoName, runbooks, toggleableComponents } from '../lib/config-data.gen'
import { completedCount, useCompletion } from '../lib/completion'
import { seenSteps } from '../lib/progress'
import { agentPrompt, setup, useCases } from '../lib/prompts'
import { useNavigate } from '../lib/router'
import { numberedSteps, pathSteps, stepNumber } from '../lib/taxonomy'
import { PixelCheck } from '../ui/CapabilityGrid'
import { CopyButton, Icon, OutLink } from '../ui/Primitives'

/* ============================================================
   The page after the opener (views/Opener.tsx), and what a returning
   visitor lands on. Item 2 of the rebuild replaces it with Home.
   ============================================================ */

/* ============================================================
   Internal navigation that behaves like navigate(): scrolls back to the
   top, keeps the href for open-in-new-tab.
   ============================================================ */

function GoLink({
  to,
  className,
  children,
}: {
  to: string
  className?: string
  children: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <a
      className={className}
      href={`#${to}`}
      onClick={(e) => {
        e.preventDefault()
        navigate(to)
      }}
    >
      {children}
    </a>
  )
}

/* ============================================================
   The CLI bucket's payload: every command this app hands out anywhere,
   collected in one pane and scoped to this install and app. Ids are real,
   so each row pastes straight into a terminal.
   ============================================================ */

interface CliRow {
  cmd: string
  note?: ReactNode
}

function cliGroups(install: string, app: string): Array<{ name: string; rows: CliRow[] }> {
  return [
    {
      name: 'Once',
      rows: [
        { cmd: 'nuon auth login', note: 'Keeps a session in ~/.nuon. Skip if you already have one.' },
        {
          cmd: setup.claudeCode,
          note: (
            <>
              Connects Nuon&rsquo;s MCP server to Claude Code through this CLI
              (also <span className="mono">cursor</span>, <span className="mono">amp</span>).
              Run it from your clone&rsquo;s root.
            </>
          ),
        },
        { cmd: setup.verify, note: 'Prints your org, app, and install ids and the tools your agent gets.' },
      ],
    },
    {
      name: 'Inspect this install',
      rows: [
        {
          cmd: `nuon installs get --install-id ${install}`,
          note: 'Status, sandbox, runner, and every component on it.',
        },
      ],
    },
    {
      name: 'Check health',
      rows: [
        {
          cmd: `nuon runbooks list --install-id ${install}`,
          note: (
            <>
              {runbooks.length} recorded procedures; <span className="mono">re-apply-config</span> and{' '}
              <span className="mono">break-glass</span> mutate.
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
      name: 'Run actions',
      rows: [
        {
          cmd: `nuon actions list --app-id ${app}`,
          note: (
            <>
              Prints all {adhocActions.length} configured actions. Copy the
              workflow id (
              <span className="mono">actw&hellip;</span>) for the next two.
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
      name: 'Ship a change',
      rows: [
        {
          cmd: `nuon sync --app-id ${app} --force --branch ${branchName}`,
          note: (
            <>
              From your clone of the app config; uncommitted edits count.
              Triggers the staged rollout with an approval per group;{' '}
              <span className="mono">--preview</span> plans without applying.
            </>
          ),
        },
      ],
    },
  ]
}

function CliPanel({ install, app }: { install: string; app: string }) {
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

/* ============================================================
   The customize hub: the tour's destination, and the returning-visitor
   front door. Two peer ways in (agent prompt, CLI), a few live things to
   try immediately, and a dense index of the rest.
   ============================================================ */

export function Landing({ config }: { config: UIConfig }) {
  const navigate = useNavigate()
  const [cliOpen, setCliOpen] = useState(false)
  const { map } = useCompletion()

    const install = config.install_id ?? '<your-install-id>'
    const app = config.app_id ?? '<your-app-id>'
    const seen = seenSteps()
    const phases = ['Read', 'Ship', 'Operate', 'Govern'] as const
    const done = completedCount(map, numberedSteps.map((s) => s.to))
    const complete = done === numberedSteps.length
    // While the path is incomplete, tic-tac-toe stays the last row of the
    // index, same as before it was a numbered/bonus split. Once complete it
    // moves into the ending block below and drops out of the index, so the
    // same link never appears twice on one screen.
    const tictactoe = pathSteps.find((s) => s.to === '/tictactoe')
    const indexSteps = complete || !tictactoe ? numberedSteps : [...numberedSteps, tictactoe]
    return (
      <div className="tour__step">
        <header className="hero">
          <h1 style={{ maxWidth: '28ch' }}>Customize the Kitchen Sink.</h1>
        </header>

        {complete && (
          <section className="ending">
            <h2 className="ending__title">
              {numberedSteps.length} of {numberedSteps.length} steps complete.
            </h2>
            <p className="ending__unlock">
              <GoLink to="/tictactoe">Tic-tac-toe</GoLink> is one of this
              config&rsquo;s {toggleableComponents.length} toggleable components: it
              exists in the cluster only once step {stepNumber('/audit-log')}{' '}
              switches it on.
            </p>
            <p className="ending__next">
              This install runs from one app config,{' '}
              <OutLink href={`https://github.com/${repoName}`} variant="plain">
                {repoName}
              </OutLink>
              ; clone it to start your own.
            </p>
          </section>
        )}

        <div className="choices">
          <section className="choice">
            <h2 className="choice__title">Coding agent setup</h2>
            <p className="choice__desc">
              One command gives Claude Code, Cursor, or Amp Nuon&rsquo;s MCP
              server through the Nuon CLI. Then ask it about this install;
              write tools stay hidden unless you pass{' '}
              <span className="mono">--allow-writes</span>.
            </p>
            <pre className="cmd__pre choice__cmd">{setup.claudeCode}</pre>
            <div className="choice__actions">
              <CopyButton
                text={setup.claudeCode}
                label="Copy the setup command"
                doneLabel="Copied"
                big
              />
              <a href="#/customize/agent">
                {useCases.length} things to ask it <Icon name="arrow-right" />
              </a>
              <CopyButton
                text={agentPrompt(install, app)}
                label="or copy the whole-tour prompt"
                doneLabel="Copied"
              />
            </div>
          </section>

          <button
            type="button"
            className={cliOpen ? 'choice choice--toggle choice--open' : 'choice choice--toggle'}
            aria-expanded={cliOpen}
            aria-controls="cli-commands"
            onClick={() => setCliOpen((open) => !open)}
          >
            <span className="choice__title">Nuon CLI commands</span>
            <span className="choice__desc">
              Every command for this install and app, ids filled in.
            </span>
            <span className="choice__actions">
              <span className="choice__faux">
                {cliOpen ? 'Hide the commands' : 'Show the commands'}
              </span>
              <span
                className={cliOpen ? 'choice__caret choice__caret--open' : 'choice__caret'}
                aria-hidden="true"
              >
                <Icon name="caret-right" />
              </span>
            </span>
          </button>
        </div>

        {cliOpen && <CliPanel install={install} app={app} />}

        <section className="section section--hub">
          <div className="section__head">
            <h2 className="section__title">{numberedSteps.length} steps</h2>
            <div className="subtext muted">
              {done} of {numberedSteps.length} done
            </div>
          </div>
          <div className="encyc">
            {phases.map((phase) => (
              <div className="encyc__group" key={phase}>
                <div className="encyc__phase">{phase}</div>
                <ul className="encyc__list">
                  {indexSteps
                    .filter((s) => s.phase === phase)
                    .map((s) => (
                      <li key={s.to}>
                        <GoLink to={s.to} className="encyc__row">
                          <span className="encyc__title">{s.title}</span>
                          <span className="encyc__desc">{s.desc}</span>
                          {seen.has(s.to) && (
                            <span
                              className="encyc__seen"
                              title="You have opened this page"
                            >
                              <PixelCheck />
                            </span>
                          )}
                        </GoLink>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="section section--hub">
          <div className="row">
            {config.links.install && (
              <OutLink href={config.links.install}>
                Open this install in Nuon
              </OutLink>
            )}
            <OutLink
              href="https://docs.nuon.co/get-started/introduction"
              variant="secondary"
            >
              Read the docs
            </OutLink>
            <button
              className="tour__skip"
              style={{ marginLeft: 0 }}
              onClick={() => navigate('/intro')}
            >
              <Icon name="arrow-left" /> Opener
            </button>
          </div>
        </section>
      </div>
    )
}
