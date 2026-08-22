import { useEffect, useRef } from 'react'
import {
  useIntrospectPoll,
  type SyncPipelinesResponse,
  type SyncRun,
  type SyncRunsResponse,
} from '../lib/api'
import {
  BackLink,
  Badge,
  CopyButton,
  EmptyState,
  Icon,
  LoadState,
  Section,
} from '../ui/Primitives'
import {
  RunStatusBadge,
  durationOf,
  fmtBytes,
  fmtInterval,
  nextRunOf,
  timeAgo,
} from './Pipelines'

/* ============================================================
   One pipeline: its config, its run history, and the fix-path when a run
   fails. A failed run is part of the record, not an apology — the error
   text is the one the engine stored.
   ============================================================ */

/** How often the page re-reads the engine's state. */
const POLL_MS = 10_000

function Fact({
  label,
  value,
  href,
  mono = false,
}: {
  label: string
  value?: string
  href?: string
  mono?: boolean
}) {
  const cls = value ? 'fact' : 'fact fact--pending'
  const body = (
    <>
      <div className="fact__label">{label}</div>
      <div className={mono ? 'fact__value mono' : 'fact__value'}>
        {value ?? '…'}
      </div>
    </>
  )
  return href ? (
    <a className={`${cls} fact--link`} href={href}>
      {body}
      <span className="fact__go" aria-hidden="true">
        <Icon name="arrow-up-right" />
      </span>
    </a>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/* ---------- one expandable run row ---------- */

function Run({
  run,
  now,
  targeted,
}: {
  run: SyncRun
  now: number
  /** True when the route deep-links this run: open it and scroll to it. */
  targeted: boolean
}) {
  const el = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (targeted) el.current?.scrollIntoView({ block: 'center' })
  }, [targeted])

  return (
    <details className="run" ref={el} open={targeted || undefined}>
      <summary>
        <span className="run__caret" aria-hidden="true">
          <Icon name="caret-right" />
        </span>
        <span className="run__id mono">run {run.id}</span>
        <RunStatusBadge status={run.status} />
        <span className="run__meta mono">{timeAgo(run.started_at, now)}</span>
        <span className="run__meta mono">
          {durationOf(run.started_at, run.finished_at)}
        </span>
        <span className="run__meta mono">{run.rows_copied} rows</span>
        <span className="run__meta mono">{fmtBytes(run.bytes_written)}</span>
      </summary>
      <div className="run__body">
        {run.error && (
          <div className="run__error">
            <span className="run__error-label">error</span>
            <span className="mono">{run.error}</span>
          </div>
        )}
        {run.status === 'failed' && (
          <p className="small muted" style={{ margin: '0 0 12px' }}>
            Collect a <a href="#/operate/runbooks">debug bundle</a> &mdash;
            read-only, recorded.
          </p>
        )}
        {run.objects.length > 0 ? (
          <>
            <div className="run__objhead">
              <span className="subtext muted">
                {run.objects.length} object{run.objects.length === 1 ? '' : 's'}{' '}
                written to the bucket
              </span>
              <CopyButton text={run.objects.join('\n')} label="Copy keys" />
            </div>
            <ul className="run__objects">
              {run.objects.map((key) => (
                <li key={key} className="mono">
                  {key}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            No objects written
            {run.status === 'running' ? ' yet' : ''}.
          </p>
        )}
      </div>
    </details>
  )
}

/* ---------- the page ---------- */

export function PipelineDetail({
  name,
  runId,
}: {
  name: string
  /** From #/pipelines/:name/run/:id — that run opens expanded. */
  runId?: string
}) {
  const sync = useIntrospectPoll<SyncPipelinesResponse>(
    '/api/sync/pipelines',
    POLL_MS,
    true,
  )
  const runs = useIntrospectPoll<SyncRunsResponse>(
    `/api/sync/runs?pipeline=${encodeURIComponent(name)}&limit=50`,
    POLL_MS,
    true,
  )

  const data = sync.state === 'ok' ? sync.value.response : undefined
  const pipeline = data?.pipelines.find((p) => p.name === name)
  const list = runs.state === 'ok' ? (runs.value.response.runs ?? []) : []
  const now = Date.now()

  if (data && !pipeline) {
    return (
      <>
        <BackLink to="/pipelines">Pipelines</BackLink>
        <EmptyState>
          No pipeline named <span className="mono">{name}</span>.
        </EmptyState>
      </>
    )
  }

  const targetedMissing =
    runId !== undefined &&
    runs.state === 'ok' &&
    !list.some((r) => String(r.id) === runId)

  return (
    <>
      <BackLink to="/pipelines">Pipelines</BackLink>
      <header className="page-header">
        <div className="row">
          <h1 className="mono">{name}</h1>
          {pipeline?.paused && (
            <Badge tone="warning" dot>
              paused
            </Badge>
          )}
        </div>
        {pipeline?.description && (
          <p className="lede">{pipeline.description}</p>
        )}
        {pipeline?.paused && (
          <p className="small muted" style={{ marginTop: 8 }}>
            Paused by the <span className="mono">pause_pipelines</span> action
            &mdash; <a href="#/operate/roles">the drill</a> resumes it.
          </p>
        )}
      </header>

      <div className="facts" style={{ marginTop: 0 }}>
        <Fact
          label="Sources"
          value={pipeline?.source_tables.join(', ')}
          mono
        />
        <Fact
          label="Destination"
          value={
            pipeline && data
              ? `${data.bucket}/${pipeline.destination_prefix}`
              : undefined
          }
          href="#/destinations"
          mono
        />
        <Fact
          label="Interval"
          value={pipeline ? `every ${fmtInterval(pipeline.interval_seconds)}` : undefined}
          mono
        />
        <Fact
          label="Next run"
          value={pipeline ? nextRunOf(pipeline, now) : undefined}
          mono
        />
      </div>

      <Section
        title="Run history"
        aside={`GET /sync/runs?pipeline=${name} · every ${POLL_MS / 1000}s`}
      >
        <LoadState result={runs} what={`runs of ${name}`} />
        {runs.state === 'ok' && list.length === 0 && (
          <p className="small muted" style={{ margin: 0 }}>
            No runs recorded yet &mdash; the first one starts within seconds
            of the worker seeing a due pipeline.
          </p>
        )}
        {targetedMissing && (
          <p className="small muted" style={{ marginBottom: 12 }}>
            Run <span className="mono">{runId}</span> is older than the last
            50 on record.
          </p>
        )}
        {runs.state === 'ok' && list.length > 0 && (
          <div className="runlist">
            <div className="runlist__head subtext muted">
              {list.length} run{list.length === 1 ? '' : 's'} on record, newest
              first
            </div>
            {list.map((run) => (
              <Run
                key={run.id}
                run={run}
                now={now}
                targeted={String(run.id) === runId}
              />
            ))}
          </div>
        )}
        <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
          A failed run stays on the record; the next tick retries.
        </p>
      </Section>
    </>
  )
}
