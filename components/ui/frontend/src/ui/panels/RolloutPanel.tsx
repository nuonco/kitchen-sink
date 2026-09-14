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
      scenario: 'Ship one change to the whole fleet, in order, with an approval per group',
      how: `nuon sync --app-id ${app} --force --branch ${branchName} --no-wait --output agent`,
      note: 'from your clone; watch with the runs command below',
    },
    {
      scenario: 'Preview a pull request against one install before it merges',
      how: `nuon apps branches preview --app-id ${app} --branch-id ${branchName} --pr-number <n> --install-id ${install} --mode plan-only`,
      note: 'or ask your agent: preview_app_branch, plan-only by default',
    },
    {
      scenario: 'See what changed between two versions',
      how: 'version history in Nuon',
      note: 'every config version this install has run, with a diff',
    },
    {
      scenario: 'Re-apply an earlier version',
      how: 'version history in Nuon, plan first, then apply',
      note: 'the old image tags reappear on your pods',
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
        <div className="subtext muted">branch.toml · [[install_groups]]</div>
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
            <div className="group-card__selector mono">{group.selector}</div>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
        A branch run builds the config at one commit.{' '}
        <span className="mono">nuon sync --branch {branchName}</span> from a clone starts one; so does
        a push to <span className="mono">{branchName}</span> once the rules in{' '}
        <span className="mono">triggers.toml.example</span> are enabled. Each group&rsquo;s plan
        holds for a person&rsquo;s approval before it deploys.
      </p>
      <CodeBlock label="branch.toml (comments stripped)" code={branchConfigAbridged} />

      <div className="section__head" style={{ marginTop: 24 }}>
        <h3 className="section__title">What a branch lets you do</h3>
        <div className="subtext muted">ids filled in</div>
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
                    <code className="mono">{row.how}</code>
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
        label="edit any file in your clone, then sync and start the run"
        command={`nuon sync --app-id ${app} --force --branch ${branchName} --no-wait --output agent`}
        note={
          <>
            Syncs your local files as they are (uncommitted included) and starts a branch run through
            the groups above. <span className="mono">--preview</span> plans every group with nothing
            applied.
          </>
        }
      />
      <CommandBlock
        label="watch the rollout"
        command={`nuon apps branches runs --app-id ${app} --branch-id ${branchName}`}
      />
      <CommandBlock
        label="which group is this install in"
        command={`nuon installs labels list --install-id ${install}`}
        note={
          <>
            Groups select by label.{' '}
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
