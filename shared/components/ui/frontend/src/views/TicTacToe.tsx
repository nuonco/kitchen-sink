import { useEffect, useRef, useState } from 'react'
import {
  hasTicTacToe,
  useIntrospectPoll,
  type NamespaceResponse,
  type UIConfig,
} from '../lib/api'
import {
  BackLink,
  Badge,
  Callout,
  Eyebrow,
  Icon,
  LoadState,
  OutLink,
} from '../ui/Primitives'

/** How often the locked page re-reads the namespace looking for the deploy. */
const POLL_MS = 10_000

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

function Game({ justDeployed }: { justDeployed: boolean }) {
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

  const status = winner
    ? `${winner} wins`
    : over
      ? 'A draw'
      : `${xToMove ? 'X' : 'O'} to move`

  return (
    <section className="section">
      {justDeployed && (
        <div className="ttt-unlocked-note">
          <Badge tone="positive" dot>
            just deployed
          </Badge>
          <span>
            That was the deploy landing: the marker Service appeared in the
            namespace, this page noticed, and the feature unlocked itself. No
            reload.
          </span>
        </div>
      )}
      <div className={justDeployed ? 'ttt ttt--just-unlocked' : 'ttt'}>
        <div className="ttt__status" role="status">
          {status}
        </div>
        <div className="ttt__board">
          {board.map((cell, i) => (
            <button
              key={i}
              className={
                line?.includes(i) ? 'ttt__cell ttt__cell--win' : 'ttt__cell'
              }
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
      <Callout label="What just got deployed">
        The game is client-side; the component behind it deploys one marker
        Service, <span className="mono">kitchen-sink-tictactoe</span>, into the
        app&rsquo;s namespace. This page found that Service through the
        introspection API and unlocked itself. Your real optional features work
        the same way, with more behind the flag than a Service.
      </Callout>
    </section>
  )
}

function Locked({
  config,
  waiting,
  onDashboardOpen,
}: {
  config: UIConfig
  waiting: boolean
  onDashboardOpen: () => void
}) {
  return (
    <section className="section">
      <div className="ttt-locked">
        <span className="ttt-locked__icon">
          <Icon name="lock" />
        </span>
        <div className="ttt-locked__title">Not included in this install.</div>
        <p className="ttt-locked__body">
          The <span className="mono">tictactoe</span> component is in this
          app&rsquo;s config with <span className="mono">toggleable = true</span>{' '}
          and <span className="mono">default_enabled = false</span>, so every
          install knows about it and none of them run it until someone flips it
          on. Enable the component for this install in the dashboard and deploy it
          &mdash; this page is watching the namespace and unlocks itself the
          moment the deploy lands.
        </p>
        <div className="row" style={{ marginTop: 20 }}>
          <OutLink href={config.links.components} onClick={onDashboardOpen}>
            Turn it on in Nuon
          </OutLink>
          <OutLink
            href="https://docs.nuon.co/concepts/components"
            variant="secondary"
          >
            Read about components
          </OutLink>
        </div>
        <div className="ttt-watch">
          {waiting ? (
            <>
              <Badge tone="warning" dot>
                waiting for the deploy
              </Badge>
              <span>
                Toggle the component on in the dashboard tab and deploy it.
                This page re-reads the namespace every {POLL_MS / 1000} seconds
                and flips to the game when the marker Service appears.
              </span>
            </>
          ) : (
            <>
              <Badge tone="accent" dot>
                watching live
              </Badge>
              <span>
                Checking this namespace for the marker Service every{' '}
                {POLL_MS / 1000} seconds.
              </span>
            </>
          )}
        </div>
      </div>
      <Callout label="How this page knows">
        When enabled, the component applies a marker Service named{' '}
        <span className="mono">kitchen-sink-tictactoe</span>. This page lists
        the namespace&rsquo;s Services through the introspection API and did not
        find it, so you get the pitch instead of the game.
      </Callout>
    </section>
  )
}

export function TicTacToe({ config }: { config: UIConfig }) {
  const namespace = config.namespace ?? 'kitchen-sink'
  const [unlocked, setUnlocked] = useState(false)
  const [justUnlocked, setJustUnlocked] = useState(false)
  const [waiting, setWaiting] = useState(false)
  // True once the visitor has actually seen the locked pitch, so an unlock
  // detected later is a real on-screen moment rather than the initial load.
  const sawLocked = useRef(false)

  const ns = useIntrospectPoll<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
    POLL_MS,
    !unlocked,
  )

  useEffect(() => {
    if (ns.state !== 'ok') return
    const found = hasTicTacToe(ns.value.response.services ?? [])
    if (found) {
      if (sawLocked.current) setJustUnlocked(true)
      setUnlocked(true)
    } else {
      sawLocked.current = true
    }
  }, [ns])

  return (
    <>
      <BackLink to="/">Customize the Kitchen Sink</BackLink>
      <header className="page-header">
        <Eyebrow>Toggleable component</Eyebrow>
        <h1>One config, per-install features</h1>
        <p className="lede">
          The <span className="mono">tictactoe</span> component is deployed only
          where it has been switched on.
        </p>
      </header>

      {!unlocked && (
        <LoadState result={ns} what={`the ${namespace} namespace`} />
      )}
      {unlocked ? (
        <Game justDeployed={justUnlocked} />
      ) : (
        ns.state === 'ok' && (
          <Locked
            config={config}
            waiting={waiting}
            onDashboardOpen={() => setWaiting(true)}
          />
        )
      )}
    </>
  )
}
