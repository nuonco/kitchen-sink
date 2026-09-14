import { inputs, runner, sandbox, stack } from '../../lib/config-data.gen'
import type { PanelProps } from '../../lib/panels'
import { useCaseById, useCasePrompt } from '../../lib/prompts'
import { CodeBlock, CopyButton, OutLink } from '../Primitives'

/* ============================================================
   stack-inputs: what the install stack builds, what the sandbox takes, and
   the inputs each install answers. The VPC id is the one live value, from
   /api/ui-config once the stack has produced it.
   ============================================================ */

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  )
}

export function StackInputsTile({ config }: PanelProps) {
  return (
    <>
      <span className="ptile__value">
        {config.vpc_id ? `vpc: created by the stack · ${config.vpc_id}` : 'vpc: created by the stack'}
      </span>
      <span className="ptile__label mono">
        {stack.vpcTemplate.path} · {inputs.length} inputs
      </span>
    </>
  )
}

export function StackInputsDrawer({ config }: PanelProps) {
  const install = config.install_id ?? '<your-install-id>'
  const app = config.app_id ?? '<your-app-id>'
  const inputsCase = useCaseById('inputs')
  return (
    <>
      <div className="section__head">
        <h3 className="section__title">Install stack</h3>
        <div className="subtext muted">stack.toml</div>
      </div>
      <dl className="kv">
        <Fact label="type" value={stack.type} />
        <Fact label="vpc template" value={`${stack.vpcTemplate.path} · ${stack.vpcTemplate.version}`} />
        <Fact label="runner template" value={`${stack.runnerTemplate.path} · ${stack.runnerTemplate.version}`} />
        <Fact
          label="custom nested stacks"
          value={stack.customNestedStacks.map((s) => `${s.index} ${s.name}`).join(' · ') || 'none'}
        />
        {config.vpc_id && <Fact label="vpc id, this install" value={config.vpc_id} />}
      </dl>
      <p className="small muted" style={{ marginTop: 8 }}>
        <OutLink href={stack.vpcTemplateUrl} variant="plain">
          the VPC template
        </OutLink>
      </p>

      <div className="section__head" style={{ marginTop: 24 }}>
        <h3 className="section__title">Sandbox</h3>
        <div className="subtext muted">sandbox.toml · sandbox.tfvars</div>
      </div>
      <dl className="kv">
        <Fact label="module" value={`${sandbox.repo} @ ${sandbox.branch}`} />
        <Fact label="terraform" value={sandbox.terraformVersion} />
        {sandbox.vars.map((v) => (
          <Fact key={v.name} label={v.name} value={v.value} />
        ))}
      </dl>
      <CodeBlock label="sandbox.tfvars (comments stripped)" code={sandbox.tfvars} />

      <div className="section__head" style={{ marginTop: 24 }}>
        <h3 className="section__title">Runner</h3>
        <div className="subtext muted">runner.toml</div>
      </div>
      <dl className="kv">
        <Fact label="runner_type" value={runner.type} />
        <Fact label="helm_driver" value={runner.helmDriver} />
        <Fact label="init_script_url" value={runner.initScriptUrl} />
      </dl>

      <div className="section__head" style={{ marginTop: 24 }}>
        <h3 className="section__title">{inputs.length} inputs</h3>
        <div className="subtext muted">inputs/*/*.toml</div>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Input</th>
              <th>Group</th>
              <th>Type</th>
              <th>Default</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {inputs.map((i) => (
              <tr key={i.name}>
                <td className="mono">{i.name}</td>
                <td className="mono subtext">{i.group}</td>
                <td className="mono subtext">{i.type}</td>
                <td className="mono subtext">{i.default ?? 'none'}</td>
                <td className="subtext">
                  {[
                    i.required && 'required',
                    i.sensitive && 'sensitive',
                    i.internal && 'internal',
                    i.userConfigurable && 'user configurable',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inputsCase && (
        <div className="agent-prompt" style={{ marginTop: 24 }}>
          <div className="cmd__head">
            <span className="cmd__label">{inputsCase.title}</span>
            <CopyButton text={useCasePrompt(inputsCase, install, app)} />
          </div>
          <pre className="cmd__pre agent-prompt__pre">{useCasePrompt(inputsCase, install, app)}</pre>
        </div>
      )}
    </>
  )
}
