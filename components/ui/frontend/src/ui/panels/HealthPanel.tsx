import { countReady } from '../../lib/api'
import { healthBlocks, runbooks } from '../../lib/config-data.gen'
import type { PanelProps } from '../../lib/panels'
import { Badge, CommandBlock, LoadState, OutLink, PhaseBadge } from '../Primitives'
import { PANEL_POLL_MS, PanelPrompts, installIdOf, useNamespacePoll } from './shared'

/* ============================================================
   health: pod readiness read live, and the [health] blocks on the
   components. From the old "Component health" page.
   ============================================================ */

const enabledBlocks = healthBlocks.filter((h) => h.enabled)
const probeTotal = healthBlocks.reduce((n, h) => n + h.probes, 0)
const probeOwners = healthBlocks.filter((h) => h.probes > 0).map((h) => h.component)
const healthCheck = runbooks.find((rb) => rb.name === 'full-health-check')

export function HealthTile({ config }: PanelProps) {
  const { ns } = useNamespacePoll(config, 20_000)
  const pods = ns.state === 'ok' ? (ns.value.response.pods ?? []) : []
  return (
    <>
      <span className="ptile__value">
        {ns.state === 'ok' ? `${countReady(pods)} of ${pods.length} pods ready` : 'reading pods…'}
      </span>
      <span className="ptile__label mono">
        {enabledBlocks.length} of {healthBlocks.length} [health] blocks enabled ·{' '}
        {healthBlocks.filter((h) => !h.blockDeploy).length} with block_deploy = false
      </span>
    </>
  )
}

export function HealthDrawer({ config }: PanelProps) {
  const { namespace, ns } = useNamespacePoll(config)
  const pods = ns.state === 'ok' ? (ns.value.response.pods ?? []) : []
  return (
    <>
      <div className="section__head">
        <h3 className="section__title">{healthBlocks.length} [health] blocks</h3>
        <div className="subtext muted">components/*.toml</div>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Component</th>
              <th>Enabled</th>
              <th>block_deploy</th>
              <th>Stabilization</th>
              <th>Probes</th>
            </tr>
          </thead>
          <tbody>
            {healthBlocks.map((h) => (
              <tr key={h.component}>
                <td className="mono">{h.component}</td>
                <td className="mono subtext">{String(h.enabled)}</td>
                <td className="mono subtext">{String(h.blockDeploy)}</td>
                <td className="mono subtext">{h.stabilizationWindow ?? 'none'}</td>
                <td className="mono subtext">{h.probes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 12, maxWidth: '72ch' }}>
        After a deploy, Nuon assesses the component&rsquo;s deployments, pods, services and ingresses
        and records the result with the deploy step. With <span className="mono">block_deploy = false</span>{' '}
        the record is kept and nothing is held on it. Probes run on the runner, outside the cluster,
        so the chart declares none; {probeTotal} probe{probeTotal === 1 ? '' : 's'} declared
        {probeOwners.length > 0 ? `, on ${probeOwners.join(' and ')}` : ''}: an HTTP check of{' '}
        <span className="mono">/livez</span> on the public domain.
      </p>

      <div className="section__head" style={{ marginTop: 24 }}>
        <h3 className="section__title">Pod readiness in {namespace}</h3>
        <div className="subtext muted">
          GET /api/introspect/namespace/{namespace} · re-read every {PANEL_POLL_MS / 1000}s
        </div>
      </div>
      <LoadState result={ns} what="pod health" />
      {ns.state === 'ok' && (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <Badge tone="accent">
              {countReady(pods)} of {pods.length} pods ready
            </Badge>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Pod</th>
                  <th>Phase</th>
                  <th>Containers ready</th>
                  <th>Restarts</th>
                </tr>
              </thead>
              <tbody>
                {pods.map((pod, i) => {
                  const statuses = pod.status?.containerStatuses ?? []
                  const ready = statuses.filter((c) => c.ready).length
                  const restarts = statuses.reduce((sum, c) => sum + (c.restartCount ?? 0), 0)
                  return (
                    <tr key={pod.metadata?.name ?? i}>
                      <td className="mono">{pod.metadata?.name}</td>
                      <td>
                        <PhaseBadge phase={pod.status?.phase} />
                      </td>
                      <td>
                        {ready} / {statuses.length}
                      </td>
                      <td>{restarts}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <CommandBlock
        label={`run ${healthCheck?.name ?? 'full-health-check'} (read-only)`}
        command={`nuon runbooks create-run --install-id ${installIdOf(config)} --runbook-id full-health-check`}
        note={
          <>
            {healthCheck ? `${healthCheck.steps.length} steps: ${healthCheck.description}` : null}{' '}
            The install readme renders one row per step.{' '}
            {config.links.install && (
              <OutLink href={config.links.install} variant="plain">
                Install readme
              </OutLink>
            )}
          </>
        }
      />

      <PanelPrompts panel="health" config={config} />
    </>
  )
}
