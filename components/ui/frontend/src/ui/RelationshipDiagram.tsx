import type { ReactNode } from 'react'
import {
  branchName,
  components,
  inputs,
  installConfigs,
  installGroups,
  repoName,
  toggleableComponents,
  type InstallConfig,
  type InstallGroup,
} from '../lib/config-data.gen'

/* ============================================================
   The three opener diagrams. Every name, count, and value on them comes
   from this repo's config (config-data.gen.ts) or from this install
   (props), so a reader can check each one against a file or the cluster.

   1. SourceFork: one source of truth forks into one stack, or one stack
      per customer.
   2. InputsFlow: the values one deployment hardcodes become inputs, and
      each install config answers them.
   3. VersionTimeline: one branch, versions in order across the install
      groups, this install's running version read from its pods.
   ============================================================ */

// Identifiers here are underscore_separated with no spaces, so a browser
// has nowhere to wrap them except mid-syllable. A zero-width space after
// each underscore gives it a readable break point instead.
function softWrap(name: string): string {
  return name.replace(/_/g, '_​')
}

const typeOrder = [
  'container_image',
  'helm_chart',
  'terraform_module',
  'pulumi',
  'kubernetes_manifest',
]

function namesOfType(type: string): string[] {
  return components.filter((c) => c.type === type).map((c) => c.name)
}

/** Component types present in this config, in deploy-shape order. */
function infraTypes(): string[] {
  const present = new Set(components.map((c) => c.type))
  present.delete('container_image')
  return [
    ...typeOrder.filter((t) => present.has(t)),
    ...[...present].filter((t) => !typeOrder.includes(t)).sort(),
  ]
}

/** What varies per install in this config: inputs, toggles, and the
    install config's own account fields. */
function variableNames(): string[] {
  return [
    'region',
    ...inputs.map((i) => i.name),
    ...toggleableComponents.map((c) => c.name),
  ]
}

function labelText(labels: Record<string, string>): string {
  return Object.entries(labels)
    .map(([k, v]) => `${k} = ${v}`)
    .join(' · ')
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="opener__row">
      <span className="opener__row-label">{label}</span>
      <span className="opener__row-value">{children}</span>
    </div>
  )
}

/** Arrowheads shared by every diagram's SVG, defined once per body. */
function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <marker
          id="opener-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#7c8b91" />
        </marker>
        <marker
          id="opener-arrow-accent"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#4cc9f0" />
        </marker>
      </defs>
    </svg>
  )
}

/* ---------- 1 · the fork ---------- */

function ForkArrow({ left, right }: { left: string; right: string }) {
  return (
    <svg
      className="opener__svg"
      viewBox="0 0 1000 92"
      role="img"
      aria-label={`The source of truth forks: ${left}, or ${right}`}
    >
      <path d="M 500 0 V 30" className="opener__line" />
      <path d="M 240 30 H 760" className="opener__line" />
      <path d="M 240 30 V 80" className="opener__line" markerEnd="url(#opener-arrow)" />
      <path
        d="M 760 30 V 80"
        className="opener__line opener__line--accent"
        markerEnd="url(#opener-arrow-accent)"
      />
      <text x="254" y="58" className="opener__svg-mono">
        {left}
      </text>
      <text x="746" y="58" textAnchor="end" className="opener__svg-mono opener__svg-mono--accent">
        {right}
      </text>
    </svg>
  )
}

function CustomerCard({ install }: { install: InstallConfig }) {
  const on = Object.entries(install.toggles)
    .filter(([, v]) => v)
    .map(([k]) => k)
  return (
    <div className="opener__customer">
      <div className="mono opener__customer-name">{install.name}</div>
      <div className="opener__customer-sub">their AWS account</div>
      <div className="mono opener__customer-mono">VPC · cluster · db</div>
      <div className="mono opener__customer-mono opener__customer-mono--accent">
        {install.region ?? 'region unset'}
        {on.length > 0 && ` · ${on.join(' · ')} on`}
      </div>
      <div className="mono opener__customer-mono">{labelText(install.labels)}</div>
    </div>
  )
}

export function SourceFork() {
  const images = namesOfType('container_image')
  const infra = infraTypes()
  const tenants = ['tenant a', 'tenant b', 'tenant c', 'tenant d']
  return (
    <div className="opener__body">
      <SvgDefs />
      <div className="opener__card">
        <div className="opener__card-head">
          <span className="eyebrow">Your source of truth</span>
          <span className="mono opener__card-aside">{repoName}</span>
        </div>
        <div className="opener__triad">
          <div className="opener__cell">
            <div className="opener__cell-title">Application code</div>
            <div className="mono opener__cell-mono">container_image · {images.length}</div>
            <div className="mono opener__cell-names">{images.map(softWrap).join(', ')}</div>
          </div>
          <div className="opener__cell">
            <div className="opener__cell-title">Infrastructure definitions</div>
            <div className="mono opener__cell-mono">{infra.map(softWrap).join(' · ')}</div>
            <div className="mono opener__cell-names">
              {components.length - images.length} components
            </div>
          </div>
          <div className="opener__cell">
            <div className="opener__cell-title">Configuration</div>
            <div className="mono opener__cell-mono">{variableNames().join(', ')}</div>
            <div className="mono opener__cell-names">inputs/ · install-configs/</div>
          </div>
        </div>
      </div>

      <ForkArrow left="builds 1 stack" right={`builds ${installConfigs.length} stacks`} />

      <div className="opener__columns">
        <div className="opener__col">
          <div className="opener__col-head">
            <span className="eyebrow">Today · your cloud</span>
            <span className="opener__col-title">One stack, every tenant inside it</span>
          </div>
          <div className="opener__stack">
            <div className="mono opener__stack-mono">one VPC · one cluster · one database</div>
            <div className="opener__chips">
              {tenants.map((t) => (
                <span key={t} className="opener__pill">
                  {t}
                </span>
              ))}
              <span className="opener__pill opener__pill--ghost">… the rest</span>
            </div>
          </div>
          <div className="opener__rows">
            <Row label="Isolation">Application-level: rows, namespaces, claims</Row>
            <Row label="Ground">Your account, your bill, your blast radius</Row>
            <Row label="Config">One set of values. Nothing has to vary.</Row>
          </div>
        </div>

        <div className="opener__col opener__col--accent">
          <div className="opener__col-head">
            <span className="eyebrow eyebrow--accent">With Nuon · your customers&rsquo; clouds</span>
            <span className="opener__col-title">One stack per customer, one tenant each</span>
          </div>
          <div className="opener__template">
            <div className="opener__card-head">
              <span className="eyebrow eyebrow--accent">The template</span>
              <span className="opener__card-aside">Nuon stores this as an app</span>
            </div>
            <div className="opener__template-line">
              The same definitions, plus a declaration of what varies.
            </div>
            <div className="opener__chips">
              {variableNames().map((v) => (
                <span key={v} className="mono opener__var">
                  {softWrap(v)}
                </span>
              ))}
            </div>
          </div>
          <svg
            className="opener__svg"
            viewBox="0 0 560 40"
            role="img"
            aria-label="The template resolves once per customer"
          >
            <path
              d="M 280 0 V 28"
              className="opener__line opener__line--accent"
              markerEnd="url(#opener-arrow-accent)"
            />
            <text x="294" y="20" className="opener__svg-mono">
              resolved once per customer
            </text>
          </svg>
          <div className="opener__customers">
            {installConfigs.map((c) => (
              <CustomerCard key={c.name} install={c} />
            ))}
          </div>
          <div className="opener__rows">
            <Row label="Isolation">Infrastructure-level: separate accounts</Row>
            <Row label="Ground">Their account, their bill, their blast radius</Row>
            <Row label="Config">
              One set of answers per customer, in{' '}
              <span className="mono">install-configs/*.toml</span>
            </Row>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- 2 · from hardcoded values to inputs ---------- */

interface ValueRow {
  key: string
  /** The value one deployment would hardcode: this config's default. */
  value: string
  /** The mechanism that makes it vary per install. */
  template: string
  /** Where each install config answers it. */
  answer: (c: InstallConfig) => string
}

function valueRows(): ValueRow[] {
  const regions = [...new Set(installConfigs.map((c) => c.region).filter(Boolean))]
  const rows: ValueRow[] = [
    {
      key: 'region',
      value: regions[0] ? `"${regions[0]}"` : '""',
      template: '[aws_account] region',
      answer: (c) => c.region ?? 'unset',
    },
  ]
  for (const i of inputs) {
    if (i.internal) continue
    rows.push({
      key: i.name,
      value: i.default === null ? (i.sensitive ? 'unset · sensitive' : 'unset') : i.type === 'bool' ? i.default : `"${i.default}"`,
      template: `{{ .nuon.inputs.inputs.${i.name} }}`,
      answer: (c) => c.inputs[i.name] ?? (i.default ?? 'unset'),
    })
  }
  for (const t of toggleableComponents) {
    rows.push({
      key: t.name,
      value: String(t.defaultEnabled),
      template: `[component_toggles] ${t.name}`,
      answer: (c) => String(c.toggles[t.name] ?? t.defaultEnabled),
    })
  }
  return rows
}

function DownArrow({ label }: { label: string }) {
  return (
    <svg className="opener__svg opener__svg--short" viewBox="0 0 1000 52" role="img" aria-label={label}>
      <path
        d="M 500 0 V 40"
        className="opener__line opener__line--accent"
        markerEnd="url(#opener-arrow-accent)"
      />
    </svg>
  )
}

export function InputsFlow() {
  const rows = valueRows()
  const pad = Math.max(...rows.map((r) => r.key.length))
  const differs = (row: ValueRow) =>
    new Set(installConfigs.map((c) => row.answer(c))).size > 1
  return (
    <div className="opener__body">
      <SvgDefs />
      <div className="opener__card">
        <div className="opener__card-head">
          <span className="eyebrow">What you have</span>
          <span className="mono opener__card-aside">the defaults in inputs/, components/ and install-configs/</span>
        </div>
        <pre className="opener__code">
          {rows.map((r) => `${r.key.padEnd(pad)} = ${r.value}`).join('\n')}
        </pre>
      </div>

      <DownArrow label="Each value is asked whether it varies between customers" />

      <div className="opener__card opener__card--accent">
        <div className="opener__card-head">
          <span className="eyebrow eyebrow--accent">Template · Nuon app config</span>
          <span className="mono opener__card-aside">{repoName}</span>
        </div>
        <div className="opener__code opener__code--chips">
          {rows.map((r) => (
            <div key={r.key} className="opener__code-line">
              <span>{r.key.padEnd(pad)} = </span>
              <span className="opener__var">{r.template}</span>
            </div>
          ))}
        </div>
      </div>

      <DownArrow label="Each install config answers the inputs" />

      <div className="opener__card">
        <div className="opener__card-head">
          <span className="eyebrow">{installConfigs.length} install configs</span>
          <span className="mono opener__card-aside">install-configs/*.toml</span>
        </div>
        <div className="opener__matrix" style={{ gridTemplateColumns: `140px repeat(${installConfigs.length}, minmax(0, 1fr))` }}>
          <div className="opener__matrix-cell opener__matrix-cell--head mono">value</div>
          {installConfigs.map((c) => (
            <div key={c.name} className="opener__matrix-cell opener__matrix-cell--head mono opener__matrix-cell--name">
              {c.name}
            </div>
          ))}
          <div className="opener__matrix-cell mono opener__matrix-cell--key">labels</div>
          {installConfigs.map((c) => (
            <div key={c.name} className="opener__matrix-cell mono opener__matrix-cell--accent">
              {labelText(c.labels)}
            </div>
          ))}
          {rows.map((r) => (
            <div key={r.key} style={{ display: 'contents' }}>
              <div className="opener__matrix-cell mono opener__matrix-cell--key">{r.key}</div>
              {installConfigs.map((c) => (
                <div
                  key={c.name}
                  className={
                    differs(r)
                      ? 'opener__matrix-cell mono opener__matrix-cell--accent'
                      : 'opener__matrix-cell mono'
                  }
                >
                  {r.answer(c)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------- 3 · versions across the install groups ---------- */

const W = 1084
const ROW_H = 132
const ROW_GAP = 22
const ROW_TOP = 128
const NODE_X = 860
const CHIP_W = 156
const CHIP_H = 88

function groupsInOrder(): InstallGroup[] {
  return installGroups.slice().sort((a, b) => a.order - b.order)
}

function configsIn(group: string): InstallConfig[] {
  return installConfigs.filter((c) => c.group === group)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function VersionTimeline({
  installName,
  installId,
  runningTags,
}: {
  installName?: string
  installId?: string
  runningTags: string[]
}) {
  const groups = groupsInOrder()
  const height = ROW_TOP + groups.length * (ROW_H + ROW_GAP)
  const thisGroup = installName
    ? installConfigs.find((c) => c.name === installName)?.group ?? null
    : null
  const running = runningTags.length > 0 ? runningTags.join(' · ') : null
  const who = installName ?? installId ?? 'this install'

  const describe = [
    `Branch ${branchName}. Each branch run is a version.`,
    ...groups.map((g) => {
      const names = configsIn(g.name).map((c) => c.name)
      return `Group ${g.name}, order ${g.order}, selector ${g.selector}${names.length ? `, install config${names.length === 1 ? '' : 's'} ${names.join(', ')}` : ''}.`
    }),
    running ? `${who} runs ${running}.` : `${who}: no pod read yet.`,
  ].join(' ')

  return (
    <svg
      className="opener__svg opener__timeline"
      viewBox={`0 0 ${W} ${height}`}
      role="img"
      aria-label={describe}
    >
      <defs>
        <marker
          id="opener-arrow-gate"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#4cc9f0" />
        </marker>
      </defs>

      <text x="0" y="12" className="opener__svg-label">
        BRANCH {branchName.toUpperCase()}
      </text>
      <text x={W} y="12" textAnchor="end" className="opener__svg-label">
        EACH BRANCH RUN IS A VERSION
      </text>

      <line x1="0" y1="52" x2={W} y2="52" className="opener__branch-line" />
      <line x1={NODE_X} y1="52" x2={W} y2="52" className="opener__branch-line opener__branch-line--accent" />

      <circle cx={NODE_X} cy="52" r="16" className="opener__node-halo" />
      <circle cx={NODE_X} cy="52" r="9" className="opener__node" />
      <text x={NODE_X} y="88" textAnchor="middle" className="opener__node-title">
        {running ?? '…'}
      </text>
      <text x={NODE_X} y="106" textAnchor="middle" className="opener__svg-mono opener__svg-mono--accent">
        running on {who}
      </text>

      {groups.map((g, i) => {
        const y = ROW_TOP + i * (ROW_H + ROW_GAP)
        const names = configsIn(g.name).map((c) => c.name)
        const regions = [...new Set(configsIn(g.name).map((c) => c.region).filter(Boolean))]
        const isThis = thisGroup === g.name
        const chipY = y + (ROW_H - CHIP_H) / 2
        return (
          <g key={g.name}>
            {i > 0 && (
              <>
                <line
                  x1="60"
                  y1={y - ROW_GAP}
                  x2="60"
                  y2={y - 2}
                  className="opener__gate-line"
                  markerEnd="url(#opener-arrow-gate)"
                />
                <text x="72" y={y - 6} className="opener__svg-mono opener__svg-mono--accent">
                  approval
                </text>
              </>
            )}
            <rect x="0" y={y} width={W} height={ROW_H} rx="10" className="opener__group" />
            <text x="24" y={y + 50} className="opener__group-name">
              {capitalize(g.name)}
            </text>
            <text x="24" y={y + 74} className="opener__svg-mono">
              {g.selector}
            </text>
            <text x="24" y={y + 96} className="opener__svg-mono opener__svg-mono--tertiary">
              {names.length > 0
                ? `install config${names.length === 1 ? '' : 's'}: ${names.join(' · ')}${regions.length ? ` · ${regions.join(' · ')}` : ''}`
                : 'no install config matches this selector'}
            </text>
            <text x={W - 24} y={y + 50} textAnchor="end" className="opener__svg-mono opener__svg-mono--tertiary">
              order {g.order}
            </text>
            {isThis && (
              <>
                <line
                  x1={NODE_X}
                  y1="112"
                  x2={NODE_X}
                  y2={chipY}
                  className="opener__leader"
                />
                <rect
                  x={NODE_X - CHIP_W / 2}
                  y={chipY}
                  width={CHIP_W}
                  height={CHIP_H}
                  rx="10"
                  className="opener__chip"
                />
                <text x={NODE_X} y={chipY + 48} textAnchor="middle" className="opener__chip-title">
                  {running ?? '…'}
                </text>
                <text x={NODE_X} y={chipY + 72} textAnchor="middle" className="opener__svg-mono">
                  {who}
                </text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}
