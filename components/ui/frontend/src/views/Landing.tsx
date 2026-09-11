import { useEffect, useState, type ReactNode } from 'react'
import {
  countReady,
  runningImageTags,
  useIntrospectPoll,
  type NamespaceResponse,
  type UIConfig,
} from '../lib/api'
import { adhocActions, branchName, repoName, toggleableComponents } from '../lib/config-data.gen'
import { completedCount, useCompletion } from '../lib/completion'
import { seenSteps, TOUR_KEY } from '../lib/progress'
import { agentPrompt, setup } from '../lib/prompts'
import { useNavigate } from '../lib/router'
import { numberedSteps, pathSteps, stepNumber } from '../lib/taxonomy'
import { PixelCheck } from '../ui/CapabilityGrid'
import { CopyButton, Icon, OutLink } from '../ui/Primitives'
import { RelationshipDiagram } from '../ui/RelationshipDiagram'

/* ============================================================
   The landing opens on arrival, then three slides put the reader's own
   relationship to Nuon on screen against the same diagram: their repo is
   a template, an install is a running instance of it, and a push is how
   it changes. The tour ends on the push slide's big CTA into the
   customize page ('explore'), which is also what returning visitors get:
   progress is remembered in localStorage, and "Skip the tour" jumps
   straight there.
   ============================================================ */

const steps = ['arrive', 'template', 'instance', 'push', 'explore'] as const

const WALKTHROUGH_URL =
  'https://docs.nuon.co/get-started/app-branches-walkthrough'

type Step = (typeof steps)[number]

function storedStep(): Step {
  try {
    const value = window.localStorage.getItem(TOUR_KEY)
    // Older tours had more steps than this one has; those beats now live
    // elsewhere (or nowhere), so resume at the nearest surviving step.
    if (value === 'toggle' || value === 'day2') return 'explore'
    if (value === 'shipped' || value === 'deployed') return 'instance'
    if (value === 'sandbox' || value === 'components' || value === 'runner') return 'instance'
    if (value === 'branch') return 'push'
    if (value && (steps as readonly string[]).includes(value)) {
      return value as Step
    }
  } catch {
    // Storage can be unavailable (private mode); the tour just starts over.
  }
  return 'arrive'
}

function rememberStep(step: Step) {
  try {
    window.localStorage.setItem(TOUR_KEY, step)
  } catch {
    // Same story: without storage the tour still works, it just forgets.
  }
}

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
              Four recorded procedures; <span className="mono">re-apply-config</span> and{' '}
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
  const [step, setStep] = useState<Step>(storedStep)
  const [cliOpen, setCliOpen] = useState(false)
  const { map } = useCompletion()

  useEffect(() => {
    rememberStep(step)
  }, [step])

  const namespace = config.namespace ?? 'kitchen-sink'

  // Active from the first slide on, not just on 'explore': the three tour
  // slides read podSummary/imageTags below, so the poll has to be live the
  // whole way through for those to be real values instead of placeholders.
  // A returning visitor's stored step is already past 'arrive', so `active`
  // is true from this hook's first mount and nothing changes for them. A
  // first-time visitor who advances from 'arrive' inside boot's MIN_SHOW_MS
  // (lib/boot.ts, 2400ms) flips `active` false -> true mid-lifetime, which
  // re-runs this hook's effect and lets trackBoot catch one more fetch --
  // one extra warm fetch inside the boot window, not a new cold wait.
  const ns = useIntrospectPoll<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
    20_000,
    step !== 'arrive',
  )

  const pods = ns.state === 'ok' ? (ns.value.response.pods ?? []) : []
  const podSummary =
    ns.state === 'ok' ? `${countReady(pods)} / ${pods.length}` : undefined
  const imageTags = ns.state === 'ok' ? runningImageTags(pods) : []

  const idx = steps.indexOf(step)
  const go = (next: Step) => {
    setStep(next)
    window.scrollTo({ top: 0 })
  }
  const next = () => go(steps[Math.min(idx + 1, steps.length - 1)])
  const back = () => go(steps[Math.max(idx - 1, 0)])
  const skip = () => go('explore')

  // Arrow keys page the tour, the way every tour library's users expect.
  // The finish state is a real page, not a step, so it keeps its keys.
  useEffect(() => {
    if (step === 'explore') return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* ---------- Arrival ---------- */

  if (step === 'arrive') {
    return (
      <div className="tour__step" key="arrive">
        <div className="arrive">
          <h1>You&rsquo;re inside a BYOC install.</h1>
          <p className="arrive__lede">
            This page is served by a container in an EKS cluster, in an AWS
            account, that Nuon provisioned and deployed into when you
            installed.
          </p>
          {(config.install_id || config.cluster_name) && (
            <div className="row arrive__chips">
              {config.install_id && (
                <span className="chip">install {config.install_id}</span>
              )}
              {config.cluster_name && (
                <span className="chip">cluster {config.cluster_name}</span>
              )}
            </div>
          )}
          {config.links.versions && (
            <p className="arrive__versions">
              Every config version it has ever run is on record.{' '}
              <OutLink href={config.links.versions} variant="plain">
                See its config versions
              </OutLink>
            </p>
          )}
          <div className="arrive__actions">
            <button className="btn btn--primary" onClick={next}>
              Show me around <Icon name="arrow-right" />
            </button>
            <button className="tour__skip" onClick={skip}>
              Skip the tour <Icon name="arrow-up-right" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ---------- Explore (the finish state, and the returning-visitor state) ---------- */

  if (step === 'explore') {
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
      <div className="tour__step" key="explore">
        <header className="hero">
          <h1 style={{ maxWidth: '28ch' }}>Customize the Kitchen Sink.</h1>
          <p className="hero__lede">
            Everything below runs against this live install.
          </p>
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
            <h2 className="choice__title">Connect your coding agent</h2>
            <p className="choice__desc">
              One command gives Claude Code, Cursor, or Amp Nuon&rsquo;s MCP
              server through the CLI you already have. Then ask it about this
              install; nothing mutates without your yes.
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
                Ten things to ask it <Icon name="arrow-right" />
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
              onClick={() => go('arrive')}
            >
              <Icon name="arrow-left" /> Replay the tour
            </button>
          </div>
        </section>
      </div>
    )
  }

  /* ---------- The three slides between arrival and explore ---------- */

  const tourSteps = steps.slice(1, -1) as Step[]
  const tourIdx = tourSteps.indexOf(step)

  const chrome = (
    <div className="tour__topline">
      <span className="tour__progress">
        slide {tourIdx + 1} of {tourSteps.length}
      </span>
      <span className="tour__dots">
        {tourSteps.map((s, i) => (
          <button
            key={s}
            type="button"
            className={
              i === tourIdx
                ? 'tour__dot tour__dot--active'
                : i < tourIdx
                  ? 'tour__dot tour__dot--done'
                  : 'tour__dot'
            }
            disabled={i > tourIdx}
            aria-label={`slide ${i + 1} of ${tourSteps.length}`}
            {...(i === tourIdx ? { 'aria-current': 'step' as const } : {})}
            onClick={() => go(s)}
          />
        ))}
      </span>
      <button className="tour__skip" onClick={skip}>
        Skip the tour <Icon name="arrow-up-right" />
      </button>
    </div>
  )

  const stepActions = () => (
    <div className="tour__actions">
      <button className="btn btn--ghost" onClick={back}>
        <Icon name="arrow-left" /> Back
      </button>
      <button className="btn btn--primary" onClick={next}>
        Next <Icon name="arrow-right" />
      </button>
    </div>
  )

  const goldenHeader = (title: string, lede: ReactNode) => (
    <header className="step-header">
      <h2>{title}</h2>
      <p className="step-header__lede">{lede}</p>
    </header>
  )

  return (
    <div className="tour__step" key={step}>
      {chrome}

      {step === 'template' && (
        <>
          {goldenHeader(
            'Your app is a template.',
            <>
              A template is every component mapped to one TOML file. Nuon
              reads them into the dependency graph below, and templatizes
              that graph for every install.
            </>,
          )}
          <RelationshipDiagram stage={1} imageTags={imageTags} />
          {stepActions()}
        </>
      )}

      {step === 'instance' && (
        <>
          {goldenHeader(
            'An install is an instance of it, in a customer’s cloud.',
            <>
              An instance is a running copy of the template, in a
              customer&rsquo;s AWS account: its own sandbox, its own
              components, deployed from the same graph.
            </>,
          )}
          <RelationshipDiagram
            stage={2}
            cluster={config.cluster_name}
            region={config.region}
            podsReady={podSummary}
            imageTags={imageTags}
          />
          {stepActions()}
        </>
      )}

      {step === 'push' && (
        <>
          {goldenHeader(
            'To change it, you push.',
            <>
              A push builds the template at that commit. Nuon rolls it out
              install group by install group, with an approval before each
              one. The repo&rsquo;s expected state becomes what&rsquo;s
              running.
            </>,
          )}
          <RelationshipDiagram
            stage={3}
            cluster={config.cluster_name}
            region={config.region}
            podsReady={podSummary}
            imageTags={imageTags}
          />
          <div className="row" style={{ marginTop: 12 }}>
            {config.links.branches && (
              <OutLink href={config.links.branches} variant="plain">
                this branch in Nuon
              </OutLink>
            )}
            <OutLink href={WALKTHROUGH_URL} variant="plain">
              app-branches walkthrough
            </OutLink>
          </div>
          <div className="cta-block">
            <button className="btn btn--primary btn--xl" onClick={next}>
              Customize the Kitchen Sink <Icon name="arrow-right" />
            </button>
          </div>
          <div className="tour__actions" style={{ marginTop: 24 }}>
            <button className="btn btn--ghost" onClick={back}>
              <Icon name="arrow-left" /> Back
            </button>
          </div>
        </>
      )}
    </div>
  )
}
