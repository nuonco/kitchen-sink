import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  countReady,
  hasAuditLogExporter,
  hasTicTacToe,
  useIntrospect,
  useIntrospectPoll,
  type KubeResponse,
  type NamespaceResponse,
  type UIConfig,
} from '../lib/api'
import { branchName } from '../lib/config-data.gen'
import { seenSteps } from '../lib/progress'
import { agentPrompt } from '../lib/prompts'
import { useNavigate } from '../lib/router'
import { pathSteps } from '../lib/taxonomy'
import { ModeBadge, PixelCheck, type SwitchStates } from '../ui/CapabilityGrid'
import { Badge, CopyButton, Icon, OutLink } from '../ui/Primitives'

/* ============================================================
   The landing is a guided walkthrough. A first-time visitor has just
   installed and lands on the arrival moment; each step puts one idea on
   screen and hands them a single "next". The tour ends on the deployed
   step's big CTA into the customize page ('explore'), which is also what
   returning visitors get: progress is remembered in localStorage, and
   "Skip the tour" jumps straight there.
   ============================================================ */

const steps = [
  'arrive',
  'sandbox',
  'components',
  'runner',
  'deployed',
  'explore',
] as const

type Step = (typeof steps)[number]

const TOUR_KEY = 'kitchen-sink-tour'

function storedStep(): Step {
  try {
    const value = window.localStorage.getItem(TOUR_KEY)
    // Older tours had dedicated toggle, day-2 and shipped steps; those beats
    // now live elsewhere, so resume at the nearest surviving step.
    if (value === 'toggle' || value === 'day2') return 'explore'
    if (value === 'shipped') return 'deployed'
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
   A fact panel entry. Every fact is a link: internal facts open the page
   where the rest of that read lives, the install fact opens the dashboard.
   ============================================================ */

function Fact({
  label,
  value,
  note,
  numeric = false,
  delay,
  href,
  external = false,
}: {
  label: string
  value: ReactNode
  note?: string
  numeric?: boolean
  delay?: number
  href?: string
  external?: boolean
}) {
  const pending = value === null || value === undefined || value === ''
  const cls = [
    'fact',
    href ? 'fact--link' : '',
    pending ? 'fact--pending' : '',
    delay === undefined ? '' : 'fact--in',
  ]
    .filter(Boolean)
    .join(' ')
  const style =
    delay === undefined ? undefined : { animationDelay: `${delay}ms` }
  const body = (
    <>
      <div className="fact__label">{label}</div>
      <div className={numeric ? 'fact__value fact__value--num' : 'fact__value'}>
        {pending ? '—' : value}
      </div>
      {note && <div className="fact__note">{note}</div>}
      {href && (
        <span className="fact__go" aria-hidden="true">
          <Icon name="arrow-up-right" />
        </span>
      )}
    </>
  )
  if (href) {
    return (
      <a
        className={cls}
        style={style}
        href={href}
        {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      >
        {body}
      </a>
    )
  }
  return (
    <div className={cls} style={style}>
      {body}
    </div>
  )
}

/* ============================================================
   The golden-path diagram, revealed one part at a time. Parts the tour has
   not reached yet render as ghosts, so each step stays one idea while still
   hinting at the shape of the whole. Revealed parts are clickable and jump
   the tour to that part's step.
   ============================================================ */

type PartKey = 'sandbox' | 'components' | 'runner'

const partOrder: PartKey[] = ['sandbox', 'components', 'runner']

function GoldenPath({
  stage,
  onPick,
}: {
  stage: PartKey
  onPick: (part: PartKey) => void
}) {
  const revealed = partOrder.indexOf(stage)

  const nodeClass = (part: PartKey) => {
    const i = partOrder.indexOf(part)
    if (i > revealed) return 'arch__node arch__node--ghost'
    if (part === stage) return 'arch__node arch__node--active'
    return 'arch__node'
  }

  return (
    <div className="arch">
      <div
        className={
          stage === 'sandbox' ? 'arch__sandbox arch__sandbox--active' : 'arch__sandbox'
        }
      >
        <button
          type="button"
          className="arch__boundary"
          onClick={() => onPick('sandbox')}
        >
          <span className="arch__num">01</span>
          <span className="arch__name">Sandbox</span>
          <span className="arch__hint">VPC · EKS · DNS</span>
        </button>
        <div className="arch__nodes">
          <button
            type="button"
            className={nodeClass('components')}
            disabled={revealed < 1}
            onClick={() => onPick('components')}
          >
            <span className="arch__num">02</span>
            <span className="arch__name">Components</span>
            <span className="arch__hint">kitchen_sink chart</span>
          </button>
          <div
            className={revealed < 2 ? 'arch__edge arch__edge--ghost' : 'arch__edge'}
            aria-hidden="true"
          >
            <span className="arch__edge-label">deploys</span>
            <span className="arch__edge-line" />
          </div>
          <button
            type="button"
            className={nodeClass('runner')}
            disabled={revealed < 2}
            onClick={() => onPick('runner')}
          >
            <span className="arch__num">03</span>
            <span className="arch__name">Runner</span>
            <span className="arch__hint">builds &amp; deploys here</span>
          </button>
        </div>
      </div>
    </div>
  )
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
      rows: [{ cmd: 'nuon auth login', note: 'Keeps a session in ~/.nuon. Skip if you already have one.' }],
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
              Four recorded procedures; <span className="mono">reconcile-drift</span> and{' '}
              <span className="mono">break-glass</span> mutate.
            </>
          ),
        },
        {
          cmd: `nuon runbooks create-run --install-id ${install} --runbook-id full-health-check`,
          note: 'Nodes, workloads, ingress, and the public endpoint.',
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
              cron_status &middot; debug &middot; lifecycle_hooks &middot;{' '}
              break_glass_remediation. Copy the workflow id (
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

  useEffect(() => {
    rememberStep(step)
  }, [step])

  const namespace = config.namespace ?? 'kitchen-sink'
  const kube = useIntrospect<KubeResponse>('/api/introspect/kube')

  // The namespace read doubles as the toggleable-component watcher: while the
  // hub is on screen and either component is still off, keep re-reading so
  // flipping one on in the dashboard flips its row's switch here without a
  // reload.
  const [tictactoe, setTictactoe] = useState(false)
  const [tictactoeFlipped, setTictactoeFlipped] = useState(false)
  const [auditLog, setAuditLog] = useState(false)
  const [auditLogFlipped, setAuditLogFlipped] = useState(false)
  const sawTictactoeOff = useRef(false)
  const sawAuditLogOff = useRef(false)
  const ns = useIntrospectPoll<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
    20_000,
    step === 'explore' && !(tictactoe && auditLog),
  )

  useEffect(() => {
    if (ns.state !== 'ok') return
    const services = ns.value.response.services ?? []
    if (hasTicTacToe(services)) {
      if (sawTictactoeOff.current) setTictactoeFlipped(true)
      setTictactoe(true)
    } else {
      sawTictactoeOff.current = true
    }
    if (hasAuditLogExporter(services)) {
      if (sawAuditLogOff.current) setAuditLogFlipped(true)
      setAuditLog(true)
    } else {
      sawAuditLogOff.current = true
    }
  }, [ns])

  const switches: SwitchStates = {
    '/tictactoe': { on: tictactoe, flipped: tictactoeFlipped },
    '/audit-log': { on: auditLog, flipped: auditLogFlipped },
  }

  const namespaceCount =
    kube.state === 'ok' ? kube.value.response.namespaces?.length : undefined
  const pods = ns.state === 'ok' ? (ns.value.response.pods ?? []) : []
  const podSummary =
    ns.state === 'ok' ? `${countReady(pods)} / ${pods.length}` : undefined

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
    // The other two live tiles are the toggleable components: their switches
    // move while you watch (the namespace poll above feeds them).
    const tiles = pathSteps.filter(
      (s) => s.to === '/audit-log' || s.to === '/tictactoe',
    )
    const phases = ['Read', 'Ship', 'Operate', 'Govern'] as const
    return (
      <div className="tour__step" key="explore">
        <header className="hero">
          <h1 style={{ maxWidth: '28ch' }}>Customize the Kitchen Sink.</h1>
          <p className="hero__lede">
            Everything below runs against this live install. Two ways to
            drive it:
          </p>
        </header>

        <div className="choices">
          <section className="choice">
            <h2 className="choice__title">Paste into your coding agent</h2>
            <p className="choice__desc">
              One prompt covers the whole checklist, ids filled in. Nothing
              mutates without your yes.
            </p>
            <div className="choice__actions">
              <CopyButton
                text={agentPrompt(install, app)}
                label="Copy the agent prompt"
                doneLabel="Copied"
                big
              />
              <a href="#/customize/agent">
                Read it first <Icon name="arrow-right" />
              </a>
            </div>
          </section>

          <button
            type="button"
            className={cliOpen ? 'choice choice--toggle choice--open' : 'choice choice--toggle'}
            aria-expanded={cliOpen}
            aria-controls="cli-commands"
            onClick={() => setCliOpen((open) => !open)}
          >
            <span className="choice__title">Just show me the Nuon CLI</span>
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
            <h2 className="section__title">Live right now</h2>
          </div>
          <div className="nods">
            <GoLink to="/deployed" className="nod">
              <span className="nod__top">
                <span className="nod__title">Read your live install</span>
                <Badge tone="positive" dot>
                  live
                </Badge>
              </span>
              <span className="nod__desc">
                {podSummary
                  ? `${podSummary} pods ready in ${namespace}, read as this page loads.`
                  : 'Pods, services, and secrets, straight from the cluster.'}
              </span>
            </GoLink>
            {tiles.map((s) => {
              const sw = switches[s.to]
              return (
                <GoLink to={s.to} className="nod" key={s.to}>
                  <span className="nod__top">
                    <span className="nod__title">{s.title}</span>
                    {sw ? (
                      <span
                        className={
                          sw.on
                            ? 'switch switch--sm switch--on'
                            : 'switch switch--sm'
                        }
                        aria-hidden="true"
                      />
                    ) : (
                      <ModeBadge mode={s.mode} />
                    )}
                  </span>
                  <span className="nod__desc">{s.desc}</span>
                </GoLink>
              )
            })}
          </div>
        </section>

        <section className="section section--hub">
          <div className="section__head">
            <h2 className="section__title">Index</h2>
          </div>
          <div className="encyc">
            {phases.map((phase) => (
              <div className="encyc__group" key={phase}>
                <div className="encyc__phase">{phase}</div>
                <ul className="encyc__list">
                  {pathSteps
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

  /* ---------- The four tour steps between arrival and explore ---------- */

  const tourSteps = steps.slice(1, -1) as Step[]
  const tourIdx = tourSteps.indexOf(step)

  const chrome = (
    <div className="tour__topline">
      <span className="tour__progress">
        step {tourIdx + 1} of {tourSteps.length}
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
            aria-label={`Step ${i + 1} of ${tourSteps.length}`}
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

      {step === 'sandbox' && (
        <>
          {goldenHeader(
            'It starts with a sandbox.',
            <>
              The footprint Nuon creates in your customer&rsquo;s cloud
              account. Here it&rsquo;s{' '}
              <span className="mono">aws-eks-sandbox</span>: a VPC, an EKS
              cluster, and a public DNS zone.
            </>,
          )}
          <GoldenPath stage="sandbox" onPick={(p) => go(p)} />
          {config.cluster_name && (
            <div className="row" style={{ marginTop: 16 }}>
              <span className="chip">cluster {config.cluster_name}</span>
              {config.region && <span className="chip">{config.region}</span>}
            </div>
          )}
          {stepActions()}
        </>
      )}

      {step === 'components' && (
        <>
          {goldenHeader(
            'Components are your product.',
            <>
              One component is one deployable piece of your product. Here the{' '}
              <span className="mono">kitchen_sink</span> Helm chart deploys the
              API, the worker, and the UI you&rsquo;re reading.
            </>,
          )}
          <GoldenPath stage="components" onPick={(p) => go(p)} />
          {podSummary && (
            <div className="row" style={{ marginTop: 16 }}>
              <span className="chip">
                {podSummary} pods ready in {namespace}
              </span>
            </div>
          )}
          {stepActions()}
        </>
      )}

      {step === 'runner' && (
        <>
          {goldenHeader(
            'The runner does the deploying.',
            <>
              An agent Nuon runs inside the account. Every build and deploy
              happens from in there, so your customer&rsquo;s credentials never
              leave their cloud.
            </>,
          )}
          <GoldenPath stage="runner" onPick={(p) => go(p)} />
          {stepActions()}
        </>
      )}

      {step === 'deployed' && (
        <>
          <header className="step-header">
            <h2>Here&rsquo;s what Nuon deployed.</h2>
            <p className="step-header__lede">
              Read from the cluster as this page loads; each fact opens the
              record behind it.
            </p>
          </header>
          <div className="facts">
            <Fact
              label="Install"
              value={config.install_id}
              note="The tenant this app belongs to"
              delay={0}
              href={config.links.install}
              external
            />
            <Fact
              label="Cluster"
              value={config.cluster_name}
              note={config.region ? `EKS in ${config.region}` : 'EKS'}
              delay={140}
              href="#/deployed/cluster"
            />
            <Fact
              label="Namespaces"
              value={namespaceCount}
              note="Read from the Kubernetes API"
              numeric
              delay={280}
              href="#/deployed/cluster"
            />
            <Fact
              label={`Pods ready in ${namespace}`}
              value={podSummary}
              note="api, ui, worker"
              numeric
              delay={420}
              href="#/deployed/namespace"
            />
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
