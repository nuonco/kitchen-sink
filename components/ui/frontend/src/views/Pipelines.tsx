import {
  useIntrospectPoll,
  useSyncRecentRuns,
  type SyncPipeline,
  type SyncPipelinesResponse,
  type SyncRun,
  type SyncRunStatus,
  type UIConfig,
} from '../lib/api'
import { pipelinesPrompt } from '../lib/prompts'
import { useNavigate } from '../lib/router'
import {
  Badge,
  CommandBlock,
  CopyButton,
  LoadState,
  EmptyState,
  OutLink,
  Section,
  Tracks,
} from '../ui/Primitives'

/* ============================================================
   The pipelines list: every registered pipeline, its config and last
   outcome — the front door to run history. Nothing here is simulated: the
   rows counted were read from the source Postgres and the object keys
   listed were written to the install's bucket.
   ============================================================ */

/** How often the page re-reads the engine's state. */
const POLL_MS = 10_000

/* ---------- formatting, shared with the detail page and the dashboard ---------- */

export function timeAgo(iso: string | null | undefined, now: number): string {
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

export function durationOf(started: string, finished: string | null): string {
  if (!finished) return 'running'
  const ms = Date.parse(finished) - Date.parse(started)
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
}

export function fmtBytes(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function fmtInterval(seconds: number): string {
  if (seconds % 3600 === 0) return `${seconds / 3600}h`
  if (seconds % 60 === 0) return `${seconds / 60}m`
  return `${seconds}s`
}

/** When the scheduler owes this pipeline its next run. */
export function nextRunOf(p: SyncPipeline, now: number): string {
  if (p.paused) return 'paused'
  if (!p.last_run) return 'due now'
  const due = Date.parse(p.last_run.started_at) + p.interval_seconds * 1000
  if (!Number.isFinite(due) || due <= now) return 'due now'
  const s = Math.round((due - now) / 1000)
  if (s < 60) return `in ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `in ${m}m`
  return `in ${Math.floor(m / 60)}h ${m % 60}m`
}

export function RunStatusBadge({ status }: { status: SyncRunStatus }) {
  if (status === 'succeeded') {
    return (
      <Badge tone="positive" dot>
        succeeded
      </Badge>
    )
  }
  if (status === 'failed') {
    return (
      <Badge tone="negative" dot>
        failed
      </Badge>
    )
  }
  return (
    <Badge tone="accent" dot>
      running
    </Badge>
  )
}

/* ============================================================
   The compact live strip: one line per pipeline, embedded by the operate
   flows as live evidence. Polls on its own so the pages that embed it stay
   one-liners.
   ============================================================ */

export function PipelineStrip() {
  const sync = useIntrospectPoll<SyncPipelinesResponse>(
    '/api/sync/pipelines',
    POLL_MS,
    true,
  )
  if (sync.state !== 'ok') return null
  const pipelines = sync.value.response.pipelines ?? []
  if (pipelines.length === 0) return null
  const now = Date.now()

  return (
    <div className="pipestrip">
      {pipelines.map((p) => {
        const state = p.paused
          ? 'paused'
          : (p.last_run?.status ?? 'waiting')
        return (
          <a key={p.name} className="pipestrip__item" href="#/pipelines">
            <span
              className={`pipestrip__dot pipestrip__dot--${state}`}
              aria-hidden="true"
            />
            <span className="pipestrip__name mono">{p.name}</span>
            <span className="pipestrip__meta mono">
              {p.paused
                ? 'paused'
                : p.last_run
                  ? `${p.last_run.rows_copied} rows · ${timeAgo(p.last_run.started_at, now)}`
                  : 'first run pending'}
            </span>
          </a>
        )
      })}
    </div>
  )
}

/* ============================================================
   The outcome strip: the pipeline's last 20 runs as squares, newest on the
   right, with the count in words next to it so state is never color-alone.
   ============================================================ */

function OutcomeStrip({ runs, now }: { runs: SyncRun[]; now: number }) {
  const recent = runs.slice(0, 20)
  if (recent.length === 0) {
    return <span className="subtext muted">no runs yet</span>
  }
  const ok = recent.filter((r) => r.status === 'succeeded').length
  return (
    <span className="outcomes">
      <span className="outcomes__strip" aria-hidden="true">
        {[...recent].reverse().map((r) => (
          <span
            key={r.id}
            className={`outcomes__sq outcomes__sq--${r.status}`}
            title={`run ${r.id} · ${r.status} · ${timeAgo(r.started_at, now)}`}
          />
        ))}
      </span>
      <span className="outcomes__count mono">
        {ok}/{recent.length} ok
      </span>
    </span>
  )
}

/* ============================================================
   The page.
   ============================================================ */

export function Pipelines({ config }: { config: UIConfig }) {
  const navigate = useNavigate()
  const sync = useIntrospectPoll<SyncPipelinesResponse>(
    '/api/sync/pipelines',
    POLL_MS,
    true,
  )

  const data = sync.state === 'ok' ? sync.value.response : undefined
  const pipelines = data?.pipelines ?? []
  const bucket = data?.bucket || '<your-bucket>'
  const runs = useSyncRecentRuns(pipelines.map((p) => p.name))
  const now = Date.now()

  const runsOf = (name: string) =>
    (runs ?? []).filter((r) => r.pipeline === name)

  return (
    <>
      <header className="page-header page-header--slim page-header--row">
        <h1>Pipelines</h1>
        <span className="subtext muted">
          GET /sync/pipelines · every {POLL_MS / 1000}s
        </span>
      </header>

      <LoadState result={sync} what="the sync engine" />

      {data && data.pipelines_count === 0 && (
        <EmptyState>
          No pipelines registered. The engine registers them from the
          pipelines table at boot.
        </EmptyState>
      )}

      {data && data.pipelines_count > 0 && (
        <div className="table-wrap">
          <table className="data runfeed pltable">
            <thead>
              <tr>
                <th>Pipeline</th>
                <th>Sources &rarr; prefix</th>
                <th>Interval</th>
                <th>Next run</th>
                <th>Last run</th>
                <th>Last 20</th>
              </tr>
            </thead>
            <tbody>
              {pipelines.map((p) => (
                <tr
                  key={p.name}
                  className="rowlink"
                  onClick={() => navigate(`/pipelines/${p.name}`)}
                >
                  <td className="mono pltable__name">{p.name}</td>
                  <td className="mono subtext pltable__sources">
                    {p.source_tables.join(', ')} &rarr; {p.destination_prefix}
                  </td>
                  <td className="mono subtext">
                    every {fmtInterval(p.interval_seconds)}
                  </td>
                  <td className="mono subtext">{nextRunOf(p, now)}</td>
                  <td>
                    <span className="pltable__last">
                      {p.paused ? (
                        <Badge tone="warning" dot>
                          paused
                        </Badge>
                      ) : p.last_run ? (
                        <>
                          <RunStatusBadge status={p.last_run.status} />
                          <span className="mono subtext">
                            {timeAgo(p.last_run.started_at, now)} ·{' '}
                            {p.last_run.rows_copied} rows
                          </span>
                        </>
                      ) : (
                        <Badge>first run pending</Badge>
                      )}
                    </span>
                  </td>
                  <td>
                    {runs === undefined ? (
                      <span className="subtext muted">…</span>
                    ) : (
                      <OutcomeStrip runs={runsOf(p.name)} now={now} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Section
        title="Don't take this page's word for it"
        aside="the bucket is yours"
      >
        <Tracks
          agent={
            <div className="agent-prompt proof-prompt">
              <div className="cmd__head">
                <span className="cmd__label">the prompt, your bucket filled in</span>
                <CopyButton text={pipelinesPrompt(bucket)} />
              </div>
              <pre className="cmd__pre agent-prompt__pre proof-prompt__pre">
                {pipelinesPrompt(bucket)}
              </pre>
            </div>
          }
          manual={
            <CommandBlock
              label="list what the engine wrote, with your own AWS credentials"
              command={`aws s3 ls s3://${bucket}/ --recursive | tail`}
              note={
                <>
                  The keys match the run history behind each row &mdash; Nuon
                  never holds this bucket&rsquo;s contents, and neither does
                  this page.
                </>
              }
            />
          }
        />
        {config.links.components && (
          <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
            The bucket, the IAM role the engine writes with, and the engine
            itself are all components of this install.{' '}
            <OutLink href={config.links.components} variant="plain">
              See them in Nuon
            </OutLink>
          </p>
        )}
      </Section>
    </>
  )
}
