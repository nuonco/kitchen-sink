import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  countReady,
  hasComplianceExport,
  hasTicTacToe,
  useIntrospect,
  useIntrospectPoll,
  type KubeResponse,
  type NamespaceResponse,
  type SyncPipelinesResponse,
  type UIConfig,
} from '../lib/api'
import { agentPrompt } from '../lib/prompts'
import { EvalPath, type SwitchStates } from '../ui/CapabilityGrid'
import { CopyButton, Icon, OutLink } from '../ui/Primitives'
import { PipelineStrip, timeAgo } from './Pipelines'

/* ============================================================
   The landing is a guided walkthrough. A first-time visitor has just
   installed Conduit and lands on the activation moment — a pipeline already
   wrote to their bucket; each step then puts one idea on screen: the
   sandbox, the components, the runner, the working product. The tour ends
   on the operate hub ('explore'), which is also what returning visitors
   get: progress is remembered in localStorage, and "Skip the tour" jumps
   straight there.
   ============================================================ */

const steps = [
  'arrive',
  'sandbox',
  'components',
  'runner',
  'working',
  'explore',
] as const

type Step = (typeof steps)[number]

const TOUR_KEY = 'conduit-tour'

function storedStep(): Step {
  try {
    const value = window.localStorage.getItem(TOUR_KEY)
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
            <span className="arch__hint">engine · db · bucket · UI</span>
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
   The operate hub: the tour's destination, and the returning-visitor front
   door. One ordered path from lib/taxonomy.ts, with the agent prompt as the
   default way to run it.
   ============================================================ */

export function Landing({ config }: { config: UIConfig }) {
  const [step, setStep] = useState<Step>(storedStep)

  useEffect(() => {
    rememberStep(step)
  }, [step])

  const namespace = config.namespace ?? 'conduit'
  const kube = useIntrospect<KubeResponse>('/api/introspect/kube')

  // The namespace read doubles as the toggleable-component watcher: while the
  // hub is on screen and either component is still off, keep re-reading so
  // flipping one on in the dashboard flips its row's switch here without a
  // reload.
  const [tictactoe, setTictactoe] = useState(false)
  const [tictactoeFlipped, setTictactoeFlipped] = useState(false)
  const [compliance, setCompliance] = useState(false)
  const [complianceFlipped, setComplianceFlipped] = useState(false)
  const sawTictactoeOff = useRef(false)
  const sawComplianceOff = useRef(false)
  const ns = useIntrospectPoll<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
    20_000,
    step === 'explore' && !(tictactoe && compliance),
  )

  // The sync engine's own state, for the "it's already working" step.
  const sync = useIntrospectPoll<SyncPipelinesResponse>(
    '/api/sync/pipelines',
    10_000,
    step === 'working',
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
    if (hasComplianceExport(services)) {
      if (sawComplianceOff.current) setComplianceFlipped(true)
      setCompliance(true)
    } else {
      sawComplianceOff.current = true
    }
  }, [ns])

  const switches: SwitchStates = {
    '/tictactoe': { on: tictactoe, flipped: tictactoeFlipped },
    '/destinations': { on: compliance, flipped: complianceFlipped },
  }

  const pods = ns.state === 'ok' ? (ns.value.response.pods ?? []) : []
  const podSummary =
    ns.state === 'ok' ? `${countReady(pods)} / ${pods.length}` : undefined
  const namespaceCount =
    kube.state === 'ok' ? kube.value.response.namespaces?.length : undefined

  const syncData = sync.state === 'ok' ? sync.value.response : undefined
  const lastLanded = syncData?.pipelines
    ?.map((p) => p.last_run?.started_at)
    .filter((t): t is string => Boolean(t))
    .sort()
    .pop()

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
          <h1>Your pipelines run in your account.</h1>
          <p className="arrive__lede">
            Conduit is self-hosted data sync: the engine, the source database,
            and the destination bucket all live in this AWS account &mdash;
            Nuon put them there when you installed. Data never leaves. The
            first sync has already landed:
          </p>
          <PipelineStrip />
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
          <div className="arrive__actions">
            <button className="btn btn--primary" onClick={next}>
              How did it get here? <Icon name="arrow-right" />
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
    return (
      <div className="tour__step" key="explore">
        <header className="hero">
          <h1 style={{ maxWidth: '28ch' }}>Operate Conduit.</h1>
          <p className="hero__lede">
            Features ship through app branches and toggleable components;
            monitoring and fixing run through health checks, runbooks,
            actions, and roles. Each step below proves one of them on this
            install.
          </p>
          <div className="agent-cta">
            <div className="agent-cta__body">
              <div className="agent-cta__title">
                The default way to run it: your coding agent
              </div>
              <p className="agent-cta__desc">
                One prompt covers the whole checklist, ids filled in. The
                agent shows every command and waits for your yes before
                anything mutates.
              </p>
            </div>
            <div className="agent-cta__actions">
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
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <a className="btn btn--primary btn--xl" href="#/ops">
              I can reason about all of this. Just show me the things it can
              do. <Icon name="arrow-right" />
            </a>
          </div>
          <div className="row" style={{ marginTop: 20 }}>
            <button
              className="tour__skip"
              style={{ marginLeft: 0 }}
              onClick={() => go('arrive')}
            >
              <Icon name="arrow-left" /> Replay the tour
            </button>
          </div>
        </header>

        <EvalPath switches={switches} />

        {config.links.install && (
          <section className="section">
            <div className="card">
              <p className="small muted" style={{ maxWidth: '70ch' }}>
                This app reads the install from the inside. The Nuon dashboard
                operates it, and every other install, from the outside.
              </p>
              <div className="row" style={{ marginTop: 20 }}>
                <OutLink href={config.links.install}>
                  Open this install in Nuon
                </OutLink>
                <OutLink
                  href="https://docs.nuon.co/get-started/introduction"
                  variant="secondary"
                >
                  Read the docs
                </OutLink>
              </div>
            </div>
          </section>
        )}
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
              The footprint Nuon creates in the customer&rsquo;s cloud
              account. Here it&rsquo;s{' '}
              <span className="mono">aws-eks-sandbox</span>: a VPC, an EKS
              cluster, and a public DNS zone. Everything Conduit does happens
              inside this boundary &mdash; that is why the data never leaves.
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
            'Components are the product.',
            <>
              One component is one deployable piece. The{' '}
              <span className="mono">conduit</span> Helm chart ships the sync
              engine, the source Postgres, the API, and the UI you&rsquo;re
              reading; <span className="mono">destination_bucket</span> ships
              the S3 bucket and the IAM role the engine writes with. The
              compliance export is a component too &mdash; toggleable, so it
              deploys only where the plan includes it.
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
              An agent Nuon runs inside the account. Every build, deploy,
              runbook, and action executes from in there &mdash; it needs no
              inbound access, and your customer&rsquo;s credentials never
              leave their cloud.
            </>,
          )}
          <GoldenPath stage="runner" onPick={(p) => go(p)} />
          {stepActions()}
        </>
      )}

      {step === 'working' && (
        <>
          <header className="step-header">
            <h2>And it&rsquo;s already working.</h2>
            <p className="step-header__lede">
              Read as this page loads &mdash; from the sync engine&rsquo;s own
              run history and the cluster underneath it. Each fact opens the
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
              label="Pipelines"
              value={syncData ? syncData.pipelines_count : undefined}
              note="registered in the engine"
              numeric
              delay={140}
              href="#/pipelines"
            />
            <Fact
              label="Last sync landed"
              value={syncData ? timeAgo(lastLanded, Date.now()) : undefined}
              note={syncData?.bucket ? `in ${syncData.bucket}` : 'in your bucket'}
              numeric
              delay={280}
              href="#/pipelines"
            />
            <Fact
              label="Namespaces"
              value={namespaceCount}
              note="Read from the Kubernetes API"
              numeric
              delay={420}
              href="#/under-the-hood/cluster"
            />
          </div>
          <div className="cta-block">
            <button className="btn btn--primary btn--xl" onClick={next}>
              Operate Conduit <Icon name="arrow-right" />
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
