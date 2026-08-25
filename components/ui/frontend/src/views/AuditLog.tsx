import { useEffect, useRef, useState } from 'react'
import {
  hasAuditLogExporter,
  hasTicTacToe,
  useIntrospectPoll,
  type NamespaceEvent,
  type NamespaceEventsResponse,
  type NamespaceResponse,
  type UIConfig,
} from '../lib/api'
import { toggleableComponents } from '../lib/config-data.gen'
import { stepEyebrow } from '../lib/taxonomy'
import { useMarkStepSeen } from '../lib/progress'
import { StepNav } from '../ui/CapabilityGrid'
import {
  BackLink,
  Badge,
  CodeBlock,
  Eyebrow,
  LoadState,
  OutLink,
  PspSection,
  PspTag,
} from '../ui/Primitives'

/* ============================================================
   SKU management: both toggleable components side by side, as the plan
   gate they demonstrate. Same mechanic on each — toggleable = true,
   default_enabled = false, a marker Service this page watches for.
   ============================================================ */

/** How often the page re-reads the namespace looking for a deploy. */
const POLL_MS = 10_000

/** How often the events feed re-reads the namespace's events. */
const EVENTS_POLL_MS = 5_000

/** One SKU, drawn: a live readout up top (never a switch — the real control
 * is in the dashboard) and the dashboard deep link as the one action. */
function SkuCard({
  plan,
  name,
  pitch,
  on,
  justOn,
  config,
  onDashboardOpen,
  playHref,
}: {
  plan: string
  name: string
  pitch: string
  on: boolean
  justOn: boolean
  config: UIConfig
  onDashboardOpen: () => void
  playHref?: string
}) {
  return (
    <div className={justOn ? 'ttt--just-unlocked' : undefined}>
      {justOn && (
        <div className="ttt-unlocked-note">
          <Badge tone="positive" dot>
            just deployed
          </Badge>
          <span>
            Its Service appeared in the namespace and this page noticed. No
            reload.
          </span>
        </div>
      )}
      <div className={on ? 'ent ent--on' : 'ent'}>
        <div className="ent__head">
          <span className="ent__plan">{plan}</span>
          <span className="entstat mono" role="status">
            <span
              className={on ? 'entstat__dot entstat__dot--on' : 'entstat__dot'}
              aria-hidden="true"
            />
            {on ? 'on' : 'off · watching'}
          </span>
        </div>
        <div className="ent__name mono">{name}</div>
        <p className="ent__pitch">{pitch}</p>
        <div className="ent__foot">
          {on ? (
            <>
              <Badge tone="positive" dot>
                included in this install
              </Badge>
              {playHref && <a href={playHref}>Play it</a>}
            </>
          ) : (
            <OutLink href={config.links.components} onClick={onDashboardOpen}>
              Turn it on in Nuon
            </OutLink>
          )}
          <span className="ent__facts mono">
            toggleable = true · default_enabled = false
          </span>
        </div>
      </div>
    </div>
  )
}

/** The mechanism, as three beats instead of a paragraph. */
function HowItKnows({
  config,
  namespace,
  live,
  onDashboardOpen,
}: {
  config: UIConfig
  namespace: string
  live: boolean
  onDashboardOpen: () => void
}) {
  const beats = [
    {
      label: 'toggle',
      detail: 'component on, in the dashboard',
      href: config.links.components,
    },
    { label: 'deploy', detail: 'Nuon applies its marker Service' },
    {
      label: live ? 'narrate' : 'detect',
      detail: live
        ? `this page reads ${namespace} events every ${EVENTS_POLL_MS / 1000}s`
        : `this page re-reads ${namespace} every ${POLL_MS / 1000}s`,
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

function relativeTime(iso: string | null | undefined, now: number): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/**
 * Stable identities for the rows, so a poll can be diffed against the last
 * one. Kubernetes dedupes events server-side; the suffix covers the rare
 * identical pair anyway.
 */
function eventKeys(events: NamespaceEvent[]): string[] {
  const used = new Map<string, number>()
  return events.map((ev) => {
    const base = [
      ev.involvedObject?.kind,
      ev.involvedObject?.name,
      ev.reason,
      ev.message,
      ev.lastTimestamp,
      ev.count,
    ].join('|')
    const n = used.get(base) ?? 0
    used.set(base, n + 1)
    return n === 0 ? base : `${base}#${n}`
  })
}

/**
 * The live part: the namespace's own Kubernetes events, re-read every few
 * seconds for as long as the page is open. Rows that were not in the previous
 * poll flash once — that is a real operation landing, not a replay.
 */
function EventsFeed({ namespace, config }: { namespace: string; config: UIConfig }) {
  const events = useIntrospectPoll<NamespaceEventsResponse>(
    `/api/introspect/namespace/${namespace}/events`,
    EVENTS_POLL_MS,
    true,
  )
  // Keys seen by the previous poll; null until the first one lands, so the
  // initial render never flashes.
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (events.state !== 'ok') return
    const keys = eventKeys(events.value.response.events ?? [])
    if (seen.current !== null) {
      const arrived = keys.filter((k) => !seen.current?.has(k))
      if (arrived.length > 0) setFresh(new Set(arrived))
    }
    seen.current = new Set(keys)
  }, [events])

  if (events.state !== 'ok') {
    return <LoadState result={events} what={`events in ${namespace}`} />
  }

  const list = events.value.response.events ?? []
  const keys = eventKeys(list)
  const now = Date.now()

  return (
    <div className="evtfeed" style={{ marginTop: 16 }}>
      <div className="evtfeed__head">
        <span className="evtfeed__dot" aria-hidden="true" />
        <span>Kubernetes events in {namespace}, newest first</span>
        <span className="evtfeed__meta mono">
          re-read every {EVENTS_POLL_MS / 1000}s
        </span>
      </div>
      {list.length === 0 ? (
        <p className="evtfeed__empty">
          Nothing yet — Kubernetes expires events after about an hour of quiet.
        </p>
      ) : (
        <ol className="evtfeed__list">
          {list.map((ev, i) => {
            const key = keys[i]
            const cls = [
              'evt',
              ev.type === 'Warning' ? 'evt--warning' : '',
              fresh.has(key) ? 'evt--new' : '',
            ]
              .filter(Boolean)
              .join(' ')
            const obj = [ev.involvedObject?.kind, ev.involvedObject?.name]
              .filter(Boolean)
              .join('/')
            return (
              <li key={key} className={cls}>
                <span className="evt__time mono">
                  {relativeTime(ev.lastTimestamp ?? ev.firstTimestamp, now)}
                </span>
                <span className="evt__reason mono">{ev.reason || '—'}</span>
                <span className="evt__obj mono">{obj || '—'}</span>
                <span className="evt__msg">
                  {ev.message}
                  {(ev.count ?? 1) > 1 && (
                    <span className="evt__count mono"> ×{ev.count}</span>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
      )}
      <p className="evtfeed__invite">
        Toggle a component off and on in{' '}
        {config.links.components ? (
          <OutLink href={config.links.components} variant="plain">
            the dashboard
          </OutLink>
        ) : (
          'the dashboard'
        )}{' '}
        and the teardown and redeploy land here as they happen.
      </p>
    </div>
  )
}

export function AuditLog({ config }: { config: UIConfig }) {
  useMarkStepSeen('/audit-log')
  const namespace = config.namespace ?? 'kitchen-sink'
  const [audit, setAudit] = useState(false)
  const [auditJust, setAuditJust] = useState(false)
  const [ttt, setTtt] = useState(false)
  const [tttJust, setTttJust] = useState(false)
  const [waiting, setWaiting] = useState(false)
  // True once the visitor has actually seen a card off, so an unlock detected
  // later is a real on-screen moment rather than the initial load.
  const sawAuditOff = useRef(false)
  const sawTttOff = useRef(false)

  const ns = useIntrospectPoll<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
    POLL_MS,
    !(audit && ttt),
  )

  useEffect(() => {
    if (ns.state !== 'ok') return
    const services = ns.value.response.services ?? []
    if (hasAuditLogExporter(services)) {
      if (sawAuditOff.current) setAuditJust(true)
      setAudit(true)
    } else {
      sawAuditOff.current = true
    }
    if (hasTicTacToe(services)) {
      if (sawTttOff.current) setTttJust(true)
      setTtt(true)
    } else {
      sawTttOff.current = true
    }
  }, [ns])

  const exporter = toggleableComponents.find(
    (c) => c.name === 'audit_log_exporter',
  )
  const tictactoe = toggleableComponents.find((c) => c.name === 'tictactoe')
  const ready = audit || ttt || ns.state === 'ok'
  const bothOn = audit && ttt

  return (
    <>
      <BackLink to="/">Customize the Kitchen Sink</BackLink>
      <header className="page-header">
        <Eyebrow>{stepEyebrow('/audit-log')}</Eyebrow>
        <h1>SKU management</h1>
        <p className="lede psp-lede">
          <PspTag kind="problem" /> One plan tier includes a feature the
          others don&rsquo;t, and every install runs the same config.
        </p>
      </header>

      {!ready && <LoadState result={ns} what={`the ${namespace} namespace`} />}

      {ready && (
        <>
          <PspSection
            kind="solution"
            title="Toggleable components"
            aside="components/{audit_log_exporter,tictactoe}.toml"
          >
            <p className="small muted" style={{ maxWidth: '72ch' }}>
              Both features below ship in every install&rsquo;s config,
              switched off. Flip one on for an install and Nuon deploys it
              there; flip it off and it is torn down. A feature a plan
              doesn&rsquo;t include isn&rsquo;t hidden behind a flag —
              it isn&rsquo;t running in that customer&rsquo;s cloud at all.
              (Here each deploys one marker Service; a real feature puts its
              workload behind the same switch.){' '}
              <OutLink
                href="https://docs.nuon.co/guides/toggleable-components"
                variant="plain"
              >
                Toggleable components docs
              </OutLink>
            </p>
            <div className="choices">
              <SkuCard
                plan="Enterprise plan"
                name="audit_log_exporter"
                pitch="Streams every operation Nuon performs in this install to your SIEM. Events never leave your cloud."
                on={audit}
                justOn={auditJust}
                config={config}
                onDashboardOpen={() => setWaiting(true)}
              />
              <SkuCard
                plan="Add-on"
                name="tictactoe"
                pitch="A playable game — the stand-in for whatever you’d gate per plan."
                on={ttt}
                justOn={tttJust}
                config={config}
                onDashboardOpen={() => setWaiting(true)}
                playHref="#/tictactoe"
              />
            </div>
            {exporter && (
              <CodeBlock
                label="audit_log_exporter.toml (the real config, comments stripped)"
                code={exporter.toml}
              />
            )}
            {tictactoe && (
              <CodeBlock
                label="tictactoe.toml (the real config, comments stripped)"
                code={tictactoe.toml}
              />
            )}
          </PspSection>

          <PspSection
            kind="proof"
            title={bothOn ? 'What introspection sees' : 'Flip one on and watch'}
            aside={
              audit
                ? `GET /introspect/namespace/${namespace}/events`
                : `GET /introspect/namespace/${namespace}`
            }
          >
            <HowItKnows
              config={config}
              namespace={namespace}
              live={audit}
              onDashboardOpen={() => setWaiting(true)}
            />
            {!bothOn && (
              <div className="ttt-watch">
                {waiting ? (
                  <>
                    <Badge tone="warning" dot>
                      waiting for the deploy
                    </Badge>
                    <span>
                      Toggle a component on in the dashboard tab and deploy
                      it; its card flips when the Service appears.
                    </span>
                  </>
                ) : (
                  <>
                    <Badge tone="accent" dot>
                      watching live
                    </Badge>
                    <span>
                      Checking this namespace for the marker Services every{' '}
                      {POLL_MS / 1000} seconds.
                    </span>
                  </>
                )}
              </div>
            )}
            {audit && <EventsFeed namespace={namespace} config={config} />}
          </PspSection>
        </>
      )}
      <StepNav current="/audit-log" />
    </>
  )
}
