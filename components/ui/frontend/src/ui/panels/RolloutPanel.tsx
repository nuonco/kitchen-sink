import { shipsTo } from '../../lib/cases'
import { branchConfigAbridged, branchName, installGroups } from '../../lib/config-data.gen'
import type { PanelProps } from '../../lib/panels'
import { CodeBlock, CommandBlock, OutLink } from '../Primitives'
import { PanelPrompts, appIdOf, installIdOf } from './shared'

/* ============================================================
   rollout: the app branch this install ships through and its install
   groups, in order. Branch runs are not readable in the browser, so
   nothing here claims a run; the tile shows the order from branch.toml
   with the case's target group lit. From the old "App branches" page.
   ============================================================ */

const groups = installGroups.slice().sort((a, b) => a.order - b.order)

export function RolloutTile({ config, caseBranch }: PanelProps) {
  const target = caseBranch ? shipsTo(caseBranch)?.name : undefined
  return (
    <>
      <span className="ptile__value">
        {groups.map((g, i) => (
          <span key={g.name}>
            {i > 0 && ' → '}
            <span className={g.name === target ? 'ptile__lit' : undefined}>{g.name}</span>
          </span>
        ))}
      </span>
      <span className="ptile__label mono">
        branch {branchName} · {groups.length} groups · approval before each
        {config.install_name ? ` · install ${config.install_name}` : ''}
      </span>
    </>
  )
}

function scenarios(install: string, app: string) {
  return [
    {
      scenario: 'Ship one change to the fleet, in order, with an approval per group',
      how: `nuon branches trigger --app-id ${app} --branch-id ${branchName} --no-wait --output agent`,
      note: 'runs the branch at its head on GitHub; nothing is uploaded from this machine, and --force rebuilds every component',
    },
    {
      scenario: 'Preview a pull request against one install before it merges',
      how: `nuon branches preview --app-id ${app} --branch-id ${branchName} --pr-number <n> --install-id ${install} --mode plan-only`,
      note: 'or ask your agent: preview_app_branch, plan-only by default',
    },
    {
      scenario: 'See what changed between two versions',
      how: 'version history in Nuon',
      note: 'every config version this install has run, with a diff',
    },
    {
      scenario: 'Re-apply an earlier version',
      how: 'version history in Nuon',
      note: 'plan, then apply; the old image tags reappear on your pods',
    },
    {
      scenario: 'A new customer joins a wave the moment its install is labelled',
      how: 'nuon installs labels set --install-id <new-install-id> env=staging',
      note: 'groups select installs by label, so nobody edits the branch',
    },
  ]
}

export function RolloutDrawer({ config, caseBranch }: PanelProps) {
  const install = installIdOf(config)
  const app = appIdOf(config)
  const target = caseBranch ? shipsTo(caseBranch)?.name : undefined
  return (
    <>
      <div className="section__head">
        <h3 className="section__title">
          {groups.length} install groups on branch {branchName}
        </h3>
        <div className="subtext muted">[[install_groups]]</div>
      </div>
      <div className="groups">
        {groups.map((group) => (
          <div
            key={group.name}
            className={group.name === target ? 'group-card group-card--lit' : 'group-card'}
          >
            <div className="group-card__head">
              <span className="group-card__num">0{group.order}</span>
              <span className="group-card__name">{group.name}</span>
            </div>
            <div className="group-card__selector mono">
              {group.selector.split(' · ').map((pair, i) => (
                <span key={pair}>
                  {i > 0 && ' · '}
                  <span className="nowrap">{pair}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <CodeBlock label="branch.toml (comments stripped)" code={branchConfigAbridged} />

      <div className="section__head" style={{ marginTop: 24 }}>
        <h3 className="section__title">Operations on branch {branchName}</h3>
        <div className="subtext muted">
          install {install} · app {app}
        </div>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>How, here</th>
            </tr>
          </thead>
          <tbody>
            {scenarios(install, app).map((row) => (
              <tr key={row.scenario}>
                <td>{row.scenario}</td>
                <td>
                  {row.how.startsWith('nuon ') ? (
                    <code className="mono">
                      {row.how.split(' ').flatMap((tok, i) => [
                        i > 0 && ' ',
                        <span key={i} className="nowrap">
                          {tok}
                        </span>,
                      ])}
                    </code>
                  ) : config.links.versions ? (
                    <OutLink href={config.links.versions} variant="plain">
                      {row.how}
                    </OutLink>
                  ) : (
                    row.how
                  )}
                  <div className="subtext muted">{row.note}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CommandBlock
        label="watch the rollout"
        command={`nuon branches runs --app-id ${app} --branch-id ${branchName}`}
      />
      <CommandBlock
        label="this install's group, by label"
        command={`nuon installs labels list --install-id ${install}`}
        note={
          <>
            {config.links.branches && (
              <OutLink href={config.links.branches} variant="plain">
                Branch runs and approvals in Nuon
              </OutLink>
            )}
          </>
        }
      />

      <PanelPrompts panel="rollout" config={config} />
    </>
  )
}
