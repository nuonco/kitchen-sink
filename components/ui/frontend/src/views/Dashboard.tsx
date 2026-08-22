import { useState, type ReactNode } from 'react'
import {
  countReady,
  hasComplianceExport,
  useIntrospectPoll,
  useSyncRecentRuns,
  type NamespaceResponse,
  type SyncPipelinesResponse,
  type SyncRun,
  type UIConfig,
} from '../lib/api'
import { branchName } from '../lib/config-data.gen'
import { useNavigate } from '../lib/router'
import {
  EmptyState,
  Icon,
  LoadState,
  NuonMark,
  OutLink,
  Section,
} from '../ui/Primitives'
import { RunStatusBadge, durationOf, fmtBytes, timeAgo } from './Pipelines'

/* ============================================================
   The landing: pipelines at a glance, the recent-runs feed, destination
   health, and the Nuon presence — the page an operator keeps open. Every
   number is the engine's own record, read live; the only aggregation is a
   client-side merge of the per-pipeline run history.
   ============================================================ */

/** How often the page re-reads the engine's state. */
const POLL_MS = 10_000

/* ---------- the first-visit welcome band ---------- */

const WELCOME_KEY = 'conduit-welcome'

function welcomeDismissed(): boolean {
  try {
    return window.localStorage.getItem(WELCOME_KEY) === 'dismissed'
  } catch {
    return false
  }
}

function WelcomeBand() {
  const [dismissed, setDismissed] = useState(welcomeDismissed)
  if (dismissed) return null
  return (
    <div className="welcome" role="note">
      <p className="welcome__text">
        Conduit syncs your Postgres to your S3, on schedule, inside this AWS
        account. Nuon deployed all of it — see{' '}
        <a href="#/deployment">how</a>.
      </p>
      <button
        className="welcome__dismiss"
        aria-label="Dismiss"
        onClick={() => {
          setDismissed(true)
          try {
            window.localStorage.setItem(WELCOME_KEY, 'dismissed')
          } catch {
            // No storage (private mode): the band just comes back next visit.
          }
        }}
      >
        ×
      </button>
    </div>
  )
}

/* ---------- stat tiles ---------- */

function Tile({
  label,
  value,
  note,
  href,
  mono = false,
  title,
}: {
  label: string
  value?: string
  note?: ReactNode
  href: string
  mono?: boolean
  title?: string
}) {
  const cls = ['fact', 'fact--link', value === undefined ? 'fact--pending' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <a className={cls} href={href}>
      <div className="fact__label">{label}</div>
      <div
        className={mono ? 'fact__value mono' : 'fact__value fact__value--num'}
        {...(title ? { title } : {})}
      >
        {value ?? '…'}
      </div>
      {note && <div className="fact__note">{note}</div>}
      <span className="fact__go" aria-hidden="true">
        <Icon name="arrow-up-right" />
      </span>
    </a>
  )
}

/* ---------- the merged recent-runs table ---------- */

function RecentRuns({ runs }: { runs: SyncRun[] }) {
  const navigate = useNavigate()
  const now = Date.now()
  const newest = runs.slice(0, 10)

  return (
    <div className="table-wrap">
      <table className="data runfeed">
        <thead>
          <tr>
            <th>Run</th>
            <th>Pipeline</th>
            <th>Status</th>
            <th>Age</th>
            <th>Duration</th>
            <th>Rows</th>
            <th>Bytes</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {newest.map((run) => (
            <tr
              key={`${run.pipeline}-${run.id}`}
              className="rowlink"
              onClick={() => navigate(`/pipelines/${run.pipeline}/run/${run.id}`)}
            >
              <td className="mono">run {run.id}</td>
              <td className="mono subtext">{run.pipeline}</td>
              <td>
                <RunStatusBadge status={run.status} />
              </td>
              <td className="mono subtext">{timeAgo(run.started_at, now)}</td>
              <td className="mono subtext">
                {run.finished_at ? durationOf(run.started_at, run.finished_at) : '—'}
              </td>
              <td className="mono subtext">{run.rows_copied}</td>
              <td className="mono subtext">{fmtBytes(run.bytes_written)}</td>
              <td className="runfeed__go">
                {run.status === 'failed' && (
                  <a
                    href="#/operate/runbooks"
                    onClick={(e) => e.stopPropagation()}
                  >
                    debug &rarr;
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RunsSkeleton() {
  return (
    <div className="stack" style={{ maxWidth: 480 }}>
      <div className="skeleton" style={{ width: '90%' }} />
      <div className="skeleton" style={{ width: '75%' }} />
      <div className="skeleton" style={{ width: '85%' }} />
    </div>
  )
}

/* ---------- the page ---------- */

const DAY_MS = 24 * 60 * 60 * 1000

export function Dashboard({ config }: { config: UIConfig }) {
  const namespace = config.namespace ?? 'conduit'
  const sync = useIntrospectPoll<SyncPipelinesResponse>(
    '/api/sync/pipelines',
    POLL_MS,
    true,
  )
  const ns = useIntrospectPoll<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
    20_000,
    true,
  )

  const data = sync.state === 'ok' ? sync.value.response : undefined
  const pipelines = data?.pipelines ?? []
  const runs = useSyncRecentRuns(pipelines.map((p) => p.name))

  const now = Date.now()
  const pausedCount = pipelines.filter((p) => p.paused).length
  const lastLanded = pipelines
    .map((p) => p.last_run?.started_at)
    .filter((t): t is string => Boolean(t))
    .sort()
    .pop()

  const runs24 = (runs ?? []).filter(
    (r) => now - Date.parse(r.started_at) < DAY_MS,
  )
  const rows24 = runs24.reduce((sum, r) => sum + r.rows_copied, 0)
  const failed24 = runs24.filter((r) => r.status === 'failed').length
  const objects24 = runs24.reduce((sum, r) => sum + r.objects.length, 0)
  const lastFailed = (runs ?? []).find((r) => r.status === 'failed')

  const services = ns.state === 'ok' ? (ns.value.response.services ?? []) : undefined
  const pods = ns.state === 'ok' ? (ns.value.response.pods ?? []) : undefined

  return (
    <>
      <header className="page-header page-header--slim">
        <h1>Dashboard</h1>
      </header>

      <WelcomeBand />

      {sync.state === 'error' && <LoadState result={sync} what="the sync engine" />}

      {data && data.pipelines_count === 0 && (
        <EmptyState>
          No pipelines registered. The engine registers them from the
          pipelines table at boot.
        </EmptyState>
      )}

      {(sync.state === 'loading' || (data && data.pipelines_count > 0)) && (
        <>
          <div className="facts facts--tiles" style={{ marginTop: 0 }}>
            <Tile
              label="Pipelines"
              value={data ? String(data.pipelines_count) : undefined}
              note={
                data ? (
                  pausedCount > 0 ? (
                    <span className="note-warn">{pausedCount} paused</span>
                  ) : (
                    'all active'
                  )
                ) : undefined
              }
              href="#/pipelines"
            />
            <Tile
              label="Last sync landed"
              value={data ? timeAgo(lastLanded, now) : undefined}
              note={data?.bucket ? `in ${data.bucket}` : undefined}
              href="#/pipelines"
            />
            <Tile
              label="Rows copied · 24h"
              value={runs ? rows24.toLocaleString() : undefined}
              note={
                runs ? (
                  <>
                    {runs24.length} run{runs24.length === 1 ? '' : 's'}
                    {failed24 > 0 && (
                      <span className="note-bad">
                        {' '}
                        · <span className="note-dot" aria-hidden="true" />
                        {failed24} failed
                      </span>
                    )}
                  </>
                ) : undefined
              }
              href="#/pipelines"
            />
            <Tile
              label="Destination"
              value={data?.bucket}
              title={data?.bucket}
              note={
                services
                  ? `compliance export ${hasComplianceExport(services) ? 'on' : 'off'}`
                  : undefined
              }
              href="#/destinations"
              mono
            />
          </div>

          <Section
            title="Recent runs"
            aside={`GET /sync/runs · every ${POLL_MS / 1000}s`}
          >
            {runs === undefined ? (
              <RunsSkeleton />
            ) : runs.length === 0 ? (
              <EmptyState>
                No runs recorded yet — the first one starts within seconds of
                the worker seeing a due pipeline.
              </EmptyState>
            ) : (
              <RecentRuns runs={runs} />
            )}
          </Section>

          <div className="dash-cards">
            <div className="card dashcard">
              <div className="dashcard__head">
                <h2 className="dashcard__title">Destination health</h2>
              </div>
              <dl className="kv">
                <div style={{ display: 'contents' }}>
                  <dt>bucket</dt>
                  <dd>{data?.bucket ?? '…'}</dd>
                </div>
                {config.region && (
                  <div style={{ display: 'contents' }}>
                    <dt>region</dt>
                    <dd>{config.region}</dd>
                  </div>
                )}
                <div style={{ display: 'contents' }}>
                  <dt>objects · 24h</dt>
                  <dd>{runs ? objects24 : '…'}</dd>
                </div>
              </dl>
              {lastFailed && (
                <p className="dashcard__alert">
                  <span className="mono">run {lastFailed.id}</span> failed{' '}
                  {timeAgo(lastFailed.started_at, now)}:{' '}
                  <span className="mono">
                    {lastFailed.error.length > 90
                      ? `${lastFailed.error.slice(0, 90)}…`
                      : lastFailed.error}
                  </span>{' '}
                  <a href="#/operate/runbooks">debug &rarr;</a>
                </p>
              )}
              <div className="dashcard__actions">
                <a href="#/destinations">Destinations &rarr;</a>
              </div>
            </div>

            <div className="card dashcard">
              <div className="dashcard__head">
                <NuonMark size={16} />
                <h2 className="dashcard__title">Deployed by Nuon</h2>
              </div>
              <dl className="kv">
                {config.install_id && (
                  <div style={{ display: 'contents' }}>
                    <dt>install</dt>
                    <dd>{config.install_id}</dd>
                  </div>
                )}
                <div style={{ display: 'contents' }}>
                  <dt>pods ready</dt>
                  <dd>{pods ? `${countReady(pods)} of ${pods.length}` : '…'}</dd>
                </div>
                <div style={{ display: 'contents' }}>
                  <dt>branch</dt>
                  <dd>{branchName}</dd>
                </div>
              </dl>
              <p className="dashcard__note">
                Checked hourly by{' '}
                <a href="#/operate/actions" className="mono">
                  sync_heartbeat
                </a>
                .
              </p>
              <div className="dashcard__actions">
                <a href="#/deployment">Deployment &rarr;</a>
                <OutLink href={config.links.install} variant="plain">
                  Open in Nuon
                </OutLink>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
