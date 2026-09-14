import { useState } from 'react'
import { adhocActions, lifecycleHooksToml, postDeployRunbooks, runbooks } from '../../lib/config-data.gen'
import type { PanelProps } from '../../lib/panels'
import { Badge, CodeBlock, CommandBlock, Icon, OutLink } from '../Primitives'
import { PanelPrompts, installIdOf } from './shared'

/* ============================================================
   runbooks: the recorded procedures in runbooks/*.toml, the command that
   runs one, and one line on when actions fire (folded from the old
   Triggers page). From the old "Runbooks" page.
   ============================================================ */

const mutating = runbooks.filter((r) => r.mutates)

/** "cron 0 * * * * · post-provision ×4 · pre-deploy-component ×2 · …" from
    every trigger every action declares. */
function triggerSummary(): string {
  const counts = new Map<string, number>()
  for (const a of adhocActions) {
    for (const t of a.triggers) {
      const key = t.startsWith('cron') ? t : t.split(' ')[0]
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => (k.startsWith('cron') || n === 1 ? k : `${k} ×${n}`))
    .join(' · ')
}

function ModeBadge({ mutates }: { mutates: boolean }) {
  return mutates ? (
    <Badge tone="warning" dot>
      applies changes
    </Badge>
  ) : (
    <Badge tone="positive" dot>
      read-only
    </Badge>
  )
}

export function RunbooksTile(_: PanelProps) {
  return (
    <>
      <span className="ptile__value">
        {runbooks.length} runbooks · {mutating.length} apply changes
      </span>
      <span className="ptile__label mono">
        {postDeployRunbooks.length > 0 ? `${postDeployRunbooks.join(', ')} after each deploy · ` : ''}
        {adhocActions.length} actions
      </span>
    </>
  )
}

export function RunbooksDrawer({ config }: PanelProps) {
  const [selected, setSelected] = useState(0)
  const runbook = runbooks[selected]
  const install = installIdOf(config)
  return (
    <>
      <div className="tiles" style={{ marginBottom: 24 }}>
        {runbooks.map((rb, i) => (
          <button
            key={rb.name}
            className={i === selected ? 'tile tile--active' : 'tile'}
            onClick={() => setSelected(i)}
          >
            <span className="tile__head">
              <Icon name="book-open" />
              <span className="mono">{rb.name}</span>
            </span>
            <span className="tile__body">
              {rb.steps.length} steps · {rb.mutates ? 'applies changes' : 'read-only'}
            </span>
          </button>
        ))}
      </div>

      <div className="section__head">
        <h3 className="section__title mono">{runbook.name}</h3>
        <div className="subtext muted">runbooks/{runbook.name}.toml</div>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <ModeBadge mutates={runbook.mutates} />
      </div>
      <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
        {runbook.description}
      </p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>#</th>
              <th>Step</th>
              <th>Type</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            {runbook.steps.map((step, i) => (
              <tr key={step.name}>
                <td className="mono subtext">{i + 1}</td>
                <td className="mono">{step.name}</td>
                <td className="mono subtext">{step.type}</td>
                <td>{step.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CommandBlock
        label={`run ${runbook.name} against this install`}
        command={`nuon runbooks create-run --install-id ${install} --runbook-id ${runbook.name}`}
        note={
          runbook.mutates ? (
            <>Re-applies state or assumes elevated access.</>
          ) : (
            <>Read-only diagnostics. Runbooks take their name directly, no id lookup.</>
          )
        }
      />
      <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
        <span className="mono">branch.toml</span> runs{' '}
        <span className="mono">{postDeployRunbooks.join(', ')}</span> on each install after its group
        deploys (<span className="mono">post_deploy_runbooks</span>).{' '}
        {config.links.runbooks && (
          <OutLink href={config.links.runbooks} variant="plain">
            Runbook transcripts in Nuon
          </OutLink>
        )}
      </p>

      <div className="section__head" style={{ marginTop: 24 }}>
        <h3 className="section__title">When actions run</h3>
        <div className="subtext muted">actions/*/nuon.toml · [[triggers]]</div>
      </div>
      <p className="small muted" style={{ maxWidth: '72ch' }}>
        {adhocActions.length} actions declare these triggers: <span className="mono">{triggerSummary()}</span>.
        <span className="mono"> lifecycle_hooks</span> fires post-provision and around every{' '}
        <span className="mono">kitchen_sink</span> deploy.
      </p>
      <CodeBlock label="actions/lifecycle_hooks/nuon.toml" code={lifecycleHooksToml} />

      <PanelPrompts panel="runbooks" config={config} />
    </>
  )
}
