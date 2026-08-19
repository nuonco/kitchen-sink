import { useState } from 'react'
import {
  hasTicTacToe,
  useIntrospect,
  type NamespaceResponse,
  type UIConfig,
} from '../lib/api'
import {
  BackLink,
  Callout,
  Eyebrow,
  Icon,
  LoadState,
  OutLink,
} from '../ui/Primitives'

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

  const status = winner
    ? `${winner} wins`
    : over
      ? 'A draw'
      : `${xToMove ? 'X' : 'O'} to move`

  return (
    <section className="section">
      <div className="ttt">
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

function Locked({ config }: { config: UIConfig }) {
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
          on. That is the shape of a SKU: one config, per-install entitlements.
          Enable the component for this install in the dashboard, deploy it, and
          reload this page.
        </p>
        <div className="row" style={{ marginTop: 20 }}>
          <OutLink href={config.links.components}>
            Open components in Nuon
          </OutLink>
          <OutLink
            href="https://docs.nuon.co/concepts/components"
            variant="secondary"
          >
            Read about components
          </OutLink>
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
  const ns = useIntrospect<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
  )
  const unlocked =
    ns.state === 'ok' && hasTicTacToe(ns.value.response.services ?? [])

  return (
    <>
      <BackLink to="/">Customize the Kitchen Sink</BackLink>
      <header className="page-header">
        <Eyebrow>Toggleable component</Eyebrow>
        <h1>One config, per-install features.</h1>
        <p className="lede">
          The <span className="mono">tictactoe</span> component is deployed only
          where it has been switched on. This page reads the live cluster to
          find out which kind of install this one is, then behaves accordingly.
        </p>
      </header>

      <LoadState result={ns} what={`the ${namespace} namespace`} />
      {ns.state === 'ok' &&
        (unlocked ? <Game /> : <Locked config={config} />)}
    </>
  )
}
