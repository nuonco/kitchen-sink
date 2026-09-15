import { useState } from 'react'
import { breakGlassToml, roles } from '../../lib/config-data.gen'
import type { PanelProps } from '../../lib/panels'
import { Callout, CodeBlock, CommandBlock, Disclosure, OutLink } from '../Primitives'
import { PanelPrompts, appIdOf, installIdOf } from './shared'

/* ============================================================
   roles: one IAM role per operation (permissions/*.toml) plus the
   break-glass role (break_glass.toml), and the run whose transcript shows
   the Secrets Manager Deny holding. From the old "Operation roles" page.
   ============================================================ */

const operationRoles = roles.filter((r) => r.type !== 'break-glass')
const breakGlassRoles = roles.filter((r) => r.type === 'break-glass')

const roleNotes: Record<string, string> = {
  provision:
    'AdministratorAccess fenced by provision_boundary.json: the role that provisions the sandbox, the EKS cluster and its DNS zones. The VPC comes from the CloudFormation stack the customer applies.',
  setup: 'Used once per install for first deploys, sharing the provision boundary.',
  maintenance:
    'The day-2 role: AdministratorAccess fenced by maintenance_boundary.json. Deploys and runbooks assume it.',
  'sandbox-updates': 'Sandbox reprovisions and upgrades, separated from app-level maintenance.',
  actions:
    'One inline policy allowing eks:DescribeCluster: actions run on the runner and reach the cluster with kubectl.',
  deprovision: 'Teardown only. Routine operations can never delete the install.',
  'app-break-glass':
    'AdministratorAccess with secretsmanager:* explicitly denied, declared in break_glass.toml. Only the break_glass_remediation action assumes it, so every use is a recorded workflow.',
}

export function RolesTile(_: PanelProps) {
  return (
    <>
      <span className="ptile__value">
        {operationRoles.length} roles + {breakGlassRoles.length} break glass
      </span>
      <span className="ptile__label mono">permissions/*.toml · break_glass.toml</span>
    </>
  )
}

export function RolesDrawer({ config }: PanelProps) {
  const [selected, setSelected] = useState(0)
  const role = roles[selected]
  const install = installIdOf(config)
  const app = appIdOf(config)
  return (
    <>
      <div className="table-wrap">
        <table className="data data--roles">
          <thead>
            <tr>
              <th>Role</th>
              <th>Type</th>
              <th>Boundary</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r, i) => (
              <tr
                key={r.name}
                className={i === selected ? 'row-select row-select--active' : 'row-select'}
                onClick={() => setSelected(i)}
              >
                <td className="mono">{r.name}</td>
                <td className="mono subtext">{r.type}</td>
                <td className="mono subtext">{r.boundary}</td>
                <td>{r.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Callout
        label={
          <>
            {role.name} · in this install:{' '}
            <span className="id">
              {install}-{role.name}
            </span>
          </>
        }
      >
        <Disclosure summary="boundary detail">{roleNotes[role.name] ?? role.desc}</Disclosure>
      </Callout>
      <CodeBlock label="break_glass.toml" code={breakGlassToml} />

      <section className="section">
        <div className="section__head">
          <h3 className="section__title">The Secrets Manager Deny in a run transcript</h3>
          <div className="subtext muted">the transcript prints the assumed role and the denied call</div>
        </div>
        <CommandBlock
          label="1 · action workflows and their actw ids"
          command={`nuon actions list --app-id ${app}`}
        />
        <CommandBlock
          label="2 · run break_glass_remediation"
          command={`nuon actions create-run --install-id ${install} --action-workflow-id <actw-id>`}
        />
        <Disclosure summary="what the transcript shows">
          The run ends by restarting the app&rsquo;s pods. In the transcript,{' '}
          <span className="mono">aws sts get-caller-identity</span> resolves to{' '}
          <span className="mono">{install}-app-break-glass</span>, and the Secrets Manager call that
          follows is denied: the explicit Deny in break_glass.toml holding under AdministratorAccess.{' '}
          {config.links.actions && (
            <OutLink href={config.links.actions} variant="plain">
              Run history in Nuon
            </OutLink>
          )}
        </Disclosure>
        <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
          Who may drive Nuon itself is governed by org API tokens.{' '}
          {config.links.tokens && (
            <OutLink href={config.links.tokens} variant="plain">
              API tokens in Nuon
            </OutLink>
          )}
        </p>
      </section>

      <PanelPrompts panel="roles" config={config} />
    </>
  )
}
