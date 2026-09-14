import { guardrails } from '../../lib/config-data.gen'
import type { PanelProps } from '../../lib/panels'
import { CodeBlock } from '../Primitives'

/* ============================================================
   policies: the OPA policies in policies/*.toml, evaluated against plans
   before anything applies. Config only; nothing here is read live.
   ============================================================ */

const sandboxCount = guardrails.filter((g) => g.type === 'sandbox').length
const componentCount = guardrails.length - sandboxCount

export function PoliciesTile(_: PanelProps) {
  return (
    <>
      <span className="ptile__value">{guardrails.length} OPA policies</span>
      <span className="ptile__label mono">
        {sandboxCount} on the sandbox plan · {componentCount} on components
      </span>
    </>
  )
}

export function PoliciesDrawer(_: PanelProps) {
  return (
    <>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Policy</th>
              <th>Evaluates against</th>
              <th>Scope</th>
            </tr>
          </thead>
          <tbody>
            {guardrails.map((g) => (
              <tr key={g.name}>
                <td className="mono">{g.name}</td>
                <td className="mono subtext">{g.type}</td>
                <td>{g.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {guardrails.map((g) => (
        <CodeBlock key={g.name} label={g.file.replace(/\.toml$/, '.rego')} code={g.rego} />
      ))}
    </>
  )
}
