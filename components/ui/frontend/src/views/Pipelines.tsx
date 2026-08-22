import { useState } from 'react'
import {
  useIntrospectPoll,
  type SyncPipeline,
  type SyncRun,
  type SyncPipelinesResponse,
  type SyncRunsResponse,
  type SyncRunStatus,
  type UIConfig,
} from '../lib/api'
import { pipelinesPrompt } from '../lib/prompts'
import { stepEyebrow } from '../lib/taxonomy'
import { useMarkStepSeen } from '../lib/progress'
import { StepNav } from '../ui/CapabilityGrid'
import {
  BackLink,
  Badge,
  CommandBlock,
  CopyButton,
  Eyebrow,
  Icon,
  LoadState,
  OutLink,
  Section,
  Tracks,
} from '../ui/Primitives'

/* ============================================================
   The product page: what Conduit's sync engine has actually done, read from
   its own run history (GET /sync/pipelines, GET /sync/runs). Nothing here is
   simulated — the rows counted were read from the source Postgres and the
   object keys listed were written to the install's bucket.
   ============================================================ */

/** How often the page re-reads the engine's state. */
const POLL_MS = 10_000

/* ---------- formatting ---------- */

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
   The compact live strip: one line per pipeline, shared with the landing.
   Polls on its own so the pages that embed it stay one-liners.
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
   Run history for one pipeline: every recorded run, newest first, with the
   object keys it wrote. A failed run is part of the record, not an apology —
   the error text is the same one the engine stored.
   ============================================================ */

function Run({ run, now }: { run: SyncRun; now: number }) {
  return (
    <details className="run">
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

function RunHistory({ pipeline }: { pipeline: string }) {
  const runs = useIntrospectPoll<SyncRunsResponse>(
    `/api/sync/runs?pipeline=${encodeURIComponent(pipeline)}&limit=50`,
    POLL_MS,
    true,
  )

  if (runs.state !== 'ok') {
    return <LoadState result={runs} what={`runs of ${pipeline}`} />
  }

  const list = runs.value.response.runs ?? []
  const now = Date.now()

  if (list.length === 0) {
    return (
      <p className="small muted" style={{ margin: 0 }}>
        No runs recorded yet — the first one starts within seconds of the
        worker seeing a due pipeline.
      </p>
    )
  }

  return (
    <div className="runlist">
      <div className="runlist__head subtext muted">
        {list.length} run{list.length === 1 ? '' : 's'} on record, newest
        first · GET /sync/runs?pipeline={pipeline}
      </div>
      {list.map((run) => (
        <Run key={run.id} run={run} now={now} />
      ))}
    </div>
  )
}

/* ============================================================
   One pipeline row: the registered config on the left, the last run on the
   right, the full history one click in.
   ============================================================ */

function PipelineRow({
  pipeline,
  open,
  onToggle,
  now,
}: {
  pipeline: SyncPipeline
  open: boolean
  onToggle: () => void
  now: number
}) {
  const last = pipeline.last_run
  return (
    <div className={open ? 'piperow piperow--open' : 'piperow'}>
      <button className="piperow__head" aria-expanded={open} onClick={onToggle}>
        <span className="piperow__name mono">{pipeline.name}</span>
        <span className="piperow__sources mono">
          {pipeline.source_tables.join(', ')} &rarr; {pipeline.destination_prefix}
        </span>
        <span className="piperow__interval mono">
          every {fmtInterval(pipeline.interval_seconds)}
        </span>
        <span className="piperow__state">
          {pipeline.paused ? (
            <Badge tone="warning" dot>
              paused
            </Badge>
          ) : last ? (
            <RunStatusBadge status={last.status} />
          ) : (
            <Badge>first run pending</Badge>
          )}
        </span>
        <span className="piperow__last mono">
          {last
            ? `${timeAgo(last.started_at, now)} · ${last.rows_copied} rows`
            : '—'}
        </span>
        <span className="piperow__caret" aria-hidden="true">
          <Icon name="caret-right" />
        </span>
      </button>
      {open && (
        <div className="piperow__body">
          {pipeline.description && (
            <p className="small muted" style={{ marginBottom: 12 }}>
              {pipeline.description}
            </p>
          )}
          <RunHistory pipeline={pipeline.name} />
        </div>
      )}
    </div>
  )
}

/* ============================================================
   The page.
   ============================================================ */

function GlanceFact({
  label,
  value,
  note,
  mono = false,
}: {
  label: string
  value?: string
  note?: string
  mono?: boolean
}) {
  return (
    <div className={value ? 'fact' : 'fact fact--pending'}>
      <div className="fact__label">{label}</div>
      <div className={mono ? 'fact__value mono' : 'fact__value fact__value--num'}>
        {value ?? '…'}
      </div>
      {note && <div className="fact__note">{note}</div>}
    </div>
  )
}

export function Pipelines({ config }: { config: UIConfig }) {
  useMarkStepSeen('/pipelines')
  const sync = useIntrospectPoll<SyncPipelinesResponse>(
    '/api/sync/pipelines',
    POLL_MS,
    true,
  )
  const [open, setOpen] = useState<string | null>(null)

  const data = sync.state === 'ok' ? sync.value.response : undefined
  const pipelines = data?.pipelines ?? []
  const bucket = data?.bucket || '<your-bucket>'
  const now = Date.now()

  const lastLanded = pipelines
    .map((p) => p.last_run?.started_at)
    .filter((t): t is string => Boolean(t))
    .sort()
    .pop()
  const pausedCount = pipelines.filter((p) => p.paused).length

  return (
    <>
      <BackLink to="/">Conduit</BackLink>
      <header className="page-header">
        <Eyebrow>{stepEyebrow('/pipelines')}</Eyebrow>
        <h1>Pipelines run here, in your account.</h1>
        <p className="lede">
          The sync engine copies the source Postgres into{' '}
          <span className="mono">{bucket}</span> on each pipeline&rsquo;s
          schedule. Everything on this page is the engine&rsquo;s own run
          history &mdash; the data never left this account.
        </p>
      </header>

      <div className="facts" style={{ marginTop: 0 }}>
        <GlanceFact
          label="Pipelines"
          value={data ? String(data.pipelines_count) : undefined}
          note={pausedCount > 0 ? `${pausedCount} paused` : 'all active'}
        />
        <GlanceFact
          label="Last sync landed"
          value={data ? timeAgo(lastLanded, now) : undefined}
          note="newest run across all pipelines"
        />
        <GlanceFact
          label="Destination bucket"
          value={data ? bucket : undefined}
          note="created by the destination_bucket component"
          mono
        />
      </div>

      <Section
        title="Every pipeline, live"
        aside={`GET /sync/pipelines · re-read every ${POLL_MS / 1000}s`}
      >
        <LoadState result={sync} what="the sync engine" />
        {sync.state === 'ok' && (
          <div className="pipelist">
            {pipelines.map((p) => (
              <PipelineRow
                key={p.name}
                pipeline={p}
                open={open === p.name}
                onToggle={() => setOpen(open === p.name ? null : p.name)}
                now={now}
              />
            ))}
          </div>
        )}
        <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
          A failed run stays on the record with the error the engine hit; the
          next tick retries. The <span className="mono">pause_pipelines</span>{' '}
          drill (step 09) flips every row to paused &mdash; watch it happen
          here.
        </p>
      </Section>

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
              command={`aws s3 ls s3://${bucket}/orders/ --recursive | tail`}
              note={
                <>
                  The keys match the run history above &mdash; Nuon never holds
                  this bucket&rsquo;s contents, and neither does this page.
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

      <StepNav current="/pipelines" />
    </>
  )
}
