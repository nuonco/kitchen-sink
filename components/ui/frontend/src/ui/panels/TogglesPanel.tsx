import { useEffect, useRef, useState } from 'react'
import {
  hasAuditLogExporter,
  hasTicTacToe,
  useIntrospectPoll,
  type NamespaceEvent,
  type NamespaceEventsResponse,
  type UIConfig,
} from '../../lib/api'
import { toggleableComponents } from '../../lib/config-data.gen'
import type { PanelProps } from '../../lib/panels'
import { Badge, CodeBlock, Disclosure, LoadState, OutLink } from '../Primitives'
import { PANEL_POLL_MS, useNamespacePoll } from './shared'

/* ============================================================
   toggles: the two toggleable components, read live from the marker
   Services they deploy; the namespace's Kubernetes events while the
   exporter is on; and the tic-tac-toe game, playable once its component
   is on. From the old "SKU management" and "Tic-tac-toe" pages.
   ============================================================ */

const EVENTS_POLL_MS = 5_000

function SkuCard({
  plan,
  name,
  pitch,
  on,
  justOn,
  config,
  onDashboardOpen,
}: {
  plan: string
  name: string
  pitch: string
  on: boolean
  justOn: boolean
  config: UIConfig
  onDashboardOpen: () => void
}) {
  return (
    <div className={justOn ? 'ttt--just-unlocked' : undefined}>
      {justOn && (
        <div className="ttt-unlocked-note">
          <Badge tone="positive" dot>
            deployed
          </Badge>
          <span>Its Service appeared in the namespace on the last poll.</span>
        </div>
      )}
      <div className={on ? 'ent ent--on' : 'ent'}>
        <div className="ent__head">
          <span className="ent__plan">{plan}</span>
          <span className="entstat mono" role="status">
            <span className={on ? 'entstat__dot entstat__dot--on' : 'entstat__dot'} aria-hidden="true" />
            {on ? 'on' : 'off · watching'}
          </span>
        </div>
        <div className="ent__name mono">{name}</div>
        <p className="ent__pitch">{pitch}</p>
        <div className="ent__foot">
          {on ? (
            <Badge tone="positive" dot>
              included in this install
            </Badge>
          ) : (
            <OutLink href={config.links.components} onClick={onDashboardOpen}>
              {name} in Nuon
            </OutLink>
          )}
          <span className="ent__facts mono">toggleable = true · default_enabled = false</span>
        </div>
      </div>
    </div>
  )
}

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
    { label: 'toggle', detail: 'component on, in the dashboard', href: config.links.components },
    { label: 'deploy', detail: 'Nuon applies its marker Service' },
    {
      label: live ? 'read' : 'detect',
      detail: live
        ? `${namespace} events re-read every ${EVENTS_POLL_MS / 1000}s`
        : `${namespace} re-read every ${PANEL_POLL_MS / 1000}s`,
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
  if (!iso) return 'n/a'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 'n/a'
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

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

function EventsFeed({ namespace, config }: { namespace: string; config: UIConfig }) {
  const events = useIntrospectPoll<NamespaceEventsResponse>(
    `/api/introspect/namespace/${namespace}/events`,
    EVENTS_POLL_MS,
    true,
  )
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
        <span className="evtfeed__meta mono">re-read every {EVENTS_POLL_MS / 1000}s</span>
      </div>
      {list.length === 0 ? (
        <p className="evtfeed__empty">
          Nothing yet. Kubernetes expires events after about an hour of quiet.
        </p>
      ) : (
        <ol className="evtfeed__list">
          {list.map((ev, i) => {
            const key = keys[i]
            const cls = ['evt', ev.type === 'Warning' ? 'evt--warning' : '', fresh.has(key) ? 'evt--new' : '']
              .filter(Boolean)
              .join(' ')
            const obj = [ev.involvedObject?.kind, ev.involvedObject?.name].filter(Boolean).join('/')
            return (
              <li key={key} className={cls}>
                <span className="evt__time mono">{relativeTime(ev.lastTimestamp ?? ev.firstTimestamp, now)}</span>
                <span className="evt__reason mono">{ev.reason || 'n/a'}</span>
                <span className="evt__obj mono">{obj || 'n/a'}</span>
                <span className="evt__msg">
                  {ev.message}
                  {(ev.count ?? 1) > 1 && <span className="evt__count mono"> ×{ev.count}</span>}
                </span>
              </li>
            )
          })}
        </ol>
      )}
      <p className="evtfeed__invite">
        A toggle off and on in{' '}
        {config.links.components ? (
          <OutLink href={config.links.components} variant="plain">
            the dashboard
          </OutLink>
        ) : (
          'the dashboard'
        )}{' '}
        lands the teardown and the redeploy here as they happen.
      </p>
    </div>
  )
}

/* ---------- tic-tac-toe, playable once its component is on ---------- */

type Cell = 'X' | 'O' | null

const lines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

function winningLine(board: Cell[]): number[] | null {
  for (const line of lines) {
    const [a, b, c] = line
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line
  }
  return null
}

function Game() {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null))
  const [xToMove, setXToMove] = useState(true)
  const line = winningLine(board)
  const winner = line ? board[line[0]] : null
  const over = Boolean(winner) || board.every(Boolean)
  const play = (i: number) => {
    if (board[i] || over) return
    const next = board.slice()
    next[i] = xToMove ? 'X' : 'O'
    setBoard(next)
    setXToMove(!xToMove)
  }
  const reset = () => {
    setBoard(Array(9).fill(null))
    setXToMove(true)
  }
  const status = winner ? `${winner} wins` : over ? 'A draw' : `${xToMove ? 'X' : 'O'} to move`
  return (
    <div className="ttt">
      <div className="ttt__status" role="status">
        {status}
      </div>
      <div className="ttt__board">
        {board.map((cell, i) => (
          <button
            key={i}
            className={line?.includes(i) ? 'ttt__cell ttt__cell--win' : 'ttt__cell'}
            onClick={() => play(i)}
            disabled={Boolean(cell) || over}
            aria-label={cell ?? `Square ${i + 1}`}
          >
            {cell}
          </button>
        ))}
      </div>
      <button className="btn btn--secondary" onClick={reset}>
        Play again
      </button>
    </div>
  )
}

/* ---------- the panel ---------- */

function useToggleState(config: UIConfig) {
  const { namespace, ns } = useNamespacePoll(config)
  const [audit, setAudit] = useState(false)
  const [auditJust, setAuditJust] = useState(false)
  const [ttt, setTtt] = useState(false)
  const [tttJust, setTttJust] = useState(false)
  const sawAuditOff = useRef(false)
  const sawTttOff = useRef(false)

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

  return { namespace, ns, audit, auditJust, ttt, tttJust }
}

export function TogglesTile({ config }: PanelProps) {
  const { ns, audit, ttt } = useToggleState(config)
  const state = (on: boolean) => (ns.state === 'ok' ? (on ? 'on' : 'off') : '…')
  return (
    <>
      <span className="ptile__value">
        audit_log_exporter {state(audit)} · tictactoe {state(ttt)}
      </span>
      <span className="ptile__label mono">
        {toggleableComponents.length} toggleable components · read from their marker Services
      </span>
    </>
  )
}

export function TogglesDrawer({ config }: PanelProps) {
  const { namespace, ns, audit, auditJust, ttt, tttJust } = useToggleState(config)
  const [waiting, setWaiting] = useState(false)
  const exporter = toggleableComponents.find((c) => c.name === 'audit_log_exporter')
  const tictactoe = toggleableComponents.find((c) => c.name === 'tictactoe')
  const bothOn = audit && ttt

  return (
    <>
      <div className="section__head">
        <h3 className="section__title">{toggleableComponents.length} toggleable components</h3>
      </div>
      <Disclosure summary="what a toggle changes in the install">
        <p className="small muted" style={{ maxWidth: '72ch' }}>
          Each ships in every install&rsquo;s config, switched off. Flip one on for an install and Nuon
          deploys it there; flip it off and it is torn down. Off means not deployed: no pods, no Service,
          nothing for that feature in the customer&rsquo;s cloud. Here each deploys one marker Service.{' '}
          <OutLink href="https://docs.nuon.co/guides/toggleable-components" variant="plain">
            Toggleable components docs
          </OutLink>
        </p>
      </Disclosure>
      <LoadState result={ns} what={`the ${namespace} namespace`} />
      <div className="choices">
        <SkuCard
          plan="Enterprise plan"
          name="audit_log_exporter"
          pitch="The stand-in for a feature sold per plan."
          on={audit}
          justOn={auditJust}
          config={config}
          onDashboardOpen={() => setWaiting(true)}
        />
        <SkuCard
          plan="Add-on"
          name="tictactoe"
          pitch="A playable game, the stand-in for whatever you gate per plan."
          on={ttt}
          justOn={tttJust}
          config={config}
          onDashboardOpen={() => setWaiting(true)}
        />
      </div>
      {exporter && <CodeBlock label="audit_log_exporter.toml (comments stripped)" code={exporter.toml} />}
      {tictactoe && <CodeBlock label="tictactoe.toml (comments stripped)" code={tictactoe.toml} />}

      <div className="section__head" style={{ marginTop: 24 }}>
        <h3 className="section__title">Marker Service detection</h3>
        <div className="subtext muted">
          {audit ? `GET /api/introspect/namespace/${namespace}/events` : `GET /api/introspect/namespace/${namespace}`}
        </div>
      </div>
      <HowItKnows config={config} namespace={namespace} live={audit} onDashboardOpen={() => setWaiting(true)} />
      {!bothOn && waiting && (
        <div className="ttt-watch">
          <Badge tone="warning" dot>
            waiting for the deploy
          </Badge>
          <span>After the deploy in the dashboard tab, the card flips when the Service appears.</span>
        </div>
      )}
      {audit && <EventsFeed namespace={namespace} config={config} />}

      {ttt && (
        <section className="section">
          <div className="section__head">
            <h3 className="section__title">tictactoe, on</h3>
            <div className="subtext muted">Service kitchen-sink-tictactoe found in {namespace}</div>
          </div>
          <Game />
        </section>
      )}
    </>
  )
}
